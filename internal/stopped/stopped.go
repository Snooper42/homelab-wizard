// Package stopped keeps the apps a person stopped on purpose (from the
// group menu, an app's page, or homelab stop), and until when, if they
// said. Nothing that starts apps by itself starts one of them: Start the N
// stopped, the watchdog, the battery saver, and the wait for a drive all
// skip it. One stopped until a time is started again by the awake job once
// that time comes. The record is data/stopped.json, beside battery.json, so
// it survives a restart and is backed up with the rest of data/.
package stopped

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"
)

// Stop is one app stopped on purpose: when, and until when (zero: until
// someone starts it).
type Stop struct {
	Since time.Time `json:"since"`
	Until time.Time `json:"until,omitzero"`
}

// Record is every app stopped on purpose, by app ID.
type Record map[string]Stop

// Path is where the record is kept.
func Path(root string) string { return filepath.Join(root, "data", "stopped.json") }

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

// Save writes the record, or removes it when it holds nothing. It writes a
// new file beside it and renames it in, so a process reading the record at
// that moment (the watchdog, the battery saver) reads the old one or the new
// one whole, never half a file that reads as "nothing stopped". To change
// the record, use Update, which also keeps two writers from losing each
// other's change.
func (r Record) Save(path string) error {
	if len(r) == 0 {
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return err
		}
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(r, "", "  ")
	f, err := os.CreateTemp(filepath.Dir(path), filepath.Base(path)+".tmp*")
	if err != nil {
		return err
	}
	tmp := f.Name()
	_, werr := f.Write(append(data, '\n'))
	if cerr := f.Close(); werr == nil {
		werr = cerr
	}
	if werr == nil {
		werr = os.Chmod(tmp, 0o600)
	}
	// On Windows a rename over a file another process is reading fails
	// for that moment: try again briefly.
	if werr == nil {
		for range 20 {
			if werr = os.Rename(tmp, path); werr == nil {
				break
			}
			time.Sleep(10 * time.Millisecond)
		}
	}
	if werr != nil {
		_ = os.Remove(tmp)
	}
	return werr
}

// lockWait is how long Update waits for another writer; a lock older than
// lockStale was left by a writer that died, and is taken over. A writer
// holds it only to read, change, and write a few lines.
var (
	lockWait  = 5 * time.Second
	lockStale = 30 * time.Second
)

// Update reads the record, lets change change it, and saves it when change
// says it did, holding a lock beside the record the whole time, so a change
// made at the same moment by another homelab process (the awake job, a
// phone's Stop for a while, homelab stop) is never saved over.
func Update(path string, change func(Record) bool) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	lock := path + ".lock"
	deadline := time.Now().Add(lockWait)
	for {
		f, err := os.OpenFile(lock, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
		if err == nil {
			_ = f.Close()
			break
		}
		// Windows says "access is denied" for a lock another writer is
		// removing at that moment: it is busy, as one that is there.
		if !os.IsExist(err) && !os.IsPermission(err) {
			return err
		}
		if fi, serr := os.Stat(lock); serr == nil && time.Since(fi.ModTime()) > lockStale {
			_ = os.Remove(lock)
			continue
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("another homelab is changing %s: try again", filepath.Base(path))
		}
		time.Sleep(10 * time.Millisecond)
	}
	defer os.Remove(lock)
	r := Load(path)
	if !change(r) {
		return nil
	}
	return r.Save(path)
}

// Has says whether id was stopped on purpose.
func (r Record) Has(id string) bool {
	_, ok := r[id]
	return ok
}

// IDs are the apps in the record, sorted.
func (r Record) IDs() []string {
	ids := make([]string, 0, len(r))
	for id := range r {
		ids = append(ids, id)
	}
	slices.Sort(ids)
	return ids
}

// Due are the apps whose time to start again has come by now, sorted.
func (r Record) Due(now time.Time) []string {
	var ids []string
	for id, s := range r {
		if !s.Until.IsZero() && !now.Before(s.Until) {
			ids = append(ids, id)
		}
	}
	slices.Sort(ids)
	return ids
}

// ParseUntil reads when a stop ends, as homelab stop --until takes it: a
// time (2026-11-02T21:00:00-05:00, as the app sends), a while from now
// ("1h", "90m"), or a clock time ("21:00", "8:00"), the next one to come
// on this machine's clock. "" is no end.
func ParseUntil(s string, now time.Time) (time.Time, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}, nil
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		if !t.After(now) {
			return time.Time{}, fmt.Errorf("--until %s has passed", s)
		}
		return t, nil
	}
	if d, err := time.ParseDuration(s); err == nil {
		if d <= 0 {
			return time.Time{}, fmt.Errorf("--until %s is not ahead", s)
		}
		return now.Add(d).Truncate(time.Second), nil
	}
	if c, err := time.ParseInLocation("15:04", s, now.Location()); err == nil {
		t := time.Date(now.Year(), now.Month(), now.Day(), c.Hour(), c.Minute(), 0, 0, now.Location())
		if !t.After(now) {
			t = t.AddDate(0, 0, 1)
		}
		return t, nil
	}
	return time.Time{}, fmt.Errorf("--until takes a time (21:00), a while (1h), or a date and time (2026-11-02T21:00:00Z), not %q", s)
}
