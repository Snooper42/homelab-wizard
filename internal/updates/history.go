package updates

import (
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"time"
)

// Keep is how long the image an app ran before an update stays, ready to
// go back to.
const Keep = 7 * 24 * time.Hour

// Watch is how long after an update an app that stays unwell is rolled
// back by itself: from Settle after the update until Watch.
const (
	Settle = 20 * time.Minute
	Watch  = 6 * time.Hour
)

// HeldKey is the .env setting listing the apps whose updates are held
// (after a rollback, or homelab updates hold): the nightly update passes
// over them.
const HeldKey = "UPDATES_HELD"

// Record is what the homelab saw of one app's image.
type Record struct {
	Ref     string `json:"ref"`     // what it is started from, e.g. lscr.io/linuxserver/sonarr:latest
	Current string `json:"current"` // the image it runs (sha256:…)
	// Previous is the image it ran before its last update, kept under
	// RollbackRef until Keep has passed; "" when there is none.
	Previous   string    `json:"previous,omitempty"`
	Updated    time.Time `json:"updated"`
	RolledBack time.Time `json:"rolledBack"`
	// HealthyAfter is when the watchdog first saw the app well after its
	// last update; zero until then. Until it has, nothing new can have
	// been written, so its rollback may put its data back by itself.
	HealthyAfter time.Time `json:"healthyAfter,omitempty"`
}

// History is every app's Record, kept in data/updates.json.
type History struct {
	Apps map[string]*Record `json:"apps"`
}

// HistoryPath is the history in the homelab folder.
func HistoryPath(root string) string { return filepath.Join(root, "data", "updates.json") }

// LoadHistory reads path; a missing file is an empty history.
func LoadHistory(path string) History {
	h := History{}
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &h)
	}
	if h.Apps == nil {
		h.Apps = map[string]*Record{}
	}
	return h
}

// Save writes the history.
func (h History) Save(path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(h, "", "  ")
	return os.WriteFile(path, append(data, '\n'), 0o644)
}

// RollbackRef is the name the image an app ran before its last update is
// kept under, so cleaning up unused images leaves it.
func RollbackRef(app string) string { return "homelab-rollback/" + app + ":previous" }

// Seen is a running app's image now.
type Seen struct{ Ref, ImageID string }

// Change is an app whose image changed since the last look.
type Change struct {
	App      string
	From, To string
}

// Observe notes each running app's image and returns the ones that changed
// (an update). Recording the old one as Previous is up to the caller, once
// it is kept under RollbackRef.
func (h *History) Observe(seen map[string]Seen) []Change {
	var out []Change
	for app, s := range seen {
		if s.ImageID == "" {
			continue
		}
		r := h.Apps[app]
		if r == nil {
			h.Apps[app] = &Record{Ref: s.Ref, Current: s.ImageID}
			continue
		}
		r.Ref = s.Ref
		if r.Current != s.ImageID {
			out = append(out, Change{App: app, From: r.Current, To: s.ImageID})
			r.Current, r.HealthyAfter = s.ImageID, time.Time{}
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].App < out[j].App })
	return out
}

// Expired are the apps whose kept image is older than Keep.
func (h History) Expired(now time.Time) []string {
	var out []string
	for app, r := range h.Apps {
		if r.Previous != "" && now.Sub(r.Updated) > Keep {
			out = append(out, app)
		}
	}
	sort.Strings(out)
	return out
}

// CanRollBack reports whether app has an earlier image to go back to.
func (h History) CanRollBack(app string) bool {
	r := h.Apps[app]
	return r != nil && r.Previous != ""
}

// Recent reports whether app was updated between Settle and Watch ago:
// long enough to have started, recent enough to blame the update.
func (h History) Recent(app string, now time.Time) bool {
	r := h.Apps[app]
	if r == nil || r.Previous == "" {
		return false
	}
	since := now.Sub(r.Updated)
	return since >= Settle && since <= Watch
}

// Held lists the apps whose updates are held, from .env values.
func Held(env map[string]string) []string {
	var out []string
	for _, id := range strings.Split(env[HeldKey], ",") {
		if id = strings.TrimSpace(id); id != "" {
			out = append(out, id)
		}
	}
	return out
}

// SetHeld adds an app to the held list, or takes it off, and returns the
// new value for HeldKey.
func SetHeld(env map[string]string, app string, held bool) string {
	a := slices.DeleteFunc(Held(env), func(v string) bool { return v == app })
	if held {
		a = append(a, app)
	}
	return strings.Join(a, ",")
}
