package api

import (
	"slices"
	"testing"
)

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
		{"a hand-typed list, spaces and twice", " immich , ,immich,jellyfin", "vikunja", true, "immich,jellyfin,vikunja"},
	} {
		if got := SetPinned(map[string]string{PinnedKey: tc.was}, tc.app, tc.pin); got != tc.want {
			t.Errorf("%s: %q, want %q", tc.name, got, tc.want)
		}
	}
	if got := Pinned(map[string]string{}); len(got) != 0 {
		t.Errorf("none: %v", got)
	}
	if got := Pinned(map[string]string{PinnedKey: "a, b,a"}); !slices.Equal(got, []string{"a", "b"}) {
		t.Errorf("read: %v", got)
	}
}
