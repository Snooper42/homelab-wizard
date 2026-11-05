package main

import (
	"bytes"
	"context"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/battery"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/started"
	"github.com/Snooper42/homelab-wizard/internal/stopped"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// Each way the homelab starts an app keeps why (data/started.json), for
// Status's "up 9 minutes" on hover: you, the battery saver, and the end of
// a Stop for a while. Stop keeps nothing; a start that fails keeps nothing.
func TestStartsKeepWhy(t *testing.T) {
	t.Setenv("FAKE_START_FAILS", "lidarr")
	battery.Power = func() (bool, bool) { return false, true }
	t.Cleanup(func() { battery.Power = func() (bool, bool) { return false, false } })
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_media_automation-sonarr-1", Image: "x", Running: true, Health: "healthy", Project: "homelab_media_automation", Service: "sonarr"},
		{Name: "homelab_media_automation-radarr-1", Image: "x", Project: "homelab_media_automation", Service: "radarr"},
		{Name: "homelab_media_automation-lidarr-1", Image: "x", Project: "homelab_media_automation", Service: "lidarr"},
		{Name: "homelab_media_automation-bazarr-1", Image: "x", Project: "homelab_media_automation", Service: "bazarr"},
	})
	root, _ := repoCopy(t)
	before := time.Now().Add(-time.Second)
	if out, code := homelabCmd(t, root, "", "restart", "sonarr"); code != 0 {
		t.Fatalf("restart (exit %d):\n%s", code, out)
	}
	if out, code := homelabCmd(t, root, "", "stop", "sonarr"); code != 0 {
		t.Fatalf("stop (exit %d):\n%s", code, out)
	}
	r := started.Load(started.Path(root))
	if s := r["sonarr"]; s.Why != started.You || s.At.Before(before) {
		t.Fatalf("after restart and stop: %+v", r)
	}

	// The battery saver, on power again; and a Stop for a while whose time came.
	if err := (battery.State{Paused: []string{"radarr"}, Since: time.Now()}).Save(battery.Path(root)); err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	if err := (stopped.Record{"bazarr": {Since: now.Add(-time.Hour), Until: now.Add(-time.Minute)}, "lidarr": {Since: now.Add(-time.Hour), Until: now.Add(-time.Minute)}}).Save(stopped.Path(root)); err != nil {
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
	h.startWhenDue(context.Background(), client, containers, now)
	r = started.Load(started.Path(root))
	for id, want := range map[string]string{"sonarr": started.You, "radarr": started.Battery, "bazarr": started.Timer} {
		if r[id].Why != want {
			t.Errorf("%s: %q, want %q (%+v)", id, r[id].Why, want, r)
		}
	}
	if _, ok := r["lidarr"]; ok {
		t.Errorf("lidarr did not start, but is kept as started: %+v", r)
	}
}
