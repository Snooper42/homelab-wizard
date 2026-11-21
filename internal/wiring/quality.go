package wiring

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"strings"
)

// One plain question instead of quality profiles (arr item 7): "What do
// you mostly watch on?", kept as MEDIA_QUALITY. Connect apps gives Sonarr
// and Radarr one quality profile, Homelab, made from the answer, and Seerr
// asks for it. Checked against Sonarr's and Radarr's develop source
// (QualityProfileResource, QualityProfileController's validators,
// QualityProfileService.GetDefaultProfile, Quality.cs, CustomFormatResource,
// RegexSpecificationBase): a profile lists every quality, grouped ones
// (WEB 1080p: WEBDL and WEBRip) as one item sharing Allowed; the cutoff is
// an allowed quality's id or group's id; every custom format is listed with
// a score; MinUpgradeFormatScore is at least 1.

// QualityProfile is the profile Connect apps makes and Seerr asks for.
const QualityProfile = "Homelab"

// hevcFormat is the custom format that makes the smaller HEVC (x265)
// releases win among those of the same quality: Infuse, an Apple TV and
// most TVs play them (the owner, Nov 21).
const hevcFormat = "Smaller files (HEVC)"

// hevcScore is its score in the profile when files are kept small.
const hevcScore = 100

// Quality is one answer and what it means to Sonarr and Radarr. The three
// answers are in Qualities, the one place they're mapped.
type Quality struct {
	Key         string // MEDIA_QUALITY's value
	Answer      string // the answer as the question offers it
	Words       string // what Connect apps says it does
	Resolutions []int  // the resolutions allowed
	Remux       bool   // whole-disc copies (Remux), many times the size
	Upgrades    bool   // swap a download for a better one later (a second download)
	PreferHEVC  bool   // the smaller HEVC files first, among the same quality
}

// Qualities are the answers, the default first (answer 3 and 6: disk space
// comes first, save space).
var Qualities = []Quality{
	{Key: "save-space", Answer: "Save space", Words: "1080p, the smaller files first", Resolutions: []int{720, 1080}, PreferHEVC: true},
	{Key: "hd", Answer: "An HD TV or phones: the best 1080p", Words: "the best 1080p", Resolutions: []int{720, 1080}, Remux: true, Upgrades: true},
	{Key: "4k", Answer: "A 4K TV", Words: "4K when there is one, else 1080p", Resolutions: []int{1080, 2160}, Upgrades: true},
}

// QualityFor is the answer MEDIA_QUALITY holds; save space when it's unset
// or not one of the answers.
func QualityFor(env map[string]string) Quality {
	v := strings.ToLower(strings.TrimSpace(env["MEDIA_QUALITY"]))
	for _, q := range Qualities {
		if q.Key == v {
			return q
		}
	}
	return Qualities[0]
}

// allows is whether the answer takes one of the apps' qualities, by its
// name and resolution (Sonarr's "Bluray-1080p Remux", Radarr's
// "Remux-1080p"; never Raw-HD or BR-DISK, untouched broadcast and disc
// images).
func (q Quality) allows(name string, resolution int) bool {
	switch {
	case !slices.Contains(q.Resolutions, resolution):
		return false
	case strings.Contains(name, "Raw-HD"), strings.Contains(name, "BR-DISK"):
		return false
	case strings.Contains(name, "Remux"):
		return q.Remux
	}
	return true
}

