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

func TestHolds(t *testing.T) {
	// systemd-resolved's stub on 127.0.0.53:53, and a wildcard listener on 80.
	tcp := `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 3500007F:0035 00000000:0000 0A 00000000:00000000 00:00000000 00000000   991        0 1 1 0000000000000000 100 0 0 10 5
   1: 00000000:0050 00000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 2 1 0000000000000000 100 0 0 10 0
   2: 0100007F:1F90 0100007F:9C40 01 00000000:00000000 00:00000000 00000000  1000        0 3 1 0000000000000000 20 4 30 10 -1
`
	for _, c := range []struct {
		ip   string
		port int
		want bool
	}{
		{"0.0.0.0", 53, true},       // a wildcard bind collides with the stub
		{"192.168.1.10", 53, false}, // the LAN address does not
		{"127.0.0.53", 53, true},
		{"192.168.1.10", 80, true}, // anything collides with a wildcard listener
		{"0.0.0.0", 443, false},
		{"0.0.0.0", 8080, false}, // an established connection, not a listener
	} {
		if got := holds(tcp, c.ip, c.port, true); got != c.want {
			t.Errorf("%s:%d: %v, want %v", c.ip, c.port, got, c.want)
		}
	}
	udp6 := `  sl  local_address                         remote_address                        st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode ref pointer drops
  0: 00000000000000000000000000000000:0035 00000000000000000000000000000000:0000 07 00000000:00000000 00:00000000 00000000     0        0 4 2 0000000000000000 0
`
	if !holds(udp6, "0.0.0.0", 53, false) || holds(udp6, "0.0.0.0", 54, false) {
		t.Error("udp6 wildcard on 53")
	}
}
