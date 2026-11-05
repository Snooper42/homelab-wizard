package started

import (
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
