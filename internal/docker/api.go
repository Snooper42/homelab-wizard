package docker

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/dockerapi"
)

// The reads the homelab makes all the time (the containers, their events,
// what they use, the engine's info) and the commands it runs in containers
// (docker exec: the database dumps, cscli) go to the engine's API when its
// socket is found (internal/dockerapi), and to the CLI as before when it
// is not, when DOCKER_API is off, or after any error the API gives: then
// the CLI says what is wrong, in its own words, and the fallback is kept
// for homelab doctor and the report. A command that started is never run
// again by the CLI: how it failed is told in the CLI's words instead.

// Fallback is the last time a read went back to the CLI, and why.
type Fallback struct {
	When time.Time
	Read string // "containers", "info", "events", "stats", "exec"
	Err  string
}

var (
	fallbackMu sync.Mutex
	fallback   Fallback
)

// LastFallback is the last read that went back to the CLI; zero when none
// did.
func LastFallback() Fallback {
	fallbackMu.Lock()
	defer fallbackMu.Unlock()
	return fallback
}

// OnFallback hears of each read that went back to the CLI, to keep it
// where homelab doctor and the report find it (core sets it).
var OnFallback = func(Fallback) {}

// Settings is the homelab's .env, for DOCKER_API (core sets it).
var Settings = func() map[string]string { return nil }

// restFor is how long the API rests after a fallback: the CLI answers
// meanwhile, rather than every read trying the API first again.
const restFor = 10 * time.Minute

// resting is whether a fallback was too recent to try the API again.
func resting() bool {
	fallbackMu.Lock()
	defer fallbackMu.Unlock()
	return !fallback.When.IsZero() && time.Since(fallback.When) < restFor
}

func fellBack(read string, err error) {
	f := Fallback{When: time.Now(), Read: read, Err: err.Error()}
	fallbackMu.Lock()
	fallback = f
	fallbackMu.Unlock()
	OnFallback(f)
}

// APIOff is whether DOCKER_API (in .env, or this process's environment)
// turns the API off, so every read uses the CLI.
func APIOff(env map[string]string) bool {
	v := env["DOCKER_API"]
	if v == "" {
		v = os.Getenv("DOCKER_API")
	}
	return strings.EqualFold(v, "off") || strings.EqualFold(v, "false")
}

// WithAPI gives c the engine's API when its socket is found and
// DOCKER_API does not turn it off.
func WithAPI(c *Client) *Client {
	if APIOff(Settings()) {
		return c
	}
	if sock, err := dockerapi.Find(); err == nil {
		c.API = dockerapi.New(sock)
	}
	return c
}

// Reads says how this client reads the engine, for homelab doctor: "the
// engine's API at <socket>", or "the docker command".
func (c *Client) Reads() string {
	if c.API != nil {
		return "the engine's API at " + c.API.Socket
	}
	return "the docker command"
}

func (c *Client) apiContainers(ctx context.Context) ([]Container, bool) {
	if c.API == nil || resting() {
		return nil, false
	}
	data, err := c.API.Inspect(ctx)
	if err == nil {
		var cs []Container
		if cs, err = ParseInspect(data); err == nil {
			return cs, true
		}
	}
	if ctx.Err() == nil {
		fellBack("containers", err)
	}
	return nil, false
}

func (c *Client) apiInfo(ctx context.Context) (Info, bool) {
	if c.API == nil || resting() {
		return Info{}, false
	}
	var info Info
	data, err := c.API.Info(ctx)
	if err == nil {
		if err = json.Unmarshal(data, &info); err == nil {
			return info, true
		}
		err = fmt.Errorf("engine API info: %w", err)
	}
	if ctx.Err() == nil {
		fellBack("info", err)
	}
	return Info{}, false
}

func (c *Client) apiStats(ctx context.Context) ([]Stat, bool) {
	if c.API == nil || resting() {
		return nil, false
	}
	raw, err := c.API.Stats(ctx)
	if err != nil {
		if ctx.Err() == nil {
			fellBack("stats", err)
		}
		return nil, false
	}
	stats := make([]Stat, len(raw))
	for i, s := range raw {
		stats[i] = Stat{Name: s.Name, CPU: s.CPU, Mem: s.Mem}
	}
	sortStats(stats)
	return stats, true
}

// apiEvents follows the events through the API; false when it could not
// start, so the CLI follows them instead.
func (c *Client) apiEvents(ctx context.Context, fn func(Event)) (error, bool) {
	if c.API == nil || resting() {
		return nil, false
	}
	started := false
	err := c.API.Events(ctx, eventActions, func(line []byte) {
		started = true
		var e Event
		if json.Unmarshal(line, &e) == nil && e.Action != "" && !strings.HasPrefix(e.Action, "exec_") {
			fn(e)
		}
	})
	if ctx.Err() != nil {
		return ctx.Err(), true
	}
	// A stream that ran and then ended is the engine stopping, as the
	// CLI's would; one that never answered goes back to the CLI.
	if started {
		return err, true
	}
	fellBack("events", err)
	return nil, false
}

// apiExec runs cmd in container through the API, with env ("NAME=value"),
// its stdout to stdout, failing in the words the CLI would (cli is the
// docker command's arguments): "docker exec x pg_dump: <what it printed on
// stderr>" or "...: exit status 1", "...: Error response from daemon: No
// such container: x". ran is false when the API is not used or the
// command did not start, so the CLI runs it instead.
func (c *Client) apiExec(ctx context.Context, container string, env, cmd []string, stdout io.Writer, cli []string) (ran bool, err error) {
	if c.API == nil || resting() {
		return false, nil
	}
	var stderr bytes.Buffer
	code, err := c.API.Exec(ctx, container, cmd, env, stdout, &stderr)
	words := filepath.Base(c.Bin) + " " + strings.Join(cli, " ")
	var refused *dockerapi.Error
	switch {
	case errors.Is(err, dockerapi.ErrNotStarted):
		if ctx.Err() == nil {
			fellBack("exec", err)
		}
		return false, nil
	case errors.As(err, &refused):
		return true, fmt.Errorf("%s: Error response from daemon: %s", words, refused.Message)
	case err != nil:
		return true, fmt.Errorf("%s: %w", words, err)
	case code != 0:
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = fmt.Sprintf("exit status %d", code)
		}
		return true, fmt.Errorf("%s: %s", words, msg)
	}
	return true, nil
}
