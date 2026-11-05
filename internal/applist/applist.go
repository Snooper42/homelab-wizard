// Package applist keeps a list of apps the homelab writes as a record of
// its own in data/ (the apps pinned to the top of Status, those whose
// alerts are off), rather than as a line in .env. The app, a phone, and a
// terminal can each change one, so it is changed under its lock
// (internal/lockedfile) and saved whole, 0600; the Secrets backup copies
// it with the other records. Each list was a .env key before: readers
// take the record and the key together until Carry moves the key's apps
// into the record and takes it out of .env, so nothing is lost on upgrade.
package applist

import (
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/lockedfile"
)

// List is one such list: its file in data/, and the .env key it was.
type List struct {
	File string
	Key  string
}

// The lists, and Moved, every one to carry over from .env.
var (
	// AlertsOff are the apps the watchdog still checks and shows, but does
	// not alert about (homelab notify off|on <app>).
	AlertsOff = List{File: "alerts-off.json", Key: "ALERTS_OFF"}
	// Pinned are the apps at the top of Status and of the menu bar's Open
	// an app, in the order pinned (homelab pin|unpin <app>).
	Pinned = List{File: "pinned.json", Key: "APPS_PINNED"}

	Moved = []List{AlertsOff, Pinned}
)

// Path is the record in the homelab folder.
func (l List) Path(root string) string { return filepath.Join(root, "data", l.File) }

type record struct {
	Apps []string `json:"apps"`
}

func parse(data []byte) []string {
	var r record
	_ = json.Unmarshal(data, &r)
	return r.Apps
}

// fromEnv is the list in env's key, from before the record.
func (l List) fromEnv(env map[string]string) []string {
	var out []string
	for _, id := range strings.Split(env[l.Key], ",") {
		if id = strings.TrimSpace(id); id != "" {
			out = append(out, id)
		}
	}
	return out
}

// union is a followed by what of b it lacks, each app once.
func union(a, b []string) []string {
	var out []string
	for _, id := range slices.Concat(a, b) {
		if !slices.Contains(out, id) {
			out = append(out, id)
		}
	}
	return out
}

// Load lists the apps, in their order: the record in root (none when root
// is ""), then any env still lists from before it.
func (l List) Load(root string, env map[string]string) []string {
	var kept []string
	if root != "" {
		if data, err := os.ReadFile(l.Path(root)); err == nil {
			kept = parse(data)
		}
	}
	return union(kept, l.fromEnv(env))
}

// Set puts an app on the list (at its end) or takes it off.
func (l List) Set(root, app string, on bool) error {
	return l.change(root, func(apps []string) []string {
		apps = slices.DeleteFunc(apps, func(id string) bool { return id == app })
		if on {
			apps = append(apps, app)
		}
		return apps
	})
}

// Carry moves the apps in env's key into the record and takes the key
// (and its note) out of env, for the caller to save; it reports whether
// the key was there.
func (l List) Carry(root string, env *envfile.File) (bool, error) {
	if _, ok := env.Get(l.Key); !ok {
		return false, nil
	}
	if from := l.fromEnv(env.Map()); len(from) > 0 {
		if err := l.change(root, func(apps []string) []string { return union(apps, from) }); err != nil {
			return false, err
		}
	}
	env.Delete(l.Key)
	return true, nil
}

func (l List) change(root string, change func([]string) []string) error {
	return lockedfile.Update(l.Path(root), 0o600, func(old []byte) ([]byte, bool) {
		apps := change(union(parse(old), nil))
		if apps == nil {
			apps = []string{}
		}
		data, err := json.MarshalIndent(record{Apps: apps}, "", "  ")
		return append(data, '\n'), err == nil
	})
}
