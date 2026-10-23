package main

import (
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/docker"
)

func TestWatchdogRestartsAHungApp(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-vaultwarden-1", Image: "vaultwarden/server:latest", Running: true, Health: "unhealthy", Project: "homelab_security", Service: "vaultwarden"},
	})
	root, _ := repoCopy(t, "UPDATES_PAUSED=true", "TUNNEL_TOKEN=")
	restarts := func() int { return strings.Count(readCalls(t, calls), "restart vaultwarden") }

	homelabCmd(t, root, "", "watchdog")
	if n := restarts(); n != 0 {
		t.Fatalf("restarted after one failing check (%d)", n)
	}
	out, _ := homelabCmd(t, root, "", "watchdog")
	if n := restarts(); n != 1 || !strings.Contains(out, "restarted Vaultwarden (container unhealthy), unwell on two checks in a row") {
		t.Fatalf("not restarted once on the second failing check (%d):\n%s", n, out)
	}
	homelabCmd(t, root, "", "watchdog")
	if n := restarts(); n != 1 {
		t.Errorf("restarted again within 6 hours (%d)", n)
	}
}

func TestWatchdogLeavesACrashLoop(t *testing.T) {
	// Docker restarts it already; another restart does not help.
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-ntfy-1", Image: "binwiederhier/ntfy:latest", Running: true, Status: "restarting", Health: "starting", Project: "homelab_security", Service: "ntfy"},
	})
	root, _ := repoCopy(t, "UPDATES_PAUSED=true", "TUNNEL_TOKEN=")
	homelabCmd(t, root, "", "watchdog")
	homelabCmd(t, root, "", "watchdog")
	if strings.Contains(readCalls(t, calls), "restart ntfy") {
		t.Error("restarted an app in a crash loop")
	}
}

func TestWatchdogHealsOnlyWhenAllowed(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-vaultwarden-1", Image: "vaultwarden/server:latest", Running: true, Health: "unhealthy", Project: "homelab_security", Service: "vaultwarden"},
	})
	root, _ := repoCopy(t, "UPDATES_PAUSED=true", "TUNNEL_TOKEN=", "AUTO_HEAL=false")
	homelabCmd(t, root, "", "watchdog")
	homelabCmd(t, root, "", "watchdog")
	if strings.Contains(readCalls(t, calls), "restart vaultwarden") {
		t.Error("restarted with AUTO_HEAL=false")
	}
}
