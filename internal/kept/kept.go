// Package kept remembers which passwords and keys a person said they saved
// in their password manager (Sign-in details' Saved tick; the owner, Nov 19,
// 2026: every one goes into Proton Pass). A tick is kept by the setting's
// name (or app:<id> for a key the app keeps itself), never its value, in
// data/kept.json. A new value clears it: the old one in the password
// manager no longer opens anything.
package kept

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/lockedfile"
)

func path(root string) string { return filepath.Join(root, "data", "kept.json") }

type file struct {
	Saved map[string]time.Time `json:"saved"`
}

// name is a .env setting's name, or app:<id> for an app's own key.
var name = regexp.MustCompile(`^([A-Z][A-Z0-9_]*|app:[a-z0-9][a-z0-9-]*)$`)

func read(root string) file {
	f := file{Saved: map[string]time.Time{}}
	if data, err := os.ReadFile(path(root)); err == nil {
		_ = json.Unmarshal(data, &f)
	}
	if f.Saved == nil {
		f.Saved = map[string]time.Time{}
	}
	return f
}

func write(root string, f file) error {
	if err := os.MkdirAll(filepath.Dir(path(root)), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(f, "", "  ")
	if err != nil {
		return err
	}
	return lockedfile.Write(path(root), append(data, '\n'), 0o644)
}

// Load is what is ticked, by name.
func Load(root string) map[string]bool {
	out := map[string]bool{}
	for k := range read(root).Saved {
		out[k] = true
	}
	return out
}

// Mark ticks (or unticks) one name.
func Mark(root, key string, saved bool) error {
	if !name.MatchString(key) {
		return fmt.Errorf("%q is not a setting's name", key)
	}
	f := read(root)
	if saved {
		f.Saved[key] = time.Now().UTC()
	} else {
		delete(f.Saved, key)
	}
	return write(root, f)
}

// Forget unticks the names whose value just changed.
func Forget(root string, keys []string) error {
	f := read(root)
	changed := false
	for _, k := range keys {
		if _, ok := f.Saved[k]; ok {
			delete(f.Saved, k)
			changed = true
		}
	}
	if !changed {
		return nil
	}
	return write(root, f)
}

// Secret is one password or key a person should keep in their password
// manager: set, for an installed app.
type Secret struct {
	App      string `json:"app"`
	Key      string `json:"key"`
	Label    string `json:"label"`
	Recovery bool   `json:"recovery,omitempty"` // opens the backups: Keep safe
}

// Unsaved are the secrets not ticked, the ones that open the backups
// first (losing those loses the backups), then in their own order.
func Unsaved(secrets []Secret, saved map[string]bool) []Secret {
	var out []Secret
	for _, s := range secrets {
		if !saved[s.Key] {
			out = append(out, s)
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Recovery && !out[j].Recovery })
	return out
}

// ByApp counts the unsaved secrets of each app, for the dot on its gear.
func ByApp(unsaved []Secret) map[string]int {
	out := map[string]int{}
	for _, s := range unsaved {
		out[s.App]++
	}
	return out
}
