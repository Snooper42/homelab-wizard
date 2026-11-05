package notify

import (
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/lockedfile"
)

// The apps the watchdog does not alert about (homelab notify off <app>; on
// puts one back) are a record in data/, alerts-off.json, which the
// Secrets backup copies with the rest. Their checks still run and show on
// Status. The app, a phone, and a terminal can each change it, so it is
// changed under its lock (internal/lockedfile).

// QuietKey is the .env setting that held the list before the record:
// read until CarryQuiet moves it, so nothing is lost on upgrade.
const QuietKey = "ALERTS_OFF"

// QuietPath is the record in the homelab folder.
func QuietPath(root string) string { return filepath.Join(root, "data", "alerts-off.json") }

type quietRecord struct {
	Apps []string `json:"apps"`
}

func readQuiet(data []byte) []string {
	var r quietRecord
	_ = json.Unmarshal(data, &r)
	return r.Apps
}

// envQuiet is the list in .env's QuietKey, from before the record.
func envQuiet(env map[string]string) []string {
	var out []string
	for _, id := range strings.Split(env[QuietKey], ",") {
		if id = strings.TrimSpace(id); id != "" {
			out = append(out, id)
		}
	}
	return out
}

// union is a followed by what of b it lacks.
func union(a, b []string) []string {
	out := slices.Clone(a)
	for _, id := range b {
		if !slices.Contains(out, id) {
			out = append(out, id)
		}
	}
	return out
}

// LoadQuiet lists the apps whose alerts are off: the record in root (none
// when root is ""), and any env still lists from before it.
func LoadQuiet(root string, env map[string]string) []string {
	var kept []string
	if root != "" {
		if data, err := os.ReadFile(QuietPath(root)); err == nil {
			kept = readQuiet(data)
		}
	}
	return union(kept, envQuiet(env))
}

// SetQuiet turns an app's alerts off (quiet) or on again.
func SetQuiet(root, app string, quiet bool) error {
	return changeQuiet(root, func(apps []string) []string {
		apps = slices.DeleteFunc(apps, func(id string) bool { return id == app })
		if quiet {
			apps = append(apps, app)
		}
		return apps
	})
}

// CarryQuiet moves the apps in env's QuietKey into the record and takes
// the key out of env, for the caller to save; it reports whether there
// was one.
func CarryQuiet(root string, env *envfile.File) (bool, error) {
	if _, ok := env.Get(QuietKey); !ok {
		return false, nil
	}
	from := envQuiet(env.Map())
	if len(from) > 0 {
		if err := changeQuiet(root, func(apps []string) []string { return union(apps, from) }); err != nil {
			return false, err
		}
	}
	env.Delete(QuietKey)
	return true, nil
}

func changeQuiet(root string, change func([]string) []string) error {
	return lockedfile.Update(QuietPath(root), 0o600, func(old []byte) ([]byte, bool) {
		apps := change(readQuiet(old))
		if apps == nil {
			apps = []string{}
		}
		data, err := json.MarshalIndent(quietRecord{Apps: apps}, "", "  ")
		return append(data, '\n'), err == nil
	})
}
