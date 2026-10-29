package core

import (
	"context"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/board"
	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// Every card Status shows comes back, as its own function gives it: the
// ones read from files on a new homelab, and the ones that ask the runtime
// saying why they cannot be read.
func TestCards(t *testing.T) {
	away(t)
	root := homelab(t, "")
	withDocker(t, &runner{FakeRunner: &docker.FakeRunner{Containers: []docker.FakeContainer{running("homelab_security", "ntfy")}}})
	got := map[string]board.Card{}
	board.Read(context.Background(), Cards(root), 1, []string{"watchdog", "savings", "crash", "storage", "protection", "alerts", "usage"}, func(c board.Card) { got[c.Name] = c })
	for _, name := range []string{"watchdog", "savings", "crash", "storage", "usage"} {
		if c, ok := got[name]; !ok || c.Error != "" {
			t.Errorf("%s: %+v", name, c)
		}
	}
	if !strings.Contains(got["protection"].Error, ErrNoCrowdSec.Error()) || !strings.Contains(got["alerts"].Error, ErrNoReadToken.Error()) {
		t.Errorf("protection %q, alerts %q", got["protection"].Error, got["alerts"].Error)
	}
}