// shape sets a profile's qualities, cutoff (the best allowed, the list
// being in the apps' order, worst first), upgrades and the HEVC format's
// score as the answer says, and reports whether anything changed.
func (q Quality) shape(p resource, hevc int) bool {
	changed := false
	cutoff := -1
	items, _ := p["items"].([]any)
	for _, it := range items {
		item, ok := it.(map[string]any)
		if !ok {
			continue
		}
		allow := false
		if quality, ok := item["quality"].(map[string]any); ok {
			res, _ := quality["resolution"].(float64)
			allow = q.allows(fmt.Sprint(quality["name"]), int(res))
			if allow {
				id, _ := quality["id"].(float64)
				cutoff = int(id)
			}
		} else {
			members, _ := item["items"].([]any)
			for _, m := range members {
				mq, _ := m.(map[string]any)["quality"].(map[string]any)
				res, _ := mq["resolution"].(float64)
				allow = allow || q.allows(fmt.Sprint(mq["name"]), int(res))
			}
			for _, m := range members {
				if mm, ok := m.(map[string]any); ok && mm["allowed"] != allow {
					mm["allowed"], changed = allow, true
				}
			}
			if allow {
				id, _ := item["id"].(float64)
				cutoff = int(id)
			}
		}
		if item["allowed"] != allow {
			item["allowed"], changed = allow, true
		}
	}
	if cur, _ := p["cutoff"].(float64); int(cur) != cutoff || p["cutoff"] == nil {
		p["cutoff"], changed = float64(cutoff), true
	}
	if p["upgradeAllowed"] != q.Upgrades {
		p["upgradeAllowed"], changed = q.Upgrades, true
	}
	if n, _ := p["minUpgradeFormatScore"].(float64); n < 1 {
		p["minUpgradeFormatScore"], changed = float64(1), true
	}
	if hevc > 0 {
		want := 0.0
		if q.PreferHEVC {
			want = float64(hevcScore)
		}
		formats, _ := p["formatItems"].([]any)
		found := false
		for _, f := range formats {
			fi, ok := f.(map[string]any)
			if !ok {
				continue
			}
			if id, _ := fi["format"].(float64); int(id) == hevc {
				found = true
				if s, _ := fi["score"].(float64); s != want {
					fi["score"], changed = want, true
				}
			}
		}
		if !found {
			p["formatItems"], changed = append(formats, map[string]any{"format": float64(hevc), "name": hevcFormat, "score": want}), true
		}
	}
	return changed
}

// hevcFormatID is the HEVC custom format's id in the app, made when the
// answer prefers it and it isn't there yet; 0 when it's neither there nor
// wanted.
func (w *Wirer) hevcFormatID(ctx context.Context, id, key string, want bool) (int, error) {
	var formats []resource
	if err := w.call(ctx, id, key, http.MethodGet, "customformat", nil, &formats); err != nil {
		return 0, err
	}
	for _, f := range formats {
		if f["name"] == hevcFormat {
			n, _ := f["id"].(float64)
			return int(n), nil
		}
	}
	if !want {
		return 0, nil
	}
	body := resource{
		"name": hevcFormat, "includeCustomFormatWhenRenaming": false,
		"specifications": []any{map[string]any{
			"name": "HEVC (x265)", "implementation": "ReleaseTitleSpecification", "negate": false, "required": false,
			"fields": []any{map[string]any{"name": "value", "value": `\b(x|h)[ .]?265\b|\bHEVC\b`}},
		}},
	}
	var made resource
	if err := w.call(ctx, id, key, http.MethodPost, "customformat", body, &made); err != nil {
		return 0, err
	}
	n, _ := made["id"].(float64)
	return int(n), nil
}

// quality gives Sonarr or Radarr the Homelab profile, made from the answer,
// and corrects it when the answer or the profile changed.
func (w *Wirer) quality(ctx context.Context, id string) (string, string, error) {
	key, err := w.ready(ctx, id)
	if err != nil {
		return "", "", err
	}
	q := QualityFor(w.Env)
	hevc, err := w.hevcFormatID(ctx, id, key, q.PreferHEVC)
	if err != nil {
		return "", "", err
	}
	var profiles []resource
	if err := w.call(ctx, id, key, http.MethodGet, "qualityprofile", nil, &profiles); err != nil {
		return "", "", err
	}
	for _, p := range profiles {
		if p["name"] != QualityProfile {
			continue
		}
		if !q.shape(p, hevc) {
			return "already", "", nil
		}
		if err := w.call(ctx, id, key, http.MethodPut, fmt.Sprintf("qualityprofile/%v", p["id"]), p, nil); err != nil {
			return "", "", err
		}
		return "done", "changed the " + QualityProfile + " profile", nil
	}
	var p resource
	if err := w.call(ctx, id, key, http.MethodGet, "qualityprofile/schema", nil, &p); err != nil {
		return "", "", err
	}
	if p == nil {
		return "", "", fmt.Errorf("%s gave no quality profile to start from", w.name(id))
	}
	delete(p, "id")
	p["name"] = QualityProfile
	q.shape(p, hevc)
	if err := w.call(ctx, id, key, http.MethodPost, "qualityprofile", p, nil); err != nil {
		return "", "", err
	}
	return "done", "as the " + QualityProfile + " profile", nil
}
