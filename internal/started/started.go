// Package started keeps why the homelab last started or restarted each
// app: you (Start, Restart, or Update), the nightly update, Fix it, the
// watchdog, the battery saver when power came back, a drive coming back,
// or the end of a Stop for a while. Status matches it to the container's start time, so "up 9
// minutes" can say why on hover. Docker's own restart of an app that
// stopped on its own is in its restart count, so needs no line here. The
// record is data/started.json, beside stopped.json.
package started

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

// The reasons an app was started by the homelab.
const (
	You      = "you"      // Start or Restart, from the app, the phone, or homelab start
	Updated  = "updated"  // Update, by you
	Nightly  = "nightly"  // the nightly update
	Fix      = "fix"      // Fix it
	Watchdog = "watchdog" // unwell on two checks in a row
	Battery  = "battery"  // the battery saver, when power came back
	Drive    = "drive"    // its drive was plugged in again
	Timer    = "timer"    // the time a Stop for a while ended came
)

// Start is when and why one app last started.
type Start struct {
	At  time.Time `json:"at"`
	Why string    `json:"why"`
}

// Record is each app's last start, by app ID.
type Record map[string]Start

// Path is where the record is kept.
func Path(root string) string { return filepath.Join(root, "data", "started.json") }

// Load reads the record; none (or one that does not read) is an empty one.
func Load(path string) Record {
	r := Record{}
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &r)
	}
	if r == nil {
		r = Record{}
	}
	return r
}

// Keep is how long a start is kept: past it, nothing on Status asks.
const Keep = 60 * 24 * time.Hour

// Note records that the homelab started ids now, for why. It never fails
// the start it follows: an error only means the hover will not know.
func Note(root, why string, now time.Time, ids ...string) error {
	if len(ids) == 0 {
		return nil
	}
	path := Path(root)
	r := Load(path)
	for _, id := range ids {
		r[id] = Start{At: now.UTC(), Why: why}
	}
	for id, s := range r {
		if now.Sub(s.At) > Keep {
			delete(r, id)
		}
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(r, "", "  ")
	return os.WriteFile(path, append(data, '\n'), 0o644)
}

// Near is how far apart a noted start and the container's own start time
// may be and still be the same start: Compose notes it once the command
// returns, and a slow app takes a while to come up.
const Near = 5 * time.Minute

// Why is why id's container, started at since, last started: the noted
// reason when it was noted about then, else "".
func (r Record) Why(id string, since time.Time) string {
	s, ok := r[id]
	if !ok || since.IsZero() {
		return ""
	}
	if d := s.At.Sub(since); d < -Near || d > Near {
		return ""
	}
	return s.Why
}
