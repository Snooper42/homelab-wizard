package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/battery"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/stopped"
	"github.com/Snooper42/homelab-wizard/internal/turn"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// holdTurn puts a ticket in the queue for another running process (this
// test's parent), standing for a job such as the nightly update; the
// returned func ends it.
func holdTurn(t *testing.T, root, what string) func() {
	t.Helper()
	t.Setenv(turn.Env, "")
	if err := os.MkdirAll(turn.Dir(root), 0o700); err != nil {
		t.Fatal(err)
	}
	at := time.Now().Add(-time.Minute)
	file := filepath.Join(turn.Dir(root), fmt.Sprintf("%020d-%d.json", at.UnixNano(), os.Getppid()))
	data, _ := json.Marshal(turn.Ticket{PID: os.Getppid(), What: what, At: at, Host: hostnameForTest(t)})
	if err := os.WriteFile(file, data, 0o600); err != nil {
		t.Fatal(err)
	}
	return func() { _ = os.Remove(file) }
}

// While a job has the turn (the nightly update takes an app down and
// starts it again, then checks it is well, else rolls it back), the
// battery saver stops nothing and the stop timer starts nothing: either
// could undo what the job just did. Both act once the job is over.
func TestStartersWaitOutAJob(t *testing.T) {
	on := true
	battery.Power = func() (bool, bool) { return on, true }
	t.Cleanup(func() { battery.Power = func() (bool, bool) { return false, false } })
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_media_automation-sonarr-1", Image: "x", Running: true, Health: "healthy", Project: "homelab_media_automation", Service: "sonarr"},
		{Name: "homelab_media_automation-radarr-1", Image: "x", Project: "homelab_media_automation", Service: "radarr"},
	})
	root, _ := repoCopy(t)
	now := time.Now()
	if err := (stopped.Record{"radarr": {Since: now.Add(-2 * time.Hour), Until: now.Add(-time.Minute)}}).Save(stopped.Path(root)); err != nil {
		t.Fatal(err)
	}
	h, err := newHomelab(&ui.UI{Out: &bytes.Buffer{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	client, err := h.docker(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	run := func() {
		containers, _ := client.Containers(context.Background())
		h.batterySaver(context.Background(), client, containers)
		h.startWhenDue(context.Background(), client, containers, now)
	}
	end := holdTurn(t, root, "the nightly update")
	run()
	if log := readCalls(t, calls); strings.Contains(log, "stop sonarr") || strings.Contains(log, "start radarr") {
		t.Fatalf("changed apps while the nightly update ran:\n%s", log)
	}
	end()
	run()
	if log := readCalls(t, calls); !strings.Contains(log, "stop sonarr") || !strings.Contains(log, "start radarr") {
		t.Errorf("did nothing once the job was over:\n%s", log)
	}
}
