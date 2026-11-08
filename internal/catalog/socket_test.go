package catalog

import (
	"slices"
	"strings"
	"testing"
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
