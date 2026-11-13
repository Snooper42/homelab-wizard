package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/people"
)

// Send to my phone: the phones a page can go to (never a wall screen; a
// member's with their own apps), and a send only to one that may see it.
func TestSendToPhone(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "data"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := people.Save(people.Path(root), []people.Person{{Username: "anna", Name: "Anna", Apps: []string{"immich-server"}}}); err != nil {
		t.Fatal(err)
	}
	store := companion.NewStore(companion.StorePath(root))
	pair := func(name string, finances string) companion.Device {
		code, err := store.NewPairing(name, true, finances)
		if err != nil {
			t.Fatal(err)
		}
		d, _, err := store.Pair(code, "")
		if err != nil {
			t.Fatal(err)
		}
		return d
	}
	sam := pair("Sam's iPhone", companion.FinancesEdit)
	ipad := pair("The iPad", "")
	wall := pair("Kitchen", "")
	if _, err := store.MarkKiosk(wall.ID); err != nil {
		t.Fatal(err)
	}
	anna := pair("Anna's iPhone", "")
	if _, err := store.SetPerson(anna.ID, "anna", "Anna"); err != nil {
		t.Fatal(err)
	}
	a := &App{root: root}
	var names []string
	for _, x := range a.SendTargets() {
		names = append(names, x.Name)
		switch x.Name {
		case "Sam's iPhone":
			if !x.Finances || x.Member {
				t.Errorf("Sam's iPhone: %+v", x)
			}
		case "The iPad":
			if x.Finances {
				t.Errorf("the iPad sees no Finances: %+v", x)
			}
		case "Anna's iPhone":
			if !x.Member || x.Finances || strings.Join(x.Apps, ",") != "immich-server" {
				t.Errorf("Anna's iPhone: %+v", x)
			}
		}
	}
	if strings.Join(names, "|") != "Sam's iPhone|The iPad|Anna's iPhone" {
		t.Errorf("targets: %v (a wall screen is never one)", names)
	}
	for _, c := range []struct {
		d    companion.Device
		link string
		ok   bool
	}{
		{sam, "homelab://finances/recurring", true}, {ipad, "homelab://app/vikunja", true},
		{ipad, "homelab://finances", false}, {wall, "homelab://status", false},
		{anna, "homelab://app/immich-server", true}, {anna, "homelab://app/vikunja", false},
		{sam, "https://example.com", false}, {companion.Device{ID: "gone"}, "homelab://status", false},
	} {
		if err := a.SendToPhone(c.d.ID, c.link, "A page"); (err == nil) != c.ok {
			t.Errorf("%s, %s: %v", c.d.Name, c.link, err)
		}
	}
	left, _ := os.ReadDir(companion.SentDir(root))
	if len(left) != 3 {
		t.Errorf("%d sends left for the companion, not 3", len(left))
	}
}
