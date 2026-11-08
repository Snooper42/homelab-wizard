package main

import (
	"os"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/stopped"
)

func TestRestartsWithin(t *testing.T) {
	now := time.Date(2026, 11, 5, 12, 0, 0, 0, time.UTC)
	ago := func(m int) time.Time { return now.Add(-time.Duration(m) * time.Minute) }
	for _, c := range []struct {
		name  string
		seen  []restartSeen
		count int
		want  int
		kept  int
	}{
		{"first look", nil, 7, 0, 1},
		{"three in the hour", []restartSeen{{ago(30), 2}, {ago(15), 4}}, 5, 3, 3},
		{"older than the hour", []restartSeen{{ago(75), 0}, {ago(45), 4}}, 5, 1, 2},
		{"a new container", []restartSeen{{ago(30), 9}}, 1, 0, 1},
		{"none since", []restartSeen{{ago(15), 4}}, 4, 0, 2},
	} {
		n, kept := restartsWithin(c.seen, c.count, now)
		if n != c.want || len(kept) != c.kept {
			t.Errorf("%s: %d restarts, %d kept; want %d, %d", c.name, n, len(kept), c.want, c.kept)
		}
	}
}

func TestSettled(t *testing.T) {
	now := time.Now()
	up := docker.Container{Running: true, State: "running", StartedAt: now.Add(-time.Hour)}
	if !settled(up, now) {
		t.Error("an app up an hour is not settled")
	}
	for name, c := range map[string]docker.Container{
		"between restarts": {Running: true, State: "restarting", StartedAt: now.Add(-time.Hour)},
		"just started":     {Running: true, State: "running", StartedAt: now.Add(-10 * time.Second)},
		"unhealthy":        {Running: true, State: "running", Health: "unhealthy", StartedAt: now.Add(-time.Hour)},
	} {
		if settled(c, now) {
			t.Errorf("%s reads as settled", name)
		}
	}
}

// restartLoop runs the watchdog twice over ntfy restarting by itself, its
// restart count rising from 1 to after, and returns the calls and the second
// run's output.
func restartLoop(t *testing.T, after int, status string, env ...string) (root, calls, out string) {
	t.Helper()
	ntfy := func(n int) []docker.FakeContainer {
		return []docker.FakeContainer{{Name: "homelab_security-ntfy-1", Image: "binwiederhier/ntfy:latest", Running: true, Status: status, Project: "homelab_security", Service: "ntfy", Restarts: n}}
	}
	fakeDocker(t, ntfy(1))
	root, _ = repoCopy(t, append([]string{"UPDATES_PAUSED=true", "TUNNEL_TOKEN="}, env...)...)
	homelabCmd(t, root, "", "watchdog")
	calls = fakeDocker(t, ntfy(after))
	out, _ = homelabCmd(t, root, "", "watchdog")
	return root, calls, out
}

func TestWatchdogStopsARestartLoop(t *testing.T) {
	const secret = "hunter2-correct-horse"
	t.Setenv("FAKE_LOG_SECRET", secret)
	root, calls, out := restartLoop(t, 5, "restarting", "NTFY_ADMIN_PASSWORD="+secret)
	if n := strings.Count(readCalls(t, calls), " stop ntfy"); n != 1 {
		t.Fatalf("stopped %d times, want once:\n%s", n, out)
	}
	if !strings.Contains(out, "Docker restarted it 4 times in an hour") || !strings.Contains(out, "could not open the database") {
		t.Errorf("did not say why, with its last lines:\n%s", out)
	}
	if strings.Contains(out, secret) || !strings.Contains(out, "[redacted") {
		t.Errorf("its log's secret was not taken out:\n%s", out)
	}
	if strings.Contains(out, "ntfy: keeps restarting") {
		t.Errorf("still a failing check once stopped:\n%s", out)
	}
	s := stopped.Load(stopped.Path(root))["ntfy"]
	if s.Why != stopped.KeptRestarting || s.Restarts != 4 || s.Since.IsZero() || !s.Until.IsZero() {
		t.Errorf("not kept as stopped by the watchdog: %+v", s)
	}
	// The counts are written whole, this account's alone.
	if info, err := os.Stat(restartsPath(root)); err != nil || runtime.GOOS != "windows" && info.Mode().Perm() != 0o600 {
		t.Errorf("restarts.json: %v %v", info, err)
	}
	// Kept stopped: the next run leaves it, whatever Docker says meanwhile.
	homelabCmd(t, root, "", "watchdog")
	if n := strings.Count(readCalls(t, calls), " stop ntfy"); n != 1 {
		t.Errorf("stopped again (%d)", n)
	}
}

func TestWatchdogLeavesASettledRestart(t *testing.T) {
	// Restarted while its database started, and running since.
	_, calls, out := restartLoop(t, 5, "")
	if strings.Contains(readCalls(t, calls), " stop ntfy") {
		t.Errorf("stopped an app that runs again:\n%s", out)
	}
}

func TestWatchdogLeavesRestartsBelowThree(t *testing.T) {
	_, calls, out := restartLoop(t, 3, "restarting")
	if strings.Contains(readCalls(t, calls), " stop ntfy") {
		t.Errorf("stopped after two restarts:\n%s", out)
	}
}

func TestWatchdogLeavesRestartLoopsWhenAsked(t *testing.T) {
	_, calls, out := restartLoop(t, 5, "restarting", "AUTO_HEAL=false")
	if strings.Contains(readCalls(t, calls), " stop ntfy") {
		t.Errorf("stopped with AUTO_HEAL=false:\n%s", out)
	}
}
