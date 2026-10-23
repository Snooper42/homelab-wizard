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

func TestFixRecreatesAppsWithChangedSettings(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-ntfy-1", Image: "binwiederhier/ntfy:latest", Running: true, Health: "healthy", Project: "homelab_security", Service: "ntfy", ConfigHash: "old"},
		{Name: "homelab_security-vaultwarden-1", Image: "vaultwarden/server:latest", Running: true, Health: "healthy", Project: "homelab_security", Service: "vaultwarden", ConfigHash: "same"},
	})
	t.Setenv("FAKE_CONFIG_HASHES", "ntfy new\\nvaultwarden same\\n")
	root, _ := repoCopy(t, "UPDATES_PAUSED=true", "TUNNEL_TOKEN=")
	out, _ := homelabCmd(t, root, "", "status")
	if !strings.Contains(out, "settings changed") || !strings.Contains(out, "1 app(s) still run the settings they started with") {
		t.Errorf("status:\n%s", out)
	}
	out, _ = homelabCmd(t, root, "", "fix", "--apply")
	if !strings.Contains(out, "recreate the apps whose settings changed since they started, so they use them: ntfy") {
		t.Errorf("fix plan:\n%s", out)
	}
	if log := readCalls(t, calls); !strings.Contains(log, "up --detach --no-deps ntfy") || strings.Contains(log, "--no-deps vaultwarden") {
		t.Errorf("recreated:\n%s", log)
	}
}
