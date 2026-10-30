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
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/board"
)

// The agent serves the engine on a socket only this account can reach, so
// the app, the menu bar item, and the phone companion follow one engine
// instead of each asking the runtime themselves:
//
//	GET /v1/hello   {"version": 1, "root": "/Users/you/Homelab"}
//	GET /v1/status  the state of every app (api.Status)
//	GET /v1/status/last  the last state read, and when (api.Reading)
//	GET /v1/events  each Change as it happens, with the Status read after it
//	                (Server-Sent Events)
//	GET /v1/cards?n=1&want=watchdog,alerts  the cards beside Status
//	                (board.Card), a line of JSON each as it is read

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
	// Cards are the cards beside Status the agent reads (/v1/cards); nil
	// serves none.
	Cards board.Readers

	hub     Hub
	reading shared
	cards   cardRuns

	lastMu sync.Mutex
	last   *api.Reading // the last good reading, for a window that opens
}

// keep remembers st as the last reading.
func (s *Server) keep(st api.Status) {
	s.lastMu.Lock()
	s.last = &api.Reading{Status: st, At: time.Now()}
	s.lastMu.Unlock()
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
// ctx ends, with the Status read after it (the quick reading, shared with a
// request that comes meanwhile), so no subscriber has to ask for it. When
// that reading fails, the change goes without it and they ask.
func (s *Server) Run(ctx context.Context) {
	s.Watcher.Run(ctx, func(c Change) { s.publish(ctx, c) })
}

// publish passes c to the subscribers with the Status read after it.
func (s *Server) publish(ctx context.Context, c Change) {
	read := s.Now
	if read == nil {
		read = s.Status
	}
	if read != nil {
		if st, err := s.reading.do(ctx, "now", read); err == nil {
			s.keep(st)
			c.Status = &st
		}
	}
	s.hub.Publish(c)
}

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
		s.keep(st)
		writeJSON(w, st)
	})
	// Only asked for by name: /v1/status itself always reads the runtime, so
	// what an action changed is never answered with a reading from before it.
	mux.HandleFunc("GET /v1/status/last", func(w http.ResponseWriter, _ *http.Request) {
		s.lastMu.Lock()
		last := s.last
		s.lastMu.Unlock()
		if last == nil {
			http.Error(w, "no status read yet", http.StatusNotFound)
			return
		}
		writeJSON(w, last)
	})
	mux.HandleFunc("GET /v1/events", s.hub.Stream)
	mux.HandleFunc("GET /v1/cards", s.serveCards)
	return mux
}

// cardFresh is how long a card's reading answers another request: the
// window and the phone opened together read each card once.
const cardFresh = 5 * time.Second

// serveCards reads the cards asked for side by side, each shared with any
// request for it at the same time, and sends each as a line of JSON as
// soon as it is read; a card it does not read says so (board.NotHere).
func (s *Server) serveCards(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	n, _ := strconv.Atoi(q.Get("n"))
	var want []string
	for _, name := range strings.Split(q.Get("want"), ",") {
		if name != "" {
			want = append(want, name)
		}
	}
	shared := board.Readers{}
	for name, read := range s.Cards {
		shared[name] = func(ctx context.Context) (any, error) { return s.cards.do(ctx, name, read) }
	}
	w.Header().Set("Content-Type", "application/x-ndjson")
	flusher, _ := w.(http.Flusher)
	enc := json.NewEncoder(w)
	board.Read(r.Context(), shared, n, want, func(c board.Card) {
		_ = enc.Encode(c)
		if flusher != nil {
			flusher.Flush()
		}
	})
}

// cardRuns shares each card's reading: a request that comes while one runs,
// or within cardFresh of it, gets its result.
type cardRuns struct {
	mu   sync.Mutex
	runs map[string]*cardRun
}

type cardRun struct {
	done chan struct{}
	at   time.Time // when it was read
	v    any
	err  error
}

func (c *cardRuns) do(ctx context.Context, name string, read board.Reader) (any, error) {
	c.mu.Lock()
	if c.runs == nil {
		c.runs = map[string]*cardRun{}
	}
	r, ok := c.runs[name]
	if ok {
		select {
		case <-r.done:
			ok = time.Since(r.at) < cardFresh
		default: // still reading
		}
	}
	if !ok {
		r = &cardRun{done: make(chan struct{})}
		c.runs[name] = r
		go func() {
			rctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), time.Minute)
			r.v, r.err = read(rctx)
			cancel()
			c.mu.Lock()
			r.at = time.Now()
			c.mu.Unlock()
			close(r.done)
		}()
	}
	c.mu.Unlock()
	select {
	case <-r.done:
		return r.v, r.err
	case <-ctx.Done():
		return nil, ctx.Err()
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
