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
	// Plugged in, with sonarr stopped as the saver left it.
	calls = fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_media_automation-sonarr-1", Image: "x", Project: "homelab_media_automation", Service: "sonarr"},
		{Name: "homelab_security-vaultwarden-1", Image: "x", Running: true, Health: "healthy", Project: "homelab_security", Service: "vaultwarden"},
	})
	stopped, _ := client.Containers(context.Background())
	h.batterySaver(context.Background(), client, stopped)
	if st := battery.Load(battery.Path(root)); len(st.Paused) != 0 {
		t.Fatalf("still paused %v", st.Paused)
	}
	if log := readCalls(t, calls); !strings.Contains(log, "start sonarr") {
		t.Fatalf("calls:\n%s", log)
	}
}

// Plugged in again, one paused app that will not start never holds back
// the rest: they start, it alone stays paused for the next run, and an app
// started by hand meanwhile is left alone.
func TestBatterySaverResumesPastOneThatFails(t *testing.T) {
	battery.Power = func() (bool, bool) { return false, true }
	t.Cleanup(func() { battery.Power = func() (bool, bool) { return false, false } })
	t.Setenv("FAKE_START_FAILS", "radarr")
	ctrs := []docker.FakeContainer{
		{Name: "homelab_media_automation-sonarr-1", Image: "x", Project: "homelab_media_automation", Service: "sonarr"},
		{Name: "homelab_media_automation-radarr-1", Image: "x", Project: "homelab_media_automation", Service: "radarr"},
		{Name: "homelab_media_automation-lidarr-1", Image: "x", Project: "homelab_media_automation", Service: "lidarr"},
		{Name: "homelab_media_automation-bazarr-1", Image: "x", Running: true, Health: "healthy", Project: "homelab_media_automation", Service: "bazarr"},
	}
	calls := fakeDocker(t, ctrs)
	root, _ := repoCopy(t)
	if err := (battery.State{Paused: []string{"bazarr", "lidarr", "radarr", "sonarr"}, Since: time.Now()}).Save(battery.Path(root)); err != nil {
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
	containers, _ := client.Containers(context.Background())
	h.batterySaver(context.Background(), client, containers)
	if st := battery.Load(battery.Path(root)); strings.Join(st.Paused, ",") != "radarr" {
		t.Fatalf("paused %v, want only radarr", st.Paused)
	}
	log := readCalls(t, calls)
	for _, want := range []string{"start sonarr", "start lidarr"} {
		if !strings.Contains(log, want) {
			t.Errorf("no %q in:\n%s", want, log)
		}
	}
	if strings.Contains(log, "start bazarr") || strings.Contains(log, " bazarr ") {
		t.Errorf("bazarr was running already, yet:\n%s", log)
	}
}

// The awake job starts what was paused within its minute of looking, once
// the machine is plugged in, without waiting for the watchdog.
func TestResumeOnPower(t *testing.T) {
	battery.Power = func() (bool, bool) { return false, true }
	t.Cleanup(func() { battery.Power = func() (bool, bool) { return false, false } })
	was := powerEvery
	powerEvery = 10 * time.Millisecond
	t.Cleanup(func() { powerEvery = was })
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_media_automation-sonarr-1", Image: "x", Project: "homelab_media_automation", Service: "sonarr"},
	})
	root, _ := repoCopy(t)
	if err := (battery.State{Paused: []string{"sonarr"}, Since: time.Now()}).Save(battery.Path(root)); err != nil {
		t.Fatal(err)
	}
	h, err := newHomelab(&ui.UI{Out: &bytes.Buffer{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	done := make(chan struct{})
	go func() { h.resumeOnPower(ctx); close(done) }()
	for len(battery.Load(battery.Path(root)).Paused) > 0 {
		if ctx.Err() != nil {
			t.Fatal("still paused after 20s")
		}
		time.Sleep(20 * time.Millisecond)
	}
	cancel()
	<-done
	if log := readCalls(t, calls); !strings.Contains(log, "start sonarr") {
		t.Fatalf("calls:\n%s", log)
	}
}
