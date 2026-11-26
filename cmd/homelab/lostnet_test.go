package main

import (
	"os"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// An app in another container's network whose container was made anew
// (Gluetun after an update) can't simply start: Docker looks for the old
// one. Start makes it again instead; the others start as before.
func TestStartRemakesLostNetwork(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_media_automation-sonarr-1", Image: "x", Project: "homelab_media_automation", Service: "sonarr"},
		{Name: "homelab_media_automation-prowlarr-1", Image: "x", Project: "homelab_media_automation", Service: "prowlarr", NetworkMode: "container:cd2425abc947"},
		{Name: "homelab_media_automation-radarr-1", Image: "x", Project: "homelab_media_automation", Service: "radarr", NetworkMode: "container:id0"},
	})
	root, _ := repoCopy(t)
	if out, code := homelabCmd(t, root, "", "start", "prowlarr", "sonarr", "radarr", "--apply"); code != 0 {
		t.Fatalf("start (exit %d):\n%s", code, out)
	}
	data, err := os.ReadFile(calls)
	if err != nil {
		t.Fatal(err)
	}
	log := string(data)
	var up, start string
	for _, line := range strings.Split(log, "\n") {
		if strings.Contains(line, " up --detach --force-recreate") {
			up = line
		}
		if strings.Contains(line, " start ") {
			start = line
		}
	}
	if !strings.HasSuffix(up, " prowlarr") {
		t.Errorf("prowlarr not made again:\n%s", log)
	}
	if !strings.Contains(start, "sonarr") || !strings.Contains(start, "radarr") || strings.Contains(start, "prowlarr") {
		t.Errorf("start should be sonarr and radarr only: %q", start)
	}
}

func TestLostNetwork(t *testing.T) {
	c := func(id, name, svc, mode string) docker.Container {
		return docker.Container{ID: id, Name: name, NetworkMode: mode, Labels: map[string]string{"com.docker.compose.project": "p", "com.docker.compose.service": svc}}
	}
	cs := []docker.Container{
		c("aaaa1111", "gluetun", "gluetun", "homelab"),
		c("bbbb", "q", "qbittorrent", "container:aaaa1111"),
		c("cccc", "s", "sabnzbd", "container:aaaa"),
		c("dddd", "pr", "prowlarr", "container:ffff"),
		c("eeee", "n", "named", "container:gluetun"),
	}
	got := lostNetwork(cs, "p")
	if len(got) != 1 || !got["prowlarr"] {
		t.Fatalf("lost: %v", got)
	}
	if got := lostNetwork(cs, "other"); len(got) != 0 {
		t.Fatalf("other project: %v", got)
	}
}
