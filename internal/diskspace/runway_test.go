package diskspace

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

func days(start time.Time, free ...uint64) []Sample {
	var out []Sample
	for i, f := range free {
		out = append(out, Sample{Day: start.AddDate(0, 0, i).Format(time.DateOnly), Free: f, Total: 1000 * gb})
	}
	return out
}

func TestRunway(t *testing.T) {
	now := time.Date(2026, 11, 27, 12, 0, 0, 0, time.Local)
	start := now.AddDate(0, 0, -9)
	// 3 GB a day for ten days, 60 GB left: about 20 days.
	var free []uint64
	for i := 0; i < 10; i++ {
		free = append(free, uint64(87-3*i)*gb)
	}
	d, per, ok := Runway(days(start, free...), now)
	if !ok || d < 19.5 || d > 20.5 || per < 2.9*gb || per > 3.1*gb {
		t.Fatalf("runway %.1f days at %.1f GB a day, %v", d, per/gb, ok)
	}

	// Not filling (free space steady, or growing after a clean-up): no runway.
	if _, _, ok := Runway(days(start, 60*gb, 61*gb, 60*gb, 62*gb, 63*gb, 64*gb, 65*gb), now); ok {
		t.Error("a disk that is not filling has a runway")
	}
	// Too little to go on: three days, or a week's samples only two days apart.
	if _, _, ok := Runway(days(now.AddDate(0, 0, -2), 90*gb, 80*gb, 70*gb), now); ok {
		t.Error("three days are a trend")
	}
	if _, _, ok := Runway(days(now.AddDate(0, 0, -3), 90*gb, 80*gb, 70*gb, 60*gb), now); ok {
		t.Error("four samples over three days are a trend")
	}
	// Samples older than TrendDays don't count: a fast fill a month ago, steady since.
	old := days(now.AddDate(0, 0, -40), 300*gb, 250*gb, 200*gb, 150*gb, 100*gb)
	steady := days(now.AddDate(0, 0, -8), 100*gb, 100*gb, 100*gb, 100*gb, 100*gb, 100*gb, 100*gb, 100*gb, 100*gb)
	if _, _, ok := Runway(append(old, steady...), now); ok {
		t.Error("last month's fill counts today")
	}
	// A day that does not parse is passed over, not taken as day 0.
	bad := append([]Sample{{Day: "yesterday", Free: 1}}, days(start, free...)...)
	if d2, _, ok := Runway(bad, now); !ok || d2 < 19.5 || d2 > 20.5 {
		t.Errorf("a broken sample changed it: %.1f %v", d2, ok)
	}
}

func TestRunwayWords(t *testing.T) {
	now := time.Date(2026, 11, 27, 12, 0, 0, 0, time.Local)
	w := RunwayWords("homelab folder, backups", 12.4, 3*gb, now)
	for _, want := range []string{"homelab folder, backups", "3.0 GB a day", "about 12 days", "Wed Dec 9", "damage their databases"} {
		if !strings.Contains(w, want) {
			t.Errorf("no %q in %q", want, w)
		}
	}
	if w := RunwayWords("media", 0.6, 50*gb, now); !strings.Contains(w, "about a day") {
		t.Errorf("%q", w)
	}
}

// One sample a disk a day, the day's last reading kept; older than
// KeepDays dropped; written whole.
func TestRecord(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data", "disk-history.json")
	now := time.Date(2026, 11, 27, 9, 0, 0, 0, time.Local)
	vols := []Volume{{Names: []string{"homelab folder", "backups"}, Free: 100 * gb, Total: 1000 * gb}, {Names: []string{"media"}, Free: 2000 * gb, Total: 4000 * gb}}
	if err := Record(path, vols, now.AddDate(0, 0, -KeepDays-1)); err != nil {
		t.Fatal(err)
	}
	if err := Record(path, vols, now.AddDate(0, 0, -1)); err != nil {
		t.Fatal(err)
	}
	if err := Record(path, vols, now); err != nil {
		t.Fatal(err)
	}
	vols[0].Free = 99 * gb
	if err := Record(path, append(vols, Volume{Names: nil, Total: 1}, Volume{Names: []string{"gone"}}), now.Add(6*time.Hour)); err != nil {
		t.Fatal(err)
	}
	h := LoadHistory(path)
	got := h["homelab folder"]
	if len(got) != 2 || got[0].Day != "2026-11-26" || got[1].Free != 99*gb {
		t.Fatalf("%+v", got)
	}
	if len(h["media"]) != 2 || h["gone"] != nil || len(h) != 2 {
		t.Errorf("%+v", h)
	}
	// Private where the system has permission bits; Windows has none to read.
	if info, err := os.Stat(path); err != nil || runtime.GOOS != "windows" && info.Mode().Perm() != 0o600 {
		t.Errorf("not private: %v %v", info.Mode(), err)
	}
	// A broken file is an empty history, not an error.
	_ = os.WriteFile(path, []byte("{not json"), 0o600)
	if h := LoadHistory(path); len(h) != 0 {
		t.Errorf("%+v", h)
	}
}
