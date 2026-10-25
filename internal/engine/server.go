package engine

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
)

// The agent serves the engine on a socket only this account can reach, so
// the app, the menu bar item, and the phone companion follow one engine
// instead of each asking the runtime themselves:
//
//	GET /v1/hello   {"version": 1, "root": "/Users/you/Homelab"}
//	GET /v1/status  the state of every app (api.Status)
//	GET /v1/events  each Change as it happens (Server-Sent Events)

// Version is the API's version; a client that knows another one does not
// use it.
const Version = 1

// SocketPath is where the agent serves the engine: in the account's runtime
// folder ($XDG_RUNTIME_DIR) on Linux, else in its cache folder.
func SocketPath() string {
	dir := os.Getenv("XDG_RUNTIME_DIR")
	if dir == "" || runtime.GOOS != "linux" {
		var err error
		if dir, err = os.UserCacheDir(); err != nil {
			dir = os.TempDir()
		}
	}
	return filepath.Join(dir, "homelab-wizard", "engine.sock")
}

// Hello is what /v1/hello answers.
type Hello struct {
	Version int    `json:"version"`
	Root    string `json:"root"`
}

// Hub passes each change to every subscriber: one runtime watcher for
// however many clients follow it.
type Hub struct {
	mu   sync.Mutex
	subs map[chan Change]bool
}

// Publish passes c to every subscriber; one that is behind misses it and
// gets the next.
func (h *Hub) Publish(c Change) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.subs {
		select {
		case ch <- c:
		default:
		}
	}
}

// Subscribe starts a subscription; the function ends it.
func (h *Hub) Subscribe() (<-chan Change, func()) {
	ch := make(chan Change, 8)
	h.mu.Lock()
	if h.subs == nil {
		h.subs = map[chan Change]bool{}
	}
	h.subs[ch] = true
	h.mu.Unlock()
	return ch, func() {
		h.mu.Lock()
		delete(h.subs, ch)
		h.mu.Unlock()
	}
}

// Subscribers is how many follow the hub now.
func (h *Hub) Subscribers() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.subs)
}

// Stream writes each change of h as Server-Sent Events until the request
// ends, with a comment every half minute so a dead connection is noticed.
func (h *Hub) Stream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	ch, done := h.Subscribe()
	defer done()
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	fmt.Fprint(w, ": following\n\n")
	flusher.Flush()
	beat := time.NewTicker(30 * time.Second)
	defer beat.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case c := <-ch:
			data, _ := json.Marshal(c)
			fmt.Fprintf(w, "data: %s\n\n", data)
		case <-beat.C:
			fmt.Fprint(w, ": still here\n\n")
		}
		flusher.Flush()
	}
}

// Server serves the engine of the homelab at Root.
type Server struct {
	Root   string
	Status func(ctx context.Context) (api.Status, error)
	// Now is Status without waiting for the apps' pages (/v1/status?now);
	// without it, Status answers both.
	Now func(ctx context.Context) (api.Status, error)
	// Watcher follows the runtime; its zero value uses the docker CLI.
	Watcher Watcher

	hub     Hub
	reading shared
}

// shared runs one reading of a kind at a time: a request that comes while
// one runs (the window and the menu bar item, both told of the same
// change) gets its result instead of reading the runtime again. Nothing is
// kept after it, so a request after an action never gets a reading from
// before it.
type shared struct {
	mu   sync.Mutex
	runs map[string]*reading
}

type reading struct {
	done chan struct{}
	st   api.Status
	err  error
}

// do returns the reading of kind running now, or starts one with read. It
// runs on its own clock, so a request that gives up does not cancel it for
// the others.
func (s *shared) do(ctx context.Context, kind string, read func(context.Context) (api.Status, error)) (api.Status, error) {
	s.mu.Lock()
	if s.runs == nil {
		s.runs = map[string]*reading{}
	}
	r, ok := s.runs[kind]
	if !ok {
		r = &reading{done: make(chan struct{})}
		s.runs[kind] = r
		go func() {
			rctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), time.Minute)
			r.st, r.err = read(rctx)
			cancel()
			s.mu.Lock()
			delete(s.runs, kind)
			s.mu.Unlock()
			close(r.done)
		}()
	}
	s.mu.Unlock()
	select {
	case <-r.done:
		return r.st, r.err
	case <-ctx.Done():
		return api.Status{}, ctx.Err()
	}
}

// Run follows the runtime and passes each change to the subscribers until
// ctx ends.
func (s *Server) Run(ctx context.Context) { s.Watcher.Run(ctx, s.hub.Publish) }

// Handler answers the API.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/hello", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, Hello{Version: Version, Root: s.Root})
	})
	mux.HandleFunc("GET /v1/status", func(w http.ResponseWriter, r *http.Request) {
		kind, read := "full", s.Status
		if r.URL.Query().Has("now") && s.Now != nil {
			kind, read = "now", s.Now
		}
		st, err := s.reading.do(r.Context(), kind, read)
		if err != nil {
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
			return
		}
		writeJSON(w, st)
	})
	mux.HandleFunc("GET /v1/events", s.hub.Stream)
	return mux
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

// ErrServed means another agent already serves the engine.
var ErrServed = errors.New("another agent already serves the engine")

// Serve listens on SocketPath and serves s until ctx ends. A socket left
// by an agent that stopped is replaced; one that answers is not.
func (s *Server) Serve(ctx context.Context) error {
	path := SocketPath()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	if c, err := net.DialTimeout("unix", path, time.Second); err == nil {
		c.Close()
		return ErrServed
	}
	_ = os.Remove(path)
	l, err := net.Listen("unix", path)
	if err != nil {
		return err
	}
	_ = os.Chmod(path, 0o600)
	go s.Run(ctx)
	srv := &http.Server{Handler: s.Handler(), ReadHeaderTimeout: 10 * time.Second}
	go func() {
		<-ctx.Done()
		_ = srv.Close()
	}()
	err = srv.Serve(l)
	_ = os.Remove(path)
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}
