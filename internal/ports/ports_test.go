package ports

import (
	"context"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/selector"
)

type fakeProber map[int]bool // ports in use

func (f fakeProber) Free(_ string, port int, _ string) bool { return !f[port] }

func setup(t *testing.T, ctrs []docker.FakeContainer) (*catalog.Catalog, *detect.Report) {
	t.Helper()
	_, file, _, _ := runtime.Caller(0)
	c, err := catalog.Load(filepath.Join(filepath.Dir(file), "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	list, err := (&docker.Client{Runner: &docker.FakeRunner{Containers: ctrs}, Bin: "docker"}).Containers(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return c, detect.Analyze(c, list)
}

func TestMovesConflictingPorts(t *testing.T) {
	c, report := setup(t, []docker.FakeContainer{
		// Someone else's container already uses Sonarr's default port.
		{Name: "other", Image: "nginx", Running: true, Ports: []docker.PublishedPort{{HostPort: 8989, Port: 80, Protocol: "tcp"}}},
	})
	sel, err := selector.Resolve(c, []string{"sonarr", "radarr"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	plan := Resolve(Input{Apps: sel.Apps, Env: map[string]string{}, Report: report, Prober: fakeProber{7878: true}})
	if len(plan.Problems) != 0 {
		t.Fatal(plan.Problems)
	}
	got := map[string]int{}
	for _, ch := range plan.Changes {
		got[ch.Var] = ch.To
	}
	if got["SONARR_PORT"] != 8990 || got["RADARR_PORT"] != 7879 {
		t.Fatalf("changes = %+v", plan.Changes)
	}
	if url := WebURL(sel.Apps[0], plan.Bindings, compose.MapLookup(nil)); url == "" {
		t.Fatal("expected a web URL")
	}
}

func TestRunningAppKeepsItsPort(t *testing.T) {
	c, report := setup(t, []docker.FakeContainer{
		{Name: "homelab_media_automation-sonarr-1", Image: "lscr.io/linuxserver/sonarr", Running: true, Project: "homelab_media_automation", Service: "sonarr",
			Ports: []docker.PublishedPort{{HostIP: "127.0.0.1", HostPort: 8989, Port: 8989, Protocol: "tcp"}}},
	})
	sonarr, _ := c.Get("sonarr")
	plan := Resolve(Input{Apps: []*catalog.App{sonarr}, Env: map[string]string{}, Report: report, Prober: fakeProber{8989: true}})
	if len(plan.Changes) != 0 || len(plan.Problems) != 0 {
		t.Fatalf("a running app must keep its own port: %+v %v", plan.Changes, plan.Problems)
	}
}

func TestFixedPortsAndSharedNetworkURLs(t *testing.T) {
	c, report := setup(t, nil)
	sel, err := selector.Resolve(c, []string{"adguard-home", "qbittorrent", "freshrss"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	// Something else already answers DNS on 53: AdGuard cannot move.
	plan := Resolve(Input{Apps: sel.Apps, Env: map[string]string{}, Report: report, Prober: fakeProber{53: true}})
	if len(plan.Problems) != 2 { // 53/tcp and 53/udp
		t.Fatalf("expected the fixed DNS port to be a problem, got %v", plan.Problems)
	}
	lookup := compose.MapLookup(nil)
	qb, _ := c.Get("qbittorrent")
	if url := WebURL(qb, plan.Bindings, lookup); url != "http://localhost:8082" {
		t.Fatalf("qBittorrent's UI is published by gluetun, got %q", url)
	}
	// AdGuard and FreshRSS both serve on container port 80; each gets its own URL.
	ag, _ := c.Get("adguard-home")
	fr, _ := c.Get("freshrss")
	if a, f := WebURL(ag, plan.Bindings, lookup), WebURL(fr, plan.Bindings, lookup); a != "http://localhost:3003" || f != "http://localhost:8085" {
		t.Fatalf("adguard %q, freshrss %q", a, f)
	}
}
