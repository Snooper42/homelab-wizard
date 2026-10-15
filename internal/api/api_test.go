package api

import (
	"path/filepath"
	"runtime"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
)

func TestCatalogCarriesWhatAppsReplace(t *testing.T) {
	_, file, _, _ := runtime.Caller(0)
	c, err := catalog.Load(filepath.Join(filepath.Dir(file), "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	got := map[string][]string{}
	for _, a := range CatalogOf(c).Apps {
		got[a.ID] = a.Replaces
	}
	if r := got["immich-server"]; len(r) != 1 || r[0] != "iCloud+ 2 TB" {
		t.Errorf("immich: %v", r)
	}
	if len(got["jellyfin"]) < 5 || len(got["watchtower"]) != 0 {
		t.Errorf("jellyfin %v, watchtower %v", got["jellyfin"], got["watchtower"])
	}
}

func TestPresetsAreBundlesAndStacks(t *testing.T) {
	_, file, _, _ := runtime.Caller(0)
	c, err := catalog.Load(filepath.Join(filepath.Dir(file), "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]Preset{}
	var starters []string
	for _, p := range CatalogOf(c).Presets {
		if _, dup := got[p.ID]; dup {
			t.Errorf("preset %s twice", p.ID)
		}
		got[p.ID] = p
		if p.Starter {
			starters = append(starters, p.Name)
		}
	}
	if p := got["stack:immich"]; len(p.Apps) != 1 || p.Apps[0] != "immich-server" {
		t.Errorf("immich stack: %+v", p)
	}
	if _, ok := got["stack:homelab-setup"]; ok {
		t.Error("a category file became a stack preset")
	}
	if len(starters) != 5 || starters[0] != "Photos" {
		t.Errorf("starters: %v", starters)
	}
}
