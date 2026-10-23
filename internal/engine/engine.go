// Package engine is the homelab's engine as something to follow rather than
// to ask: it watches the container runtime and reports each change, so the
// app (and later the agent's local API) shows the apps as they are, not as
// they were at the last poll.
package engine

import (
	"context"
	"sort"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// Change says what moved: apps whose containers were created, started,
// stopped, removed, or changed health, or the runtime itself coming or going.
type Change struct {
	Apps    []string `json:"apps,omitempty"`    // Compose services, sorted
	Runtime bool     `json:"runtime,omitempty"` // the runtime came up or went away
}

// Watcher follows the runtime and reports changes.
type Watcher struct {
	// Connect reaches the runtime; nil uses the docker CLI and checks the
	// engine answers.
	Connect func(ctx context.Context) (*docker.Client, error)
	// Quiet is how long a burst of events (an install starts a dozen
	// containers) is gathered into one change; 0 means 400ms.
	Quiet time.Duration
	// Retry is how long to wait before reaching the runtime again after it
	// is gone; 0 means 3s.
	Retry time.Duration
}

// Run follows the runtime until ctx ends, calling fn for each change. It
// reconnects when the runtime stops and starts again, and reports both.
func (w Watcher) Run(ctx context.Context, fn func(Change)) {
	connect, quiet, retry := w.Connect, w.Quiet, w.Retry
	if connect == nil {
		connect = reach
	}
	if quiet == 0 {
		quiet = 400 * time.Millisecond
	}
	if retry == 0 {
		retry = 3 * time.Second
	}
	up := -1 // unknown, then 0 or 1: report only the runtime's changes
	seen := func(now int) {
		if up >= 0 && up != now {
			fn(Change{Runtime: true})
		}
		up = now
	}
	for ctx.Err() == nil {
		c, err := connect(ctx)
		if err != nil {
			seen(0)
		} else {
			seen(1)
			follow(ctx, c, quiet, fn)
			if ctx.Err() == nil {
				seen(0)
			}
		}
		select {
		case <-ctx.Done():
		case <-time.After(retry):
		}
	}
}

// follow reports the events of one connection, gathered per quiet period,
// until the runtime stops or ctx ends.
func follow(ctx context.Context, c *docker.Client, quiet time.Duration, fn func(Change)) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	events := make(chan docker.Event, 64)
	done := make(chan struct{})
	go func() {
		defer close(done)
		_ = c.Events(ctx, func(e docker.Event) {
			select {
			case events <- e:
			default: // a change is already waiting to be reported
			}
		})
	}()
	pending := map[string]bool{}
	var flush <-chan time.Time
	report := func() {
		if len(pending) == 0 {
			return
		}
		apps := make([]string, 0, len(pending))
		for a := range pending {
			apps = append(apps, a)
		}
		sort.Strings(apps)
		fn(Change{Apps: apps})
		pending, flush = map[string]bool{}, nil
	}
	for {
		select {
		case <-ctx.Done():
			return
		case e := <-events:
			pending[e.Service()] = true
			if flush == nil {
				flush = time.After(quiet)
			}
		case <-flush:
			report()
		case <-done:
			for {
				select {
				case e := <-events:
					pending[e.Service()] = true
				default:
					report()
					return
				}
			}
		}
	}
}

// reach finds the docker CLI and checks the engine answers.
func reach(ctx context.Context) (*docker.Client, error) {
	c, err := docker.New()
	if err != nil {
		return nil, err
	}
	if _, err := c.Info(ctx); err != nil {
		return nil, err
	}
	return c, nil
}
