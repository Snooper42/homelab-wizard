package backup

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"time"
)

// UpdateCopy is what the homelab keeps of an app's own data just before it
// updates the app (ADR-0020), in recovery-staging/before-update/<app>/<time>/:
// an archive of each folder and named volume it writes to, and its
// databases' dumps. A rollback puts it back.
type UpdateCopy struct {
	App  string    `json:"app"`
	When time.Time `json:"when"`
	// ImageID is the image the app ran when the copy was made.
	ImageID string         `json:"imageID"`
	Mounts  []CopiedMount  `json:"mounts,omitempty"`
	Skipped []SkippedMount `json:"skipped,omitempty"`
	Dumps   []CopiedDump   `json:"dumps,omitempty"`
	// Dir is the copy's folder (not saved).
	Dir string `json:"-"`
}

// CopiedMount is one folder or volume in a copy.
type CopiedMount struct {
	Kind    string `json:"kind"`   // folder or volume
	Source  string `json:"source"` // the folder on this machine, or the volume's name
	Target  string `json:"target"` // where the app sees it
	Archive string `json:"archive"`
	Bytes   int64  `json:"bytes"`
}

// SkippedMount is a folder or volume left out of a copy, and why.
type SkippedMount struct {
	Kind   string `json:"kind"`
	Source string `json:"source"`
	Bytes  int64  `json:"bytes,omitempty"`
	Why    string `json:"why"`
}

// CopiedDump is a database's dump kept with a copy.
type CopiedDump struct {
	App  string `json:"app"` // the database
	File string `json:"file"`
}

// CopiesFolder and RolledBackFolder are in recovery-staging: the copies
// made before updates, and the data a rollback set aside (never deleted
// by the rollback).
const (
	CopiesFolder     = "before-update"
	RolledBackFolder = "rolled-back"
	copyFile         = "copy.json"
)

// CopyStamp names a copy's folder by its time.
const CopyStamp = "20060102-150405"

// NewCopy is an empty copy of app's data, in its own folder under staging.
func NewCopy(staging, app, imageID string, now time.Time) UpdateCopy {
	return UpdateCopy{App: app, When: now, ImageID: imageID, Dir: filepath.Join(staging, CopiesFolder, app, now.Format(CopyStamp))}
}

// Save writes the copy's record into its folder.
func (c UpdateCopy) Save() error {
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(c.Dir, copyFile), append(data, '\n'), 0o600)
}

// Copies are an app's complete copies (those with a record), newest first.
func Copies(staging, app string) []UpdateCopy {
	dirs, _ := filepath.Glob(filepath.Join(staging, CopiesFolder, app, "*", copyFile))
	var out []UpdateCopy
	for _, p := range dirs {
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		var c UpdateCopy
		if json.Unmarshal(data, &c) != nil {
			continue
		}
		c.Dir = filepath.Dir(p)
		out = append(out, c)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].When.After(out[j].When) })
	return out
}

// LatestCopy is an app's newest complete copy.
func LatestCopy(staging, app string) (UpdateCopy, bool) {
	if cs := Copies(staging, app); len(cs) > 0 {
		return cs[0], true
	}
	return UpdateCopy{}, false
}

// PruneCopies keeps an app's newest copy and removes the others, and any
// folder a copy left unfinished. It returns what it removed.
func PruneCopies(staging, app string) []string {
	keep := ""
	if c, ok := LatestCopy(staging, app); ok {
		keep = c.Dir
	}
	dirs, _ := filepath.Glob(filepath.Join(staging, CopiesFolder, app, "*"))
	var removed []string
	for _, d := range dirs {
		if d != keep && os.RemoveAll(d) == nil {
			removed = append(removed, d)
		}
	}
	return removed
}

// ExpireCopies removes the copies older than maxAge, the rollback window:
// after it there is no earlier image to go back to either.
func ExpireCopies(staging string, now time.Time, maxAge time.Duration) []string {
	apps, _ := os.ReadDir(filepath.Join(staging, CopiesFolder))
	var removed []string
	for _, a := range apps {
		for _, c := range Copies(staging, a.Name()) {
			if now.Sub(c.When) > maxAge && os.RemoveAll(c.Dir) == nil {
				removed = append(removed, c.Dir)
			}
		}
	}
	return removed
}
