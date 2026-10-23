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

// Server serves the engine of the homelab at Root.
type Server struct {
	Root   string
	Status func(ctx context.Context) (api.Status, error)
	// Watcher follows the runtime; its zero value uses the docker CLI.
	Watcher Watcher

	mu   sync.Mutex
	subs map[chan Change]bool
}

// Run follows the runtime and passes each change to the subscribers until
// ctx ends.
func (s *Server) Run(ctx context.Context) {
	s.Watcher.Run(ctx, func(c Change) {
		s.mu.Lock()
		defer s.mu.Unlock()
		for ch := range s.subs {
			select {
			case ch <- c:
			default: // a slow reader gets the next one
			}
		}
	})
}

func (s *Server) subscribe() (chan Change, func()) {
	ch := make(chan Change, 8)
	s.mu.Lock()
	if s.subs == nil {
		s.subs = map[chan Change]bool{}
	}
	s.subs[ch] = true
	s.mu.Unlock()
	return ch, func() {
		s.mu.Lock()
		delete(s.subs, ch)
		s.mu.Unlock()
	}
}

// Handler answers the API.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/hello", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, Hello{Version: Version, Root: s.Root})
	})
	mux.HandleFunc("GET /v1/status", func(w http.ResponseWriter, r *http.Request) {
		st, err := s.Status(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
			return
		}
		writeJSON(w, st)
	})
	mux.HandleFunc("GET /v1/events", s.events)
	return mux
}

// events streams each change until the client goes, with a comment every
// half minute so a dead connection is noticed.
func (s *Server) events(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	ch, done := s.subscribe()
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
