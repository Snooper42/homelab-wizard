package api

import (
	"context"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// Why an app stopped by itself, in the few words its row shows; nothing
// for one stopped cleanly, which needs no look.
func TestStoppedWhy(t *testing.T) {
	for _, tc := range []struct {
		name string
		c    docker.Container
		want string
	}{
		{"out of memory", docker.Container{ExitCode: 137, OOMKilled: true}, "it ran out of memory"},
		{"its port taken", docker.Container{ExitCode: 128, Error: "driver failed programming external connectivity on endpoint homelab_food-mealie-1 (3f2a): Bind for 0.0.0.0:9925 failed: port is already allocated"}, "another program is using its port 9925"},
		{"its port taken, as Linux says it", docker.Container{ExitCode: 128, Error: "Error starting userland proxy: listen tcp4 0.0.0.0:9925: bind: address already in use"}, "another program is using its port 9925"},
		{"its port taken, as Docker 29 says it", docker.Container{ExitCode: 128, Error: "failed to set up container networking: driver failed programming external connectivity on endpoint homelab_household-mealie-1 (c30b02459b3c): failed to bind host port 0.0.0.0:19925/tcp: address already in use"}, "another program is using its port 19925"},
		{"Docker couldn't start it", docker.Container{ExitCode: 127, Error: `exec: "/start.sh": permission denied`}, "Docker couldn't start it"},
		{"it quit with an error", docker.Container{ExitCode: 1}, "it quit with an error"},
		{"it finished", docker.Container{ExitCode: 0}, ""},
		{"stopped by docker stop", docker.Container{ExitCode: 143}, ""},
		{"killed at a shutdown", docker.Container{ExitCode: 137}, ""},
	} {
		if got := StoppedWhy(tc.c); got != tc.want {
			t.Errorf("%s: %q, want %q", tc.name, got, tc.want)
		}
	}
}

// Status says when a stopped app stopped and, when it stopped by itself,
// why: before, a crash and a shutdown both read "Stopped". One waiting for
// its drive says that instead.
func TestStatusSaysWhenAndWhyAnAppStopped(t *testing.T) {
	_, file, _, _ := runtime.Caller(0)
	c, err := catalog.Load(filepath.Join(filepath.Dir(file), "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	at := time.Date(2026, 11, 6, 3, 12, 0, 0, time.FixedZone("CET", 3600))
	ctr := func(project, svc string, c docker.Container) docker.Container {
		c.Name, c.Image, c.State = project+"-"+svc+"-1", "x", "exited"
		c.Labels = map[string]string{"com.docker.compose.project": project, "com.docker.compose.service": svc}
		return c
	}
	containers := []docker.Container{
		ctr("homelab_security", "ntfy", docker.Container{ExitCode: 137, OOMKilled: true, FinishedAt: at}),
		ctr("homelab_security", "vaultwarden", docker.Container{ExitCode: 0, FinishedAt: at}),
		ctr("homelab_security", "uptime-kuma", docker.Container{ExitCode: 1, Binds: []string{"/Volumes/NotPluggedIn-7c1/kuma"}}),
	}
	got := map[string]AppStatus{}
	for _, a := range StatusOf(context.Background(), c, containers, map[string]string{}, false).Apps {
		got[a.ID] = a
	}
	if a := got["ntfy"]; a.State != "stopped" || a.StoppedWhy != "it ran out of memory" || a.StoppedAt != "2026-11-06T02:12:00Z" {
		t.Errorf("ntfy: %+v", a)
	}
	if a := got["vaultwarden"]; a.StoppedWhy != "" || a.StoppedAt != "2026-11-06T02:12:00Z" {
		t.Errorf("vaultwarden, stopped cleanly: %+v", a)
	}
	if a := got["uptime-kuma"]; a.WaitingFor == "" || a.StoppedWhy != "" || a.StoppedAt != "" {
		t.Errorf("uptime-kuma, waiting for its drive: %+v", a)
	}
}
