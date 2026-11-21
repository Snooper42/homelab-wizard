package core

import (
	"context"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// The Downloads card is there only with the media apps: none installed, no
// card; Sonarr installed but not set up yet, nothing on the way.
func TestDownloadsCard(t *testing.T) {
	away(t)
	root := homelab(t, "")
	withDocker(t, &runner{FakeRunner: &docker.FakeRunner{Containers: []docker.FakeContainer{running("homelab_security", "ntfy")}}})
	c, err := Downloads(context.Background(), root)
	if err != nil || c.Apps || c.Line != "" {
		t.Errorf("no media apps: %+v, %v", c, err)
	}
	withDocker(t, &runner{FakeRunner: &docker.FakeRunner{Containers: []docker.FakeContainer{running("homelab_media-automation", "sonarr")}}})
	c, err = Downloads(context.Background(), root)
	if err != nil || !c.Apps || c.Line != "Nothing on the way" {
		t.Errorf("Sonarr, not set up yet: %+v, %v", c, err)
	}
}
