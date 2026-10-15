package ui

import (
	"bytes"
	"reflect"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
)

func TestParsePick(t *testing.T) {
	var items []PickerItem
	for _, id := range []string{"sonarr", "radarr", "lidarr", "plex"} {
		items = append(items, PickerItem{App: &catalog.App{Service: &compose.Service{ID: id}}})
	}
	got, err := ParsePick("1, 2-3 overseerr *arr @media", items)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"sonarr", "radarr", "lidarr", "overseerr", "*arr", "@media"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v want %v", got, want)
	}
	if _, err := ParsePick("9", items); err == nil {
		t.Fatal("out-of-range number should fail")
	}
}

func TestTableAlignsColoredCells(t *testing.T) {
	var out bytes.Buffer
	u := &UI{Out: &out, Color: true}
	u.Table([]string{"APP", "STATE", "URL"}, [][]string{
		{"vaultwarden", u.Cyan("elsewhere"), "x"},
		{"ntfy", u.Green("running"), "y"},
		{"jellyfin", "", "z"},
	})
	var cols []int
	for _, line := range strings.Split(strings.TrimRight(out.String(), "\n"), "\n") {
		plain := ansi.ReplaceAllString(line, "")
		cols = append(cols, strings.LastIndex(plain, " ")+1)
	}
	for _, c := range cols {
		if c != cols[0] {
			t.Fatalf("last column starts at %v:\n%s", cols, ansi.ReplaceAllString(out.String(), ""))
		}
	}
}
