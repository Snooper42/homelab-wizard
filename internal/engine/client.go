package engine

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
)

// Client talks to the engine the agent serves.
type Client struct {
	http *http.Client
}

// Dial reaches the agent's engine and checks it serves the homelab at root.
func Dial(ctx context.Context, root string) (*Client, error) {
	return dialPath(ctx, SocketPath(), root)
}

func dialPath(ctx context.Context, path, root string) (*Client, error) {
	c := &Client{http: &http.Client{Transport: &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			var d net.Dialer
			return d.DialContext(ctx, "unix", path)
		},
	}}}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	var h Hello
	if err := c.get(ctx, "/v1/hello", &h); err != nil {
		return nil, err
	}
	if h.Version != Version {
		return nil, fmt.Errorf("the agent's engine speaks version %d, not %d", h.Version, Version)
	}
	if !sameFolder(h.Root, root) {
		return nil, fmt.Errorf("the agent serves %s, not %s", h.Root, root)
	}
	return c, nil
}

func sameFolder(a, b string) bool {
	return strings.EqualFold(filepath.Clean(a), filepath.Clean(b))
}

func (c *Client) get(ctx context.Context, path string, v any) error {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, "http://engine"+path, nil)
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		var b bytes.Buffer
		_, _ = b.ReadFrom(resp.Body)
		return errors.New(strings.TrimSpace(b.String()))
	}
	return json.NewDecoder(resp.Body).Decode(v)
}

// Status is the state of every app, as the agent's engine sees it.
func (c *Client) Status(ctx context.Context) (api.Status, error) {
	var st api.Status
	err := c.get(ctx, "/v1/status", &st)
	return st, err
}

// LastStatus is the last Status the agent's engine read, and when.
func (c *Client) LastStatus(ctx context.Context) (api.Reading, error) {
	var r api.Reading
	err := c.get(ctx, "/v1/status/last", &r)
	return r, err
}

// StatusNow is the agent's Status without waiting for the apps' pages
// (Checking says some are still to be asked).
func (c *Client) StatusNow(ctx context.Context) (api.Status, error) {
	var st api.Status
	err := c.get(ctx, "/v1/status?now", &st)
	return st, err
}

// Follow calls fn with each change until ctx ends or the agent goes away.
func (c *Client) Follow(ctx context.Context, fn func(Change)) error {
	return c.follow(ctx, func() {}, fn)
}

// follow is Follow calling opened once the stream is open.
func (c *Client) follow(ctx context.Context, opened func(), fn func(Change)) error {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, "http://engine/v1/events", nil)
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("engine events: %s", resp.Status)
	}
	opened()
	sc := bufio.NewScanner(resp.Body)
	// A change carries the whole Status: far over the scanner's 64 KB
	// line for a homelab of a hundred apps.
	sc.Buffer(make([]byte, 64*1024), 16<<20)
	for sc.Scan() {
		data, ok := strings.CutPrefix(sc.Text(), "data: ")
		if !ok {
			continue
		}
		var ch Change
		if json.Unmarshal([]byte(data), &ch) == nil {
			fn(ch)
		}
	}
	if err := sc.Err(); err != nil && ctx.Err() == nil {
		return err
	}
	return nil
}

// lookAgain is how long Follow follows the runtime here before looking for
// the agent again.
var lookAgain = time.Minute

// Follow calls fn with each change in the homelab at root until ctx ends:
// from the agent's engine when it runs, else by following the runtime here
// and looking for the agent again each minute. Following the agent again
// after it went away, or the runtime here after the agent, starts with a
// change marked Again, for what was missed in between.
func Follow(ctx context.Context, root string, fn func(Change)) {
	followed := "" // what was followed last: "agent", "here", or nothing yet
	again := func(now string) {
		if followed != "" && (now == "agent" || followed == "agent") {
			fn(Change{Again: true})
		}
		followed = now
	}
	for ctx.Err() == nil {
		if c, err := Dial(ctx, root); err == nil {
			_ = c.follow(ctx, func() { again("agent") }, fn)
			select { // the agent went away: a moment before looking again
			case <-ctx.Done():
			case <-time.After(time.Second):
			}
			continue
		}
		local, cancel := context.WithTimeout(ctx, lookAgain)
		again("here")
		Watcher{}.Run(local, fn)
		cancel()
	}
}
