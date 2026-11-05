// Package turn is the homelab's queue for changes, shared by every
// process that makes one: the app, homelab serve for a phone, the agent's
// nightly backup and update, and homelab in a terminal. Two of them
// changing the apps at once (an update in the app while the nightly backup
// stops a database, or a phone's Restart in the middle of it) would race
// on Docker Compose. Each job that changes something takes a ticket in
// data/turns, named by when it asked; it goes when its ticket is the
// oldest held by a process still running, and its ticket goes when it
// ends, however it ends. A process that died leaves a ticket no one
// waits for. A job's own children (homelab backup from homelab update)
// have its turn already: it is passed down in HOMELAB_TURN.
package turn

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/lockedfile"
)

// Env names the ticket a process holds, for its children.
const Env = "HOMELAB_TURN"

// Ticket is one job's place: which process, what it does, when it asked.
type Ticket struct {
	PID  int       `json:"pid"`
	What string    `json:"what"`
	At   time.Time `json:"at"`
	// Host is the machine it was made on: one that came with a homelab
	// folder copied from another machine stands for no job here.
	Host string `json:"host,omitempty"`
	file string
}

// Dir is where the tickets are.
func Dir(root string) string { return filepath.Join(root, "data", "turns") }

// What tests replace: this process, whether one runs, how often a job
// that waits looks again, and how old a ticket may be before it is taken
// for one a process left behind (a process ID used again after a crash).
// hostname is this machine's name, as tickets keep it.
func hostname() string {
	h, _ := os.Hostname()
	return h
}

var (
	pid    = os.Getpid
	alive  = processAlive
	poll   = 250 * time.Millisecond
	MaxAge = 12 * time.Hour
)

// Take waits for this process's turn to change the homelab and holds it
// until release. waiting is told the job ahead whenever it changes, so the
// one that waits can say what it waits for. A ctx that ends while it waits
// gives up its place.
func Take(ctx context.Context, root, what string, waiting func(ahead Ticket)) (release func(), err error) {
	if held := os.Getenv(Env); held != "" {
		if _, err := os.Stat(held); err == nil {
			return func() {}, nil // a child of the job that has the turn
		}
	}
	dir := Dir(root)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	t := Ticket{PID: pid(), What: what, At: time.Now().UTC(), Host: hostname()}
	file := filepath.Join(dir, fmt.Sprintf("%020d-%d.json", t.At.UnixNano(), t.PID))
	data, _ := json.Marshal(t)
	// Whole or not at all: a ticket read half-written would be taken for
	// one a process left behind, and cleared.
	if err := lockedfile.Write(file, data, 0o600); err != nil {
		return nil, err
	}
	told := ""
	for {
		ahead, ok := First(root)
		if !ok || ahead.file == file {
			_ = os.Setenv(Env, file)
			return func() {
				_ = os.Unsetenv(Env)
				_ = os.Remove(file)
			}, nil
		}
		if waiting != nil && ahead.file != told {
			told = ahead.file
			waiting(ahead)
		}
		select {
		case <-ctx.Done():
			_ = os.Remove(file)
			return nil, ctx.Err()
		case <-time.After(poll):
		}
	}
}

// First is the job whose turn it is: the oldest ticket held by a process
// still running. Tickets a process left behind are cleared on the way.
func First(root string) (Ticket, bool) {
	all := Queue(root)
	if len(all) == 0 {
		return Ticket{}, false
	}
	return all[0], true
}

// Queue is every job with a ticket, the one whose turn it is first.
func Queue(root string) []Ticket {
	dir := Dir(root)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() && filepath.Ext(e.Name()) == ".json" {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names) // named by when they asked
	var out []Ticket
	for _, n := range names {
		file := filepath.Join(dir, n)
		var t Ticket
		data, err := os.ReadFile(file)
		if err != nil {
			continue // its job ended as we looked
		}
		if json.Unmarshal(data, &t) != nil || t.PID <= 0 || t.Host != hostname() || !alive(t.PID) || time.Since(t.At) > MaxAge {
			_ = os.Remove(file)
			continue
		}
		t.file = file
		out = append(out, t)
	}
	return out
}
