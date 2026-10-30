package core

import (
	"context"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/board"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/engine"
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

// With an agent serving the homelab, the cards it reads come from it; one
// it does not read is read here. With no agent, every card is read here.
func TestReadCardsFromTheAgent(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("the agent's socket folder comes from XDG_RUNTIME_DIR on Linux")
	}
	t.Setenv("XDG_RUNTIME_DIR", t.TempDir())
	root := t.TempDir()
	here := board.Readers{
		"watchdog": func(context.Context) (any, error) { return "here", nil },
		"storage":  func(context.Context) (any, error) { return "here", nil },
	}
	read := func() map[string]any {
		got := map[string]any{}
		ReadCards(context.Background(), root, 2, []string{"watchdog", "storage"}, here, func(c board.Card) { got[c.Name] = c.Data })
		return got
	}
	if got := read(); got["watchdog"] != "here" || got["storage"] != "here" {
		t.Fatalf("no agent: %v", got)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	s := &engine.Server{Root: root,
		Status:  func(context.Context) (api.Status, error) { return api.Status{}, nil },
		Watcher: engine.Watcher{Retry: time.Hour, Connect: func(ctx context.Context) (*docker.Client, error) { <-ctx.Done(); return nil, ctx.Err() }},
		Cards:   board.Readers{"watchdog": func(context.Context) (any, error) { return "from the agent", nil }}}
	served := make(chan error, 1)
	go func() { served <- s.Serve(ctx) }()
	for i := 0; ; i++ {
		if _, err := engine.Dial(ctx, root); err == nil {
			break
		}
		if i > 100 {
			t.Fatal("the agent never answered")
		}
		time.Sleep(20 * time.Millisecond)
	}
	if got := read(); got["watchdog"] != "from the agent" || got["storage"] != "here" {
		t.Errorf("with the agent: %v", got)
	}
	cancel()
	<-served
}
