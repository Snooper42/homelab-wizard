package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/turn"
)

// Another process changing the homelab (the agent's nightly update, a
// phone's restart, the app) holds the turn: a Restart from here waits for
// it, says what for, and goes once it ends; a preview never waits.
func TestAChangeWaitsForAnotherProcesssTurn(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_media_automation-sonarr-1", Image: "x", Running: true, Health: "healthy", Project: "homelab_media_automation", Service: "sonarr"},
	})
	root, _ := repoCopy(t)
	t.Setenv(turn.Env, "")
	// This test's parent process runs: its ticket is one no one may skip.
	if err := os.MkdirAll(turn.Dir(root), 0o700); err != nil {
		t.Fatal(err)
	}
	at := time.Now().Add(-time.Minute)
	other := filepath.Join(turn.Dir(root), fmt.Sprintf("%020d-%d.json", at.UnixNano(), os.Getppid()))
	data, _ := json.Marshal(turn.Ticket{PID: os.Getppid(), What: "the nightly update", At: at, Host: hostnameForTest(t)})
	if err := os.WriteFile(other, data, 0o600); err != nil {
		t.Fatal(err)
	}

	// A preview goes straight away, beside it.
	start := time.Now()
	if out, code := homelabCmd(t, root, "", "update", "--all"); code != 0 || strings.Contains(out, "Waiting for") || time.Since(start) > 5*time.Second {
		t.Fatalf("a preview waited (exit %d, %v):\n%s", code, time.Since(start), out)
	}

	type result struct {
		out  string
		code int
	}
	done := make(chan result, 1)
	go func() {
		out, code := homelabCmd(t, root, "", "restart", "sonarr")
		done <- result{out, code}
	}()
	select {
	case r := <-done:
		t.Fatalf("restarted while the nightly update ran (exit %d):\n%s", r.code, r.out)
	case <-time.After(1500 * time.Millisecond):
	}
	if strings.Contains(readCalls(t, calls), "restart sonarr") {
		t.Fatal("Docker was asked to restart while the nightly update ran")
	}
	_ = os.Remove(other) // the nightly update ends
	r := <-done
	if r.code != 0 || !strings.Contains(r.out, "Waiting for “the nightly update” to finish first…") {
		t.Fatalf("restart (exit %d):\n%s", r.code, r.out)
	}
	if !strings.Contains(readCalls(t, calls), "restart sonarr") {
		t.Fatalf("not restarted after its turn:\n%s", readCalls(t, calls))
	}
	if q := turn.Queue(root); len(q) != 0 {
		t.Errorf("tickets left: %+v", q)
	}
}

// What another job waiting sees a command as.
func TestTurnWhat(t *testing.T) {
	root, _ := repoCopy(t)
	h, err := newHomelab(nil, root)
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range []struct {
		cmd  string
		args []string
		want string
	}{
		{"update", []string{"--all", "--nightly", "--apply"}, "the nightly update"},
		{"update", []string{"--all", "--apply"}, "Update all apps now"},
		{"restart", []string{"immich", "jellyfin"}, "Restarting Immich, Jellyfin"},
		{"backup", []string{"--apply"}, "a backup"},
		{"restore-test", []string{"--auto"}, "a restore test"},
		{"fix", []string{"--apply"}, "Fix it"},
		{"domain", []string{"setup", "--apply"}, "homelab domain"},
	} {
		if got := h.turnWhat(c.cmd, c.args); got != c.want {
			t.Errorf("%s %v: %q, want %q", c.cmd, c.args, got, c.want)
		}
	}
	for _, c := range []struct {
		cmd  string
		args []string
		want bool
	}{
		{"restart", []string{"immich"}, true},
		{"update", []string{"immich"}, true},
		{"update", []string{"--all"}, false},
		{"update", []string{"--all", "--apply"}, true},
		{"backup", nil, false},
		{"backup", []string{"--apply"}, true},
		{"fix", []string{"-y"}, true},
		{"restore-test", []string{"--auto"}, true},
		{"status", nil, false},
		{"media", []string{"inbox", "--apply"}, false},
		{"agent", nil, false},
		{"up", []string{"--apply"}, true},
		{"up", []string{"--apply", "--wait-media", "15m"}, false},
		{"up", []string{"--apply", "--wait-media=15m"}, false},
	} {
		if got := changes(c.cmd, c.args); got != c.want {
			t.Errorf("changes(%s %v) = %v, want %v", c.cmd, c.args, got, c.want)
		}
	}
}

