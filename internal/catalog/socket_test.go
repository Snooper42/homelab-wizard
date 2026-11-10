package catalog

import (
	"os"
	"slices"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

// Whatever mounts Docker's socket controls the computer, read-only mount
// or not (docs/Security.md, Docker socket): whoever controls its image
// would too. So it is pinned to a version and updated by hand after
// reading its notes, never by the nightly update (M6).
func TestWhatHoldsTheDockerSocketIsPinned(t *testing.T) {
	n := 0
	for _, a := range load(t).Apps {
		holds := false
		for _, v := range a.Volumes {
			holds = holds || strings.HasSuffix(strings.SplitN(v.Target, ":", 2)[0], "docker.sock")
		}
		if !holds {
			continue
		}
		n++
		if a.Meta.Pin == "" {
			t.Errorf("%s holds Docker's socket but the nightly update takes it (no x-homelab pin)", a.ID)
		}
		if tag := a.Image[strings.LastIndex(a.Image, ":")+1:]; !strings.Contains(a.Image, ":") || tag == "latest" || !strings.Contains(tag, "_VERSION") && !strings.ContainsAny(tag, "0123456789") {
			t.Errorf("%s holds Docker's socket on a moving tag: %s", a.ID, a.Image)
		}
	}
	if n < 2 {
		t.Errorf("only %d apps hold Docker's socket: the test no longer sees the volumes", n)
	}
}

// N27: docker-socket-proxy answers any GET under /containers, so whoever
// reaches it reads every container's environment (their passwords and
// keys, GET /containers/{id}/json) and files (/archive, /export). Read-only
// is not harmless. So it is on a network of its own with the apps that
// read it, never on the shared homelab network every app joins.
func TestTheSocketProxyIsOnlyForItsReaders(t *testing.T) {
	c := load(t)
	proxy, ok := c.Get("docker-socket-proxy")
	if !ok {
		t.Fatal("no docker-socket-proxy in the catalog")
	}
	if joins(proxy, "homelab") {
		t.Errorf("docker-socket-proxy is on the shared homelab network, where every app can ask it for every container's secrets")
	}
	nets := proxy.Networks
	if len(nets) == 0 {
		nets = []string{"default"}
	}
	// Homepage reads it only when the household adds it to docker.yaml.
	readers := map[string]bool{"homepage": true}
	for _, a := range c.Apps {
		if a.ID == proxy.ID || a.File != proxy.File {
			continue
		}
		shares := false
		for _, n := range nets {
			shares = shares || joins(a, n) || len(a.Networks) == 0 && n == "default"
		}
		if !shares {
			continue
		}
		if !slices.Contains(a.DependsOn, proxy.ID) && !readers[a.ID] {
			t.Errorf("%s shares docker-socket-proxy's network but does not read it", a.ID)
		}
	}
}

// Backlog item 60: an app's database (Postgres, MariaDB, Redis or Valkey,
// Meilisearch, ...) answers whoever reaches it, often with a password every
// app of that stack shares, so it sits on its own stack's network and never
// on the shared homelab network every app joins.
func TestDatabasesStayOffTheSharedNetwork(t *testing.T) {
	n := 0
	for _, a := range load(t).Apps {
		img := strings.ToLower(a.Image)
		db := false
		for _, k := range []string{"postgres", "mariadb", "mysql", "redis", "valkey", "mongo", "meilisearch", "clickhouse", "memcached", "elasticsearch", "couchdb", "influxdb"} {
			db = db || strings.Contains(img, k)
		}
		if !db {
			continue
		}
		n++
		if joins(a, "homelab") {
			t.Errorf("%s (%s) is on the shared homelab network, where every app can reach it", a.ID, a.Image)
		}
	}
	if n < 10 {
		t.Errorf("only %d databases found: the test no longer sees them", n)
	}
}

// Backlog item 58: an app with no sign-in of its own (local: Dozzle, with
// every container's logs, and beets) listens on this computer only, even
// when Settings › Apps listen on (BIND_IP) is set to the home network's
// address; otherwise anyone on the Wi-Fi could open it.
func TestAppsWithoutASignInListenOnThisComputerOnly(t *testing.T) {
	n := 0
	for _, a := range load(t).Apps {
		if !a.Meta.Local {
			continue
		}
		n++
		for _, p := range a.Ports {
			if p.HostIP != "127.0.0.1" {
				t.Errorf("%s has no sign-in of its own, but its port %q listens on %q", a.ID, p.Raw, p.HostIP)
			}
		}
	}
	if n < 2 {
		t.Errorf("only %d apps without a sign-in found: the test no longer sees them", n)
	}
}

// Backlog item 66: Dozzle shows every container's logs without a sign-in,
// and logs can hold secrets (L1). It needs no proxy host (local), so it is
// on no network every app joins: only the socket proxy's and its own.
func TestDozzleIsNotOnTheSharedNetwork(t *testing.T) {
	d, ok := load(t).Get("dozzle")
	if !ok {
		t.Fatal("no dozzle in the catalog")
	}
	if joins(d, "homelab") {
		t.Errorf("dozzle is on the shared homelab network, where every app can read every log at dozzle:8080")
	}
	if !joins(d, "socket") {
		t.Errorf("dozzle can't reach the socket proxy: %v", d.Networks)
	}
}

// Gluetun's control server (:8000) gives the VPN's public address and
// forwarded port, and stops or starts the VPN; its auth depends on the
// version, and the image floats. qBittorrent shares its network, so it is
// kept to Gluetun's own loopback, out of reach of every other app on the
// shared network (backlog item 72).
func TestGluetunsControlServerIsItsOwn(t *testing.T) {
	g, ok := load(t).Get("gluetun")
	if !ok {
		t.Fatal("no gluetun in the catalog")
	}
	raw, err := os.ReadFile(g.Source)
	if err != nil {
		t.Fatal(err)
	}
	var f struct {
		Services map[string]struct {
			Environment map[string]string `yaml:"environment"`
		} `yaml:"services"`
	}
	if err := yaml.Unmarshal(raw, &f); err != nil {
		t.Fatal(err)
	}
	addr := f.Services["gluetun"].Environment["HTTP_CONTROL_SERVER_ADDRESS"]
	if !strings.HasPrefix(addr, "127.0.0.1:") {
		t.Errorf("Gluetun's control server listens on %q: every app on the shared network can stop the VPN or read its address; set HTTP_CONTROL_SERVER_ADDRESS to 127.0.0.1:8000", addr)
	}
}

// An app with no sign-in of its own (local: true) answers whoever reaches
// it, so beyond this computer's own port it is on no network another app
// shares: never the shared homelab network, where every app could read it
// (backlog item 78; Dozzle was N36, beets after it).
func TestAppsWithoutASignInAreOnNoSharedNetwork(t *testing.T) {
	n := 0
	for _, a := range load(t).Apps {
		if !a.Local() {
			continue
		}
		n++
		if a.NetworkMode != "" || joins(a, "homelab") {
			t.Errorf("%s has no sign-in but is on the shared homelab network (%v %s): every app there can open it", a.ID, a.Networks, a.NetworkMode)
		}
	}
	if n < 2 {
		t.Errorf("only %d apps without a sign-in: the test no longer sees them", n)
	}
}
