package duplicati

import (
	"path/filepath"
	"strings"
	"time"
)

// Gap is a folder of the household's that no backup job copies
// (quality-loop D1, Backups' Not in any backup).
type Gap struct {
	// What it holds, in the household's words ("The synced Files").
	Name string `json:"name"`
	// Path is the folder on this machine.
	Path string `json:"path"`
	// Job is the homelab job Add makes for it; "" when Add can't (the media
	// library, too big for a nightly copy).
	Job string `json:"job,omitempty"`
	// Why it's left out, in a few words.
	Why string `json:"why"`
}

// gapNames say what each job's folder holds.
var gapNames = map[string]string{
	"Homelab Photos":   "Photos (Immich)",
	"Homelab Jellyfin": "Jellyfin's library and watch history",
	"Homelab Calibre":  "Books (Calibre)",
	"Homelab Files":    "The synced Files (Syncthing)",
}

// Gaps lists what no job copies: each homelab job's folder that has files
// but no job yet (Add makes it), then the media library and the downloads,
// which no job copies on purpose. A job's folder still empty is no gap.
// env's SYNC_ROOT is resolved against the homelab folder by the caller.
func Gaps(env map[string]string, home string, existing []Job) []Gap {
	var out []Gap
	for _, p := range Plan(env, home, existing, time.Time{}) {
		if p.Action != "create" || p.Job.Host == nil {
			continue
		}
		name := gapNames[p.Job.Name]
		if name == "" {
			name = strings.TrimPrefix(p.Job.Name, "Homelab ")
		}
		out = append(out, Gap{Name: name, Path: p.Job.Host(env, home), Job: p.Job.Name, Why: "No backup job yet"})
	}
	for _, f := range []struct{ key, name string }{
		{"MEDIA_ROOT", "Films, shows and music"},
		{"DOWNLOADS_ROOT", "Downloads"},
	} {
		dir := expandHome(env[f.key], home)
		if dir == "" || isEmpty(dir) {
			continue
		}
		why := "Too big for a nightly copy: keep a copy of your own"
		if f.key == "DOWNLOADS_ROOT" {
			why = "Not copied: Library files what finishes into the libraries"
		}
		out = append(out, Gap{Name: f.name, Path: filepath.Clean(dir), Why: why})
	}
	return out
}