// While another job changes the homelab (an update takes an app down and up
// again), the watchdog leaves its apps alone, and heals on a later round.
func TestWatchdogWaitsOutAJob(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-vaultwarden-1", Image: "vaultwarden/server:latest", Running: true, Health: "unhealthy", Project: "homelab_security", Service: "vaultwarden"},
	})
	root, _ := repoCopy(t, "UPDATES_PAUSED=true", "TUNNEL_TOKEN=")
	t.Setenv(turn.Env, "")
	if err := os.MkdirAll(turn.Dir(root), 0o700); err != nil {
		t.Fatal(err)
	}
	at := time.Now().Add(-time.Minute)
	other := filepath.Join(turn.Dir(root), fmt.Sprintf("%020d-%d.json", at.UnixNano(), os.Getppid()))
	data, _ := json.Marshal(turn.Ticket{PID: os.Getppid(), What: "Update all apps now", At: at, Host: hostnameForTest(t)})
	if err := os.WriteFile(other, data, 0o600); err != nil {
		t.Fatal(err)
	}
	restarts := func() int { return strings.Count(readCalls(t, calls), "restart vaultwarden") }
	homelabCmd(t, root, "", "watchdog")
	homelabCmd(t, root, "", "watchdog")
	if n := restarts(); n != 0 {
		t.Fatalf("restarted while another job ran (%d)", n)
	}
	_ = os.Remove(other)
	homelabCmd(t, root, "", "watchdog")
	if n := restarts(); n != 1 {
		t.Errorf("not healed once the job ended (%d)", n)
	}
}

// At sign-in the agent's up waits up to 15 minutes for the media drive.
// It takes its turn once the drive is there, not before: waiting for a
// drive changes nothing, and every other change (a phone's Restart,
// removing the agent) would wait behind it.
func TestUpWaitsForTheDriveBeforeItsTurn(t *testing.T) {
	fakeDocker(t, nil)
	media := filepath.Join(t.TempDir(), "not-mounted")
	root, _ := repoCopy(t, "MEDIA_ROOT="+filepath.ToSlash(media))
	t.Setenv(turn.Env, "")
	type result struct {
		out  string
		code int
	}
	done := make(chan result, 1)
	go func() {
		out, code := homelabCmd(t, root, "", "up", "--apply", "--wait-media", "30s")
		done <- result{out, code}
	}()
	select {
	case r := <-done:
		t.Fatalf("up did not wait for the drive (exit %d):\n%s", r.code, r.out)
	case <-time.After(1500 * time.Millisecond):
	}
	if q := turn.Queue(root); len(q) != 0 {
		t.Errorf("the turn is held while only waiting for the drive: %+v", q)
	}
	if err := os.MkdirAll(media, 0o755); err != nil { // the drive comes
		t.Fatal(err)
	}
	select {
	case r := <-done:
		if r.code != 0 {
			t.Fatalf("up (exit %d):\n%s", r.code, r.out)
		}
	case <-time.After(20 * time.Second):
		t.Fatal("up did not go on once the drive was there")
	}
	if q := turn.Queue(root); len(q) != 0 {
		t.Errorf("tickets left: %+v", q)
	}
}

func hostnameForTest(t *testing.T) string {
	t.Helper()
	h, err := os.Hostname()
	if err != nil {
		t.Fatal(err)
	}
	return h
}
