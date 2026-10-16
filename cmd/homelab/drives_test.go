package main

import (
	"bytes"
	"context"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/battery"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

func TestExternalDrive(t *testing.T) {
	for in, want := range map[string]string{
		"/Volumes/Hobbies/Books": "/Volumes/Hobbies",
		"/Volumes/Media":         "/Volumes/Media",
		"/Users/you/Homelab":     "",
		"./data/appdata":         "",
	} {
		if got := externalDrive(in); got != want {
			t.Errorf("%s: %q, want %q", in, got, want)
		}
	}
}

func TestFailedToStart(t *testing.T) {
	base := docker.Container{Labels: map[string]string{"com.docker.compose.project": "homelab_media"}, RestartPolicy: "unless-stopped", StartedAt: time.Now()}
	missing := base
	missing.Error = "invalid mount config: bind source path does not exist: /Volumes/Hobbies/Books"
	byHand := base
	crashed := base
	crashed.ExitCode = 1
	never := base
	never.StartedAt = time.Time{}
	other := missing
	other.Labels = map[string]string{"com.docker.compose.project": "something_else"}
	for name, c := range map[string]struct {
		c             docker.Container
		loose, strict bool
	}{
		"missing drive":   {missing, true, true},
		"stopped by hand": {byHand, false, false},
		"crashed":         {crashed, true, false},
		"never started":   {never, false, false},
		"not the homelab": {other, false, false},
	} {
		if got := failedToStart(c.c, false); got != c.loose {
			t.Errorf("%s: loose %v", name, got)
		}
		if got := failedToStart(c.c, true); got != c.strict {
			t.Errorf("%s: strict %v", name, got)
		}
	}
}

func TestBatterySaver(t *testing.T) {
	on := true
	battery.Power = func() (bool, bool) { return on, true }
	t.Cleanup(func() { battery.Power = func() (bool, bool) { return false, false } })
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_media_automation-sonarr-1", Image: "x", Running: true, Health: "healthy", Project: "homelab_media_automation", Service: "sonarr"},
		{Name: "homelab_security-vaultwarden-1", Image: "x", Running: true, Health: "healthy", Project: "homelab_security", Service: "vaultwarden"},
	})
	root, _ := repoCopy(t)
	h, err := newHomelab(&ui.UI{Out: &bytes.Buffer{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	client, err := h.docker(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	containers, _ := client.Containers(context.Background())
	h.batterySaver(context.Background(), client, containers)
	if st := battery.Load(battery.Path(root)); strings.Join(st.Paused, ",") != "sonarr" {
		t.Fatalf("paused %v", st.Paused)
	}
	if log := readCalls(t, calls); !strings.Contains(log, "stop sonarr") || strings.Contains(log, "stop vaultwarden") {
		t.Fatalf("calls:\n%s", log)
	}
	on = false
	h.batterySaver(context.Background(), client, containers)
	if st := battery.Load(battery.Path(root)); len(st.Paused) != 0 {
		t.Fatalf("still paused %v", st.Paused)
	}
	if log := readCalls(t, calls); !strings.Contains(log, "start sonarr") {
		t.Fatalf("calls:\n%s", log)
	}
}
