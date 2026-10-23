package engine

import (
	"context"
	"errors"
	"runtime"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/docker"
)

func TestServeAndFollow(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("the socket folder comes from XDG_RUNTIME_DIR on Linux")
	}
	t.Setenv("XDG_RUNTIME_DIR", t.TempDir())
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	ready := make(chan struct{})
	s := &Server{
		Root:   "/home/you/Homelab",
		Status: func(context.Context) (api.Status, error) { return api.Status{Missing: 2}, nil },
		Watcher: Watcher{Quiet: 10 * time.Millisecond, Retry: time.Hour, Connect: func(ctx context.Context) (*docker.Client, error) {
			select { // the runtime speaks once a client follows
			case <-ready:
			case <-ctx.Done():
				return nil, ctx.Err()
			}
			return &docker.Client{Runner: &docker.FakeRunner{Events: []string{event("start", "vikunja")}, EventsErr: errors.New("EOF")}, Bin: "docker"}, nil
		}},
	}
	served := make(chan error, 1)
	go func() { served <- s.Serve(ctx) }()

	var c *Client
	for i := 0; ; i++ {
		var err error
		if c, err = Dial(ctx, "/home/you/Homelab/"); err == nil {
			break
		}
		if i > 100 {
			t.Fatalf("dial: %v", err)
		}
		time.Sleep(20 * time.Millisecond)
	}
	if _, err := Dial(ctx, "/home/you/Other"); err == nil {
		t.Error("another homelab's engine was used")
	}
	if err := (&Server{Root: "x"}).Serve(ctx); !errors.Is(err, ErrServed) {
		t.Errorf("second agent: %v", err)
	}
	if st, err := c.Status(ctx); err != nil || st.Missing != 2 {
		t.Errorf("status: %+v %v", st, err)
	}

	got := make(chan Change, 4)
	go func() { _ = c.Follow(ctx, func(ch Change) { got <- ch }) }()
	for {
		s.mu.Lock()
		n := len(s.subs)
		s.mu.Unlock()
		if n > 0 {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	close(ready)
	select {
	case ch := <-got:
		if len(ch.Apps) != 1 || ch.Apps[0] != "vikunja" {
			t.Errorf("change: %+v", ch)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("no change followed")
	}
	cancel()
	if err := <-served; err != nil {
		t.Errorf("serve: %v", err)
	}
}
