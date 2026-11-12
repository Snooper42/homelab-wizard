package updates

// The short hold (backlog items 87 and 88, the owner's decision of Nov 12):
// the apps that hold every password (Vaultwarden), every sign-in (Pocket
// ID), and who is banned (CrowdSec) take a new image only once it has been
// out a few days (x-homelab hold), counted from when this homelab first saw
// it in the registry, not from a date the image carries, which whoever
// pushed it chose. A release pulled for a fault in its first days never
// arrives; one that stays arrives a few days late. So that a project
// releasing faster than the hold still updates, an app waiting MaxHold
// takes whatever is newest then.

import (
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/lockedfile"
)

// MaxHold is the longest an app waits on new releases before it takes the
// newest, however new.
const MaxHold = 14 * 24 * time.Hour

// Wait is one app's wait: the digest seen in its registry, since when, and
// since when the app has been behind at all.
type Wait struct {
	Digest string    `json:"digest"`
	Seen   time.Time `json:"seen"`
	Behind time.Time `json:"behind"`
}

// Holds are the apps waiting, by ID.
type Holds map[string]Wait

// HoldPath is where the waits are kept.
func HoldPath(root string) string { return filepath.Join(root, "data", "update-holds.json") }

// LoadHolds reads the waits; none when there are none yet.
func LoadHolds(path string) Holds {
	h := Holds{}
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &h)
	}
	return h
}

// Save writes the waits.
func (h Holds) Save(path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(h, "", "  ")
	return lockedfile.Write(path, append(data, '\n'), 0o600)
}

// Decide says whether app, held days days, takes its registry's newest
// image (remote) now, given the digests the image here is known by
// (local). It changes h: a digest seen for the first time is noted, and an
// app whose image here is the newest is waiting for nothing. until is
// when it will take it, when it waits. A digest the registry wouldn't give
// ("") holds nothing: the app updates as it would have.
func (h Holds) Decide(app string, days int, remote string, local []string, now time.Time) (take bool, until time.Time) {
	if days <= 0 || remote == "" {
		return true, time.Time{}
	}
	for _, d := range local {
		if strings.HasSuffix(d, "@"+remote) {
			delete(h, app)
			return true, time.Time{}
		}
	}
	w := h[app]
	if w.Behind.IsZero() {
		w.Behind = now
	}
	if w.Digest != remote {
		w.Digest, w.Seen = remote, now
	}
	h[app] = w
	until = w.Seen.Add(time.Duration(days) * 24 * time.Hour)
	if !now.Before(until) || now.Sub(w.Behind) >= MaxHold {
		return true, time.Time{}
	}
	return false, until
}

// Waiting is the IDs waiting now, sorted.
func (h Holds) Waiting() []string {
	var ids []string
	for id := range h {
		ids = append(ids, id)
	}
	slices.Sort(ids)
	return ids
}
