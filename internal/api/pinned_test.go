package api

import (
	"os"
	"slices"
	"strings"
	"testing"
)

// The pinned apps are a record in data/ (pinned.json), in the order
// pinned; a list still in .env from before counts too.
func TestPinned(t *testing.T) {
	for _, tc := range []struct {
		name, was, app string
		pin            bool
		want           string
	}{
		{"the first", "", "immich", true, "immich"},
		{"after those pinned before", "immich,jellyfin", "vikunja", true, "immich,jellyfin,vikunja"},
		{"again: moves to the end", "immich,jellyfin", "immich", true, "jellyfin,immich"},
		{"unpinned", "immich,jellyfin", "immich", false, "jellyfin"},
		{"unpinned, never pinned", "immich", "vikunja", false, "immich"},
		{"the last", "immich", "immich", false, ""},
	} {
		root := t.TempDir()
		for _, id := range strings.Split(tc.was, ",") {
			if id != "" {
				if err := SetPinned(root, id, true); err != nil {
					t.Fatal(err)
				}
			}
		}
		if err := SetPinned(root, tc.app, tc.pin); err != nil {
			t.Fatal(err)
		}
		if got := strings.Join(Pinned(root, nil), ","); got != tc.want {
			t.Errorf("%s: %q, want %q", tc.name, got, tc.want)
		}
		if _, err := os.Stat(PinnedPath(root)); err != nil {
			t.Errorf("%s: no record: %v", tc.name, err)
		}
	}
	if got := Pinned(t.TempDir(), map[string]string{}); len(got) != 0 {
		t.Errorf("none: %v", got)
	}
	// A hand-typed list in .env, from before the record: spaces, and twice.
	if got := Pinned("", map[string]string{PinnedKey: " a , ,b,a"}); !slices.Equal(got, []string{"a", "b"}) {
		t.Errorf("read: %v", got)
	}
}
