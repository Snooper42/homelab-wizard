package downloads

import (
	"strings"
	"testing"
)

// The drive's warning goes to the phone once at 85% and once at 95%, not on
// every pass; a drive hovering at a threshold isn't said again, and one
// that was cleared well below it is said again when it fills.
func TestDriveAlertSaysEachThresholdOnce(t *testing.T) {
	told := 0
	step := func(used int) string {
		t.Helper()
		said, next := DriveAlert(drive(used), told)
		told = next
		return said
	}
	if s := step(60); s != "" {
		t.Errorf("60%%: said %q", s)
	}
	if s := step(86); s != "The media drive is 86% full: room for about 35 more films." {
		t.Errorf("86%%: said %q", s)
	}
	for _, used := range []int{86, 84, 87, 82, 85} { // hovering: said once
		if s := step(used); s != "" {
			t.Errorf("%d%% again: said %q", used, s)
		}
	}
	if s := step(96); !strings.HasPrefix(s, "The media drive is almost full (96%)") {
		t.Errorf("96%%: said %q", s)
	}
	for _, used := range []int{94, 96, 91} {
		if s := step(used); s != "" {
			t.Errorf("%d%% after 95: said %q", used, s)
		}
	}
	// Cleared to 70%, then filling again: each threshold is said again.
	if s := step(70); s != "" || told != 0 {
		t.Errorf("70%%: said %q, told %d", s, told)
	}
	if s := step(85); s == "" {
		t.Error("85% after clearing: not said")
	}
	if s := step(89); s != "" || told != warnAt {
		t.Errorf("89%%: said %q, told %d", s, told)
	}
	// Straight past both: the 95% warning, once.
	told = 0
	if s := step(97); !strings.Contains(s, "almost full") || told != fullAt {
		t.Errorf("0 to 97%%: said %q, told %d", s, told)
	}
	// A drive that can't be read (unplugged) keeps what was said.
	if s, next := DriveAlert(nil, fullAt); s != "" || next != fullAt {
		t.Errorf("unread: said %q, told %d", s, next)
	}
}

// A wall screen, which anyone walking past can read, gets the card without
// what's being downloaded: the counts, each item's state and the drive.
func TestCardWithoutNames(t *testing.T) {
	c := Build(Readings{Apps: true, Volumes: drive(40), Records: []Record{{App: "Radarr", Name: "A Film (2024)", DownloadID: "A", Status: "downloading", Size: 10, Left: 5}},
		Requests: []Request{{App: "Radarr", Name: "Another Film", Age: 2 * notFoundAfter, Read: true}}})
	w := c.WithoutNames()
	if w.Line != c.Line || len(w.Items) != 2 || w.Drive == nil {
		t.Fatalf("WithoutNames dropped more than names: %+v", w)
	}
	for _, it := range w.Items {
		if it.Name != "" || it.State == "" || it.App != "Radarr" {
			t.Errorf("item %+v", it)
		}
	}
	if c.Items[0].Name == "" {
		t.Error("WithoutNames changed the card it was given")
	}
}
