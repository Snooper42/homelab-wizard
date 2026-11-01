package engine

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/board"
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
	// A homelab's worth of apps: the change carries the whole Status, far
	// over a scanner's 64 KB line.
	big := api.Status{Missing: 2}
	for i := 0; i < 1500; i++ {
		big.Apps = append(big.Apps, api.AppStatus{ID: fmt.Sprintf("app-%04d", i), Name: strings.Repeat("An app with a long name ", 3), State: "running"})
	}
	var reads atomic.Int32
	s := &Server{
		Root:   "/home/you/Homelab",
		Status: func(context.Context) (api.Status, error) { reads.Add(1); return big, nil },
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
			t.Errorf("change: %+v", ch.Apps)
		}
		// The Status read after it comes with it: nothing to ask again.
		if ch.Status == nil || ch.Status.Missing != 2 || len(ch.Status.Apps) != 1500 {
			t.Errorf("the change came without the Status after it")
		}
		if n := reads.Load(); n < 2 {
			t.Errorf("%d readings: the change's was not read by the agent", n)
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

// Following starts again after the agent goes away, and again when a new
// one comes: each starts with a change marked Again, for what was missed.
func TestFollowSaysWhenItFollowsAgain(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("the socket folder comes from XDG_RUNTIME_DIR on Linux")
	}
	t.Setenv("XDG_RUNTIME_DIR", t.TempDir())
	t.Setenv("PATH", t.TempDir()) // no docker here: the watcher finds no runtime
	saved := lookAgain
	lookAgain = 200 * time.Millisecond
	t.Cleanup(func() { lookAgain = saved })
	root := "/home/you/Homelab"
	agent := func() (context.CancelFunc, chan error) {
		ctx, cancel := context.WithCancel(context.Background())
		s := &Server{Root: root, Status: func(context.Context) (api.Status, error) { return api.Status{}, nil },
			Watcher: Watcher{Retry: time.Hour, Connect: func(ctx context.Context) (*docker.Client, error) { <-ctx.Done(); return nil, ctx.Err() }}}
		done := make(chan error, 1)
		go func() { done <- s.Serve(ctx) }()
		for i := 0; ; i++ {
			if _, err := Dial(ctx, root); err == nil {
				return cancel, done
			}
			if i > 100 {
				t.Fatal("the agent never answered")
			}
			time.Sleep(20 * time.Millisecond)
		}
	}
	stop, done := agent()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	got := make(chan Change, 16)
	go Follow(ctx, root, func(c Change) { got <- c })
	again := func(why string) {
		t.Helper()
		for {
			select {
			case c := <-got:
				if c.Again {
					return
				}
			case <-time.After(5 * time.Second):
				t.Fatalf("no change marked Again %s", why)
			}
		}
	}
	select { // the first follow: nothing missed
	case c := <-got:
		t.Fatalf("a change on the first follow: %+v", c)
	case <-time.After(300 * time.Millisecond):
	}
	stop()
	<-done
	again("once the agent went away")
	stop, done = agent()
	defer func() { stop(); <-done }()
	again("once a new agent came")
}

// The agent reads the cards beside Status: two requests at once share each
// card's reading, a card it does not read says so, and each card comes as
// soon as it is read.
func TestServeCards(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("the socket folder comes from XDG_RUNTIME_DIR on Linux")
	}
	t.Setenv("XDG_RUNTIME_DIR", t.TempDir())
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	var reads atomic.Int32
	release := make(chan struct{})
	s := &Server{Root: "/home/you/Homelab",
		Status:  func(context.Context) (api.Status, error) { return api.Status{}, nil },
		Watcher: Watcher{Retry: time.Hour, Connect: func(ctx context.Context) (*docker.Client, error) { <-ctx.Done(); return nil, ctx.Err() }},
		Cards: board.Readers{
			"watchdog": func(context.Context) (any, error) { return map[string]int{"checks": 7}, nil },
			"week": func(context.Context) (any, error) {
				reads.Add(1)
				<-release
				return "a week", nil
			},
		}}
	served := make(chan error, 1)
	go func() { served <- s.Serve(ctx) }()
	var c *Client
	for i := 0; ; i++ {
		var err error
		if c, err = Dial(ctx, "/home/you/Homelab"); err == nil {
			break
		}
		if i > 100 {
			t.Fatalf("dial: %v", err)
		}
		time.Sleep(20 * time.Millisecond)
	}
	type got struct {
		mu    sync.Mutex
		cards map[string]board.Card
		order []string
	}
	read := func(g *got, done chan<- error) {
		done <- c.Cards(ctx, 4, []string{"watchdog", "week", "storage"}, func(card board.Card) {
			g.mu.Lock()
			defer g.mu.Unlock()
			g.cards[card.Name] = card
			g.order = append(g.order, card.Name)
		})
	}
	a, b := &got{cards: map[string]board.Card{}}, &got{cards: map[string]board.Card{}}
	doneA, doneB := make(chan error, 1), make(chan error, 1)
	go read(a, doneA)
	go read(b, doneB)
	// The watchdog's card comes while the week is still being read.
	waitCard := func(g *got, name string) {
		for i := 0; i < 200; i++ {
			g.mu.Lock()
			_, ok := g.cards[name]
			g.mu.Unlock()
			if ok {
				return
			}
			time.Sleep(10 * time.Millisecond)
		}
		t.Fatalf("no %s card", name)
	}
	waitCard(a, "watchdog")
	waitCard(b, "watchdog")
	close(release)
	if err := <-doneA; err != nil {
		t.Fatal(err)
	}
	if err := <-doneB; err != nil {
		t.Fatal(err)
	}
	if n := reads.Load(); n != 1 {
		t.Errorf("the week was read %d times for two requests at once", n)
	}
	for _, g := range []*got{a, b} {
		if g.cards["week"].Data != "a week" || g.cards["storage"].Error != board.NotHere || g.cards["watchdog"].Board != 4 {
			t.Errorf("%+v", g.cards)
		}
		if g.order[len(g.order)-1] != "week" {
			t.Errorf("the slow card was not last: %v", g.order)
		}
	}
	cancel()
	if err := <-served; err != nil {
		t.Errorf("serve: %v", err)
	}
}

// The engine's socket is yours alone (docs/Security.md: the engine's local
// socket): it answers whoever can open it, so the file is 0600 in a 0700
// folder, whatever the umask.
func TestTheSocketIsYoursAlone(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("the socket folder comes from XDG_RUNTIME_DIR on Linux")
	}
	t.Setenv("XDG_RUNTIME_DIR", t.TempDir())
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	s := &Server{Root: "/home/you/Homelab", Status: func(context.Context) (api.Status, error) { return api.Status{}, nil },
		Watcher: Watcher{Retry: time.Hour, Connect: func(ctx context.Context) (*docker.Client, error) { <-ctx.Done(); return nil, ctx.Err() }}}
	go func() { _ = s.Serve(ctx) }()
	path := SocketPath()
	var fi os.FileInfo
	for i := 0; ; i++ {
		var err error
		if fi, err = os.Stat(path); err == nil && fi.Mode().Perm() == 0o600 {
			break
		}
		if i > 200 {
			t.Fatalf("the socket at %s: %v, mode %v", path, err, fi.Mode().Perm())
		}
		time.Sleep(10 * time.Millisecond)
	}
	dir, err := os.Stat(filepath.Dir(path))
	if err != nil || dir.Mode().Perm() != 0o700 {
		t.Fatalf("the socket's folder: %v, mode %v", err, dir.Mode().Perm())
	}
}
