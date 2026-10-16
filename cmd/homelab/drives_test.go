package main

import (
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/docker"
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
