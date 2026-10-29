//go:build realdocker

package realdocker

import (
	"bufio"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/engine"
)

// agentStreamsStatus serves the agent's engine for this homelab, follows
// its events as the window does, and stops ntfy behind its back: the
// stream carries the Status with ntfy stopped within two seconds, and
// nobody asks /v1/status for it (0.15: "no screen asks the runtime").
// ntfy is started again, and the stream carries that too.
func (l *lab) agentStreamsStatus(t *testing.T) {
	var target string
	for _, line := range strings.Fields(docker(t, "ps", "--format", "{{.Names}}", "--filter", "label=com.docker.compose.service=ntfy")) {
		target = line
	}
	if target == "" {
		t.Skip("ntfy is not running in this run")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	s := &engine.Server{Root: l.root, Now: func(ctx context.Context) (api.Status, error) { return core.StatusHere(ctx, l.root) }}
	var asked atomic.Int32
	h := s.Handler()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/status" {
			asked.Add(1)
		}
		h.ServeHTTP(w, r)
	}))
	defer srv.Close()
	go s.Run(ctx)

	changes := make(chan engine.Change, 16)
	go func() { // as engine.Client.Follow reads the stream
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL+"/v1/events", nil)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return
		}
		defer resp.Body.Close()
		sc := bufio.NewScanner(resp.Body)
		sc.Buffer(make([]byte, 64*1024), 16<<20)
		for sc.Scan() {
			if data, ok := strings.CutPrefix(sc.Text(), "data: "); ok {
				var c engine.Change
				if json.Unmarshal([]byte(data), &c) == nil {
					changes <- c
				}
			}
		}
	}()
	time.Sleep(2 * time.Second) // the watcher and the follower are both listening

	state := func(c engine.Change) string {
		if c.Status == nil {
			return ""
		}
		for _, a := range c.Status.Apps {
			if a.ID == "ntfy" {
				return a.State
			}
		}
		return ""
	}
	wait := func(want string, since time.Time) {
		t.Helper()
		for {
			select {
			case c := <-changes:
				if state(c) == want {
					if d := time.Since(since); d > 2*time.Second {
						t.Errorf("ntfy %s reached the stream %v after the runtime said so, over two seconds", want, d.Round(100*time.Millisecond))
					}
					return
				}
			case <-ctx.Done():
				t.Fatalf("the stream never carried ntfy %s", want)
			}
		}
	}
	docker(t, "stop", target)
	wait("stopped", time.Now())
	docker(t, "start", target)
	wait("running", time.Now())
	if n := asked.Load(); n != 0 {
		t.Errorf("Status was asked %d times; the stream should carry it", n)
	}
}
