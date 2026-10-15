package selector

import (
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
)

func load(t *testing.T) *catalog.Catalog {
	t.Helper()
	_, file, _, _ := runtime.Caller(0)
	c, err := catalog.Load(filepath.Join(filepath.Dir(file), "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func TestUserExample(t *testing.T) {
	// "only qbittorrent, overseerr, and the *-arr stack"
	sel, err := Resolve(load(t), []string{"qbittorrent", "overseerr", "*-arr"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"qbittorrent", "gluetun", "seerr", "sonarr", "radarr", "prowlarr", "lidarr", "bazarr", "flaresolverr"} {
		if !sel.Has(want) {
			t.Errorf("selection is missing %s: %v", want, sel.IDs())
		}
	}
	for _, unwanted := range []string{"navidrome", "homarr", "lazylibrarian", "immich-server"} {
		if sel.Has(unwanted) {
			t.Errorf("selection should not include %s", unwanted)
		}
	}
	if sel.RequiredBy["gluetun"] != "qbittorrent" {
		t.Errorf("gluetun should be pulled in by qbittorrent: %v", sel.RequiredBy)
	}
	found := false
	for _, n := range sel.Notes {
		if strings.Contains(n, "overseerr is provided by seerr") {
			found = true
		}
	}
	if !found {
		t.Errorf("expected alias note, got %v", sel.Notes)
	}
}

func TestDependenciesComeFirst(t *testing.T) {
	sel, err := Resolve(load(t), []string{"moneymatter", "immich"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	pos := map[string]int{}
	for i, id := range sel.IDs() {
		pos[id] = i
	}
	if pos["moneymatter-db"] > pos["moneymatter-backend"] || pos["moneymatter-backend"] > pos["moneymatter-frontend"] || pos["immich-database"] > pos["immich-server"] {
		t.Fatalf("dependencies must come first: %v", sel.IDs())
	}
}

func TestGlobsAreLiteral(t *testing.T) {
	sel, err := Resolve(load(t), []string{"*arr"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	// A plain glob matches ids literally, dashboards included.
	if !sel.Has("homarr") || !sel.Has("sonarr") {
		t.Fatalf("*arr: %v", sel.IDs())
	}
}

func TestBundleCategoryAndExclude(t *testing.T) {
	c := load(t)
	sel, err := Resolve(c, []string{"@arr"}, []string{"lidarr"})
	if err != nil {
		t.Fatal(err)
	}
	if sel.Has("lidarr") || !sel.Has("sonarr") {
		t.Fatalf("bundle/exclude: %v", sel.IDs())
	}
	sel, err = Resolve(c, []string{"cat:media-automation"}, []string{"qbittorrent"})
	if err != nil {
		t.Fatal(err)
	}
	if !sel.Has("seerr") || sel.Has("qbittorrent") || !sel.Has("gluetun") {
		t.Fatalf("category: %v", sel.IDs())
	}
}

func TestErrors(t *testing.T) {
	c := load(t)
	if _, err := Resolve(c, []string{"sonar"}, nil); err == nil || !strings.Contains(err.Error(), "did you mean sonarr") {
		t.Fatalf("expected suggestion, got %v", err)
	}
	if _, err := Resolve(c, []string{"qbittorrent"}, []string{"gluetun"}); err == nil || !strings.Contains(err.Error(), "excluded") {
		t.Fatalf("excluding a required dependency should fail, got %v", err)
	}
	if _, err := Resolve(c, []string{"@nope"}, nil); err == nil {
		t.Fatal("unknown bundle should fail")
	}
}
