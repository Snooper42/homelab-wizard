package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// A restart another watchdog run noted while this one was restarting an
// app is kept (two runs at once: the agent's, and the one after sleep).
// Lost, that app could be restarted again before healEvery is up.
func TestWatchdogKeepsAnotherRunsRestartNote(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-vaultwarden-1", Image: "vaultwarden/server:latest", Running: true, Health: "unhealthy", Project: "homelab_security", Service: "vaultwarden"},
	})
	root, _ := repoCopy(t, "UPDATES_PAUSED=true", "TUNNEL_TOKEN=")
	homelabCmd(t, root, "", "watchdog") // the first failing check
	other := filepath.Join(t.TempDir(), "healed.json")
	at := time.Now().Add(-time.Hour).UTC().Truncate(time.Second)
	data, _ := json.Marshal(map[string]time.Time{"jellyfin": at})
	if err := os.WriteFile(other, data, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(healPath(root)), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("FAKE_ON_RESTART", other+">"+healPath(root))
	if out, _ := homelabCmd(t, root, "", "watchdog"); !strings.Contains(out, "restarted Vaultwarden") {
		t.Fatalf("not restarted:\n%s", out)
	}
	last := map[string]time.Time{}
	data, _ = os.ReadFile(healPath(root))
	if err := json.Unmarshal(data, &last); err != nil {
		t.Fatalf("%s: %v", data, err)
	}
	if _, ok := last["vaultwarden"]; !ok {
		t.Errorf("this run's restart isn't noted: %s", data)
	}
	if !last["jellyfin"].Equal(at) {
		t.Errorf("the other run's restart note was lost: %s", data)
	}
}
