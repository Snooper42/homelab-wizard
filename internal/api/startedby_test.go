package api

import (
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/started"
	"github.com/Snooper42/homelab-wizard/internal/updates"
)

func TestStartedBy(t *testing.T) {
	at := time.Date(2026, 11, 4, 3, 15, 0, 0, time.UTC)
	why := started.Record{"immich": {At: at.Add(30 * time.Second), Why: started.Battery}}
	hist := updates.History{Apps: map[string]*updates.Record{"sonarr": {Updated: at.Add(10 * time.Minute)}, "radarr": {Updated: at.Add(-3 * time.Hour)}}}
	for _, tc := range []struct {
		name, id string
		c        docker.Container
		want     string
	}{
		{"the homelab noted it", "immich", docker.Container{StartedAt: at, Restarts: 2}, started.Battery},
		{"noted, but it started again since: Docker, after it stopped on its own", "immich", docker.Container{StartedAt: at.Add(2 * time.Hour), Restarts: 2}, DockerRestart},
		{"an update noticed just after it started", "sonarr", docker.Container{StartedAt: at}, Updated},
		{"an update long before this start", "radarr", docker.Container{StartedAt: at}, ""},
		{"nothing says", "vikunja", docker.Container{StartedAt: at}, ""},
		{"no start time", "sonarr", docker.Container{}, ""},
	} {
		if got := startedBy(why, hist, tc.id, tc.c); got != tc.want {
			t.Errorf("%s: %q, want %q", tc.name, got, tc.want)
		}
	}
}
