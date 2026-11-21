package wiring

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// Where Prowlarr is reached comes from where its container runs, not from
// the setting alone (the owner's Nov 21 screenshot: "Prowlarr URL is
// invalid, Sonarr cannot connect to Prowlarr"). With the ProtonVPN key set,
// searching through the VPN is on, but a Prowlarr made before that (or
// before the key) still has its own network until it is made again: Sonarr
// must reach it at prowlarr:9696, and the privacy line must not say its
// searches go through the VPN. A Prowlarr left on the network of a Gluetun
// that was since made again has no network at all: it's said, in words.
func TestProwlarrAddressFollowsItsContainer(t *testing.T) {
	c, err := catalog.Load(filepath.Join("..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	project := func(id string) string { a, _ := c.Get(id); return a.Project() }
	ctr := func(id, cid, mode string) docker.Container {
		return docker.Container{ID: cid, Name: id, Running: true, NetworkMode: mode,
			Labels: map[string]string{"com.docker.compose.project": project(id), "com.docker.compose.service": id}}
	}
	env := map[string]string{"PROTONVPN_WIREGUARD_PRIVATE_KEY": "k"}
	gluetun := ctr("gluetun", "g1d", "homelab")
	for _, tc := range []struct {
		name, mode, want string
		stale            bool
	}{
		{"its own network", "homelab", "http://prowlarr:9696", false},
		{"in Gluetun's network", "container:g1d", "http://gluetun:9696", false},
		{"on a Gluetun since made again", "container:old", "http://gluetun:9696", true},
		{"not known (an older engine)", "", "http://gluetun:9696", false},
	} {
		w := New(c, []docker.Container{gluetun, ctr("prowlarr", "p1", tc.mode)}, env, t.TempDir())
		if got := w.Apps["prowlarr"].Internal; got != tc.want {
			t.Errorf("%s: prowlarr at %s, want %s", tc.name, got, tc.want)
		}
		if got := w.Apps["prowlarr"].Stale != ""; got != tc.stale {
			t.Errorf("%s: stale %v, want %v", tc.name, got, tc.stale)
		}
	}
	// Its own network: the privacy line says the searches leave from home.
	w := New(c, []docker.Container{gluetun, ctr("prowlarr", "p1", "homelab")}, env, t.TempDir())
	if s := w.searchPrivate(); !strings.Contains(s, "home connection") || !strings.Contains(s, "start") {
		t.Errorf("search line: %q", s)
	}
}
