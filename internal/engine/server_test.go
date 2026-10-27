package engine

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"runtime"
	"sync/atomic"
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
		if s.hub.Subscribers() > 0 {
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

func TestStatusReadOnceForRequestsTogether(t *testing.T) {
	var reads atomic.Int32
	release := make(chan struct{})
	s := &Server{
		Status: func(context.Context) (api.Status, error) {
			t.Error("the full status for ?now")
			return api.Status{}, nil
		},
		Now: func(context.Context) (api.Status, error) {
			n := reads.Add(1)
			<-release
			return api.Status{Missing: int(n)}, nil
		},
	}
	srv := httptest.NewServer(s.Handler())
	defer srv.Close()
	get := func() api.Status {
		resp, err := http.Get(srv.URL + "/v1/status?now")
		if err != nil {
			t.Error(err)
			return api.Status{}
		}
		defer resp.Body.Close()
		var st api.Status
		_ = json.NewDecoder(resp.Body).Decode(&st)
		return st
	}
	got := make(chan api.Status, 2)
	go func() { got <- get() }()
	go func() { got <- get() }()
	for reads.Load() == 0 {
		time.Sleep(time.Millisecond)
	}
	time.Sleep(50 * time.Millisecond) // the second request joins the reading
	close(release)
	if a, b := <-got, <-got; a.Missing != 1 || b.Missing != 1 || reads.Load() != 1 {
		t.Fatalf("two requests together: %d reads, %d and %d", reads.Load(), a.Missing, b.Missing)
	}
	if st := get(); st.Missing != 2 {
		t.Errorf("a later request reads again, not a kept result: %d", st.Missing)
	}
}

func TestLastStatusKeepsTheLastGoodReading(t *testing.T) {
	missing, fail := 0, false
	s := &Server{Status: func(context.Context) (api.Status, error) {
		if fail {
			return api.Status{}, errors.New("the container runtime is not running")
		}
		missing++
		return api.Status{Missing: missing}, nil
	}}
	srv := httptest.NewServer(s.Handler())
	defer srv.Close()
	last := func() (int, api.Reading) {
		resp, err := http.Get(srv.URL + "/v1/status/last")
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		var r api.Reading
		_ = json.NewDecoder(resp.Body).Decode(&r)
		return resp.StatusCode, r
	}
	read := func() {
		resp, err := http.Get(srv.URL + "/v1/status")
		if err != nil {
			t.Fatal(err)
		}
		resp.Body.Close()
	}
	if code, _ := last(); code != http.StatusNotFound {
		t.Errorf("before any reading: %d, want 404", code)
	}
	before := time.Now()
	read()
	read()
	if code, r := last(); code != http.StatusOK || r.Status.Missing != 2 || r.At.Before(before) || time.Since(r.At) > time.Minute {
		t.Errorf("after two readings: %d %+v", code, r)
	}
	fail = true
	read()
	if _, r := last(); r.Status.Missing != 2 {
		t.Errorf("a failed reading replaced the last good one: %+v", r)
	}
	if missing != 2 {
		t.Errorf("asking for the last reading read the runtime: %d readings", missing)
	}
}
