package wiring

import (
	"context"
	"sort"
	"testing"
	"time"
)

// allowedOf is the names a profile allows, and its cutoff.
func allowedOf(p resource) ([]string, float64) {
	var names []string
	for _, it := range p["items"].([]any) {
		item := it.(map[string]any)
		if item["allowed"] != true {
			continue
		}
		if q, ok := item["quality"].(map[string]any); ok {
			names = append(names, q["name"].(string))
			continue
		}
		names = append(names, item["name"].(string))
	}
	sort.Strings(names)
	cutoff, _ := p["cutoff"].(float64)
	return names, cutoff
}

func hevcScoreOf(p resource, id float64) float64 {
	for _, f := range p["formatItems"].([]any) {
		if fi := f.(map[string]any); fi["format"] == id {
			s, _ := fi["score"].(float64)
			return s
		}
	}
	return -1
}

// Each answer, one profile (arr item 7, the mapping in one place): save
// space allows 720p and 1080p without whole-disc copies, never swaps a
// download for a better one, and puts the smaller HEVC files first; the
// best 1080p takes Remux and upgrades; 4K takes 2160p and 1080p. Raw-HD is
// never taken. The cutoff is the best allowed.
func TestQualityProfileForEachAnswer(t *testing.T) {
	for _, tc := range []struct {
		key      string
		allowed  []string
		cutoff   float64
		upgrades bool
		hevc     bool
	}{
		{"", []string{"Bluray-1080p", "Bluray-720p", "HDTV-1080p", "HDTV-720p", "WEB 1080p", "WEB 720p"}, 7, false, true},
		{"save-space", []string{"Bluray-1080p", "Bluray-720p", "HDTV-1080p", "HDTV-720p", "WEB 1080p", "WEB 720p"}, 7, false, true},
		{"hd", []string{"Bluray-1080p", "Bluray-1080p Remux", "Bluray-720p", "HDTV-1080p", "HDTV-720p", "WEB 1080p", "WEB 720p"}, 20, true, false},
		{"4k", []string{"Bluray-1080p", "Bluray-2160p", "HDTV-1080p", "HDTV-2160p", "WEB 1080p", "WEB 2160p"}, 19, true, false},
		{"nonsense", []string{"Bluray-1080p", "Bluray-720p", "HDTV-1080p", "HDTV-720p", "WEB 1080p", "WEB 720p"}, 7, false, true},
	} {
		p := fakeProfileSchema()
		p["formatItems"] = []any{map[string]any{"format": float64(5), "score": float64(0)}}
		QualityFor(map[string]string{"MEDIA_QUALITY": tc.key}).shape(p, 5)
		names, cutoff := allowedOf(p)
		if len(names) != len(tc.allowed) || cutoff != tc.cutoff || p["upgradeAllowed"] != tc.upgrades {
			t.Errorf("%q: allows %v (cutoff %v, upgrades %v), want %v (cutoff %v, upgrades %v)", tc.key, names, cutoff, p["upgradeAllowed"], tc.allowed, tc.cutoff, tc.upgrades)
			continue
		}
		for i := range names {
			if names[i] != tc.allowed[i] {
				t.Errorf("%q: allows %v, want %v", tc.key, names, tc.allowed)
				break
			}
		}
		if got := hevcScoreOf(p, 5) == hevcScore; got != tc.hevc {
			t.Errorf("%q: HEVC first %v, want %v", tc.key, got, tc.hevc)
		}
		// A group's qualities follow the group.
		for _, it := range p["items"].([]any) {
			item := it.(map[string]any)
			for _, m := range item["items"].([]any) {
				if m.(map[string]any)["allowed"] != item["allowed"] {
					t.Errorf("%q: %v's members differ from it", tc.key, item["name"])
				}
			}
		}
	}
}

// Connect apps makes the Homelab profile and the HEVC format once; a second
// run changes nothing (rule 5); a changed answer changes the same profile,
// and Seerr keeps asking for it.
func TestQualityProfileIsMadeOnceAndFollowsTheAnswer(t *testing.T) {
	url, saved := fakeArr(t, "skey", nil)
	w := &Wirer{
		Apps: map[string]App{"sonarr": {ID: "sonarr", Name: "Sonarr", URL: url, Internal: "http://sonarr:8989", ConfigDir: configDir(t, "skey")}},
		Env:  map[string]string{}, Wait: time.Second,
	}
	const text = "Sonarr downloads 1080p, the smaller files first"
	got := linkStates(w.Apply(context.Background(), nil))
	if l := got[text]; l.State != "done" {
		t.Fatalf("first run: %+v", got)
	}
	if len(saved["qualityprofile"]) != 1 || len(saved["customformat"]) != 1 || saved["qualityprofile"][0]["name"] != QualityProfile {
		t.Fatalf("made: %+v %+v", saved["qualityprofile"], saved["customformat"])
	}
	cf := saved["customformat"][0]
	if cf["name"] != hevcFormat || hevcScoreOf(saved["qualityprofile"][0], cf["id"].(float64)) != hevcScore {
		t.Fatalf("HEVC: %+v in %+v", cf, saved["qualityprofile"][0]["formatItems"])
	}
	if l := linkStates(w.Apply(context.Background(), nil))[text]; l.State != "already" || len(saved["qualityprofile"]) != 1 || len(saved["customformat"]) != 1 {
		t.Fatalf("second run: %+v, %d profiles", l, len(saved["qualityprofile"]))
	}
	// The answer changes to 4K: the same profile, changed; HEVC no longer first.
	w.Env["MEDIA_QUALITY"] = "4k"
	got = linkStates(w.Apply(context.Background(), nil))
	if l := got["Sonarr downloads 4K when there is one, else 1080p"]; l.State != "done" || len(saved["qualityprofile"]) != 1 {
		t.Fatalf("to 4K: %+v", got)
	}
	p := saved["qualityprofile"][0]
	if names, _ := allowedOf(p); len(names) != 6 || p["upgradeAllowed"] != true || hevcScoreOf(p, cf["id"].(float64)) != 0 {
		t.Fatalf("4K profile: %v %+v", names, p)
	}
	// Seerr asks for it, ahead of HD-1080p.
	saved["qualityprofile"] = append([]resource{{"id": float64(9), "name": "HD-1080p"}}, saved["qualityprofile"]...)
	if _, name, err := w.profile(context.Background(), "sonarr", "skey"); err != nil || name != QualityProfile {
		t.Fatalf("Seerr's profile: %q %v", name, err)
	}
}
