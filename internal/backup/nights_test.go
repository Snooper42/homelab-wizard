package backup

import (
	"path/filepath"
	"testing"
	"time"
)

// Q4 (a): each night's result per app, the newest fourteen kept, a second run the same night replacing the first,
// and an app with a failed part counted as failed.
func TestNights(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data", "backup-nights.json")
	if got := LoadNights(path); len(got) != 0 {
		t.Fatalf("no file: %v", got)
	}
	start := time.Date(2026, 11, 1, 3, 30, 0, 0, time.Local)
	for d := range 16 {
		r := NightResults{}
		r.Set("mealie", NightCopied)
		if d == 15 {
			r.Set("moneymatter", NightCopied)
			r.Set("moneymatter", NightFailed) // its volume failed
			r.Set("moneymatter", NightCopied)
		}
		if err := RecordNight(path, start.AddDate(0, 0, d), r); err != nil {
			t.Fatal(err)
		}
	}
	// The same night again: replaces, doesn't add.
	if err := RecordNight(path, start.AddDate(0, 0, 15).Add(time.Hour), NightResults{"mealie": NightStopped, "moneymatter": NightFailed}); err != nil {
		t.Fatal(err)
	}
	nights := LoadNights(path)
	if len(nights) != NightsKept {
		t.Fatalf("%d nights kept, want %d", len(nights), NightsKept)
	}
	if nights[0].Date != "2026-11-03" || nights[len(nights)-1].Date != "2026-11-16" {
		t.Errorf("kept %s to %s", nights[0].Date, nights[len(nights)-1].Date)
	}
	if last := nights[len(nights)-1].Apps; last["mealie"] != NightStopped || last["moneymatter"] != NightFailed {
		t.Errorf("the second run that night: %v", last)
	}
	r := NightResults{}
	r.Set("a", NightCopied)
	r.Set("a", NightFailed)
	r.Set("a", NightCopied)
	if r["a"] != NightFailed {
		t.Errorf("a failed part, then a copied one: %s", r["a"])
	}
}
