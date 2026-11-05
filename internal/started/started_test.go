package started

import (
	"fmt"
	"os"
	"runtime"
	"sync"
	"testing"
	"time"
)

func TestNoteAndWhy(t *testing.T) {
	root := t.TempDir()
	now := time.Date(2026, 11, 4, 3, 15, 0, 0, time.UTC)
	if err := Note(root, Battery, now, "immich", "jellyfin"); err != nil {
		t.Fatal(err)
	}
	if err := Note(root, You, now.Add(time.Hour), "jellyfin"); err != nil {
		t.Fatal(err)
	}
	r := Load(Path(root))
	for _, tc := range []struct {
		name, id string
		since    time.Time
		want     string
	}{
		{"its start, a little before the note", "immich", now.Add(-20 * time.Second), Battery},
		{"its start, a little after (a slow app)", "immich", now.Add(4 * time.Minute), Battery},
		{"a later start the homelab did not make", "immich", now.Add(3 * time.Hour), ""},
		{"an earlier start", "immich", now.Add(-time.Hour), ""},
		{"the newest note wins", "jellyfin", now.Add(time.Hour), You},
		{"never noted", "vikunja", now, ""},
		{"no start time", "immich", time.Time{}, ""},
	} {
		if got := r.Why(tc.id, tc.since); got != tc.want {
			t.Errorf("%s: %q, want %q", tc.name, got, tc.want)
		}
	}
	// Two months on, an old note is dropped with the next.
	if err := Note(root, Fix, now.Add(Keep+2*time.Hour), "vikunja"); err != nil {
		t.Fatal(err)
	}
	if r := Load(Path(root)); len(r) != 1 || r["vikunja"].Why != Fix {
		t.Fatalf("after two months: %+v", r)
	}
	// Nothing to note writes nothing; a record that does not read is empty.
	if err := Note(t.TempDir(), You, now); err != nil {
		t.Fatal(err)
	}
	if r := Load(root + "/nothing.json"); len(r) != 0 {
		t.Fatalf("missing file: %+v", r)
	}
}

// Six parts of the homelab note starts (Start, updates, Fix it, the
// watchdog, the battery saver, a drive, the stop timer), some at once: each
// keeps its note, and a reader never meets a half-written file.
func TestNotesAtOnceAreAllKept(t *testing.T) {
	root := t.TempDir()
	now := time.Now()
	var wg sync.WaitGroup
	for i := range 40 {
		wg.Go(func() {
			if err := Note(root, Watchdog, now, fmt.Sprintf("app%02d", i)); err != nil {
				t.Error(err)
			}
		})
	}
	wg.Wait()
	if got := len(Load(Path(root))); got != 40 {
		t.Errorf("%d of 40 notes kept", got)
	}
	// A link to the record as it was still holds it after the next note:
	// the record is replaced whole, never written over in place.
	old := Path(root) + ".old"
	if err := os.Link(Path(root), old); err != nil {
		t.Skipf("no hard links here: %v", err)
	}
	if err := Note(root, You, now, "late"); err != nil {
		t.Fatal(err)
	}
	if Load(old).Why("late", now) != "" {
		t.Error("the record was written in place")
	}
	if fi, err := os.Stat(Path(root)); err == nil && runtime.GOOS != "windows" && fi.Mode().Perm() != 0o600 {
		t.Errorf("the record is %v, want 0600", fi.Mode().Perm())
	}
}
