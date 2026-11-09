package media

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

// Filed is one download the inbox filed, as What I did today shows it: what
// it is, where it went, what was done, and whether Undo has put it back
// (inbox.py's note_filed, in data/media-filed.jsonl).
type Filed struct {
	ID     string    `json:"id"`
	Kind   string    `json:"kind"`
	Title  string    `json:"title"`
	Where  string    `json:"where"`
	Did    []string  `json:"did"`
	From   string    `json:"from"`
	Undo   bool      `json:"undo"`
	At     time.Time `json:"at"`
	Undone bool      `json:"undone,omitempty"`
}

// FiledLogPath is the inbox's record of what it filed, passed to every job
// as HOMELAB_MEDIA_FILED_LOG.
func FiledLogPath(root string) string { return filepath.Join(root, "data", "media-filed.jsonl") }

// FiledToday is what the inbox filed today (local time), newest first, each
// marked once Undo put it back. The engines write local times without a
// zone, read here in this machine's.
func FiledToday(root string, now time.Time) []Filed {
	f, err := os.Open(FiledLogPath(root))
	if err != nil {
		return []Filed{}
	}
	defer f.Close()
	y, m, d := now.Date()
	var day []Filed
	undone := map[string]bool{}
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 64<<10), 4<<20)
	for sc.Scan() {
		var raw struct {
			Filed
			At     string `json:"at"`
			Undone string `json:"undone"`
		}
		if json.Unmarshal(sc.Bytes(), &raw) != nil {
			continue
		}
		if raw.Undone != "" {
			undone[raw.Undone] = true
			continue
		}
		at, err := time.ParseInLocation("2006-01-02T15:04:05", raw.At, now.Location())
		if err != nil || raw.ID == "" {
			continue
		}
		if ay, am, ad := at.Date(); ay != y || am != m || ad != d {
			continue
		}
		e := raw.Filed
		e.At = at
		day = append(day, e)
	}
	out := make([]Filed, 0, len(day))
	for i := len(day) - 1; i >= 0; i-- {
		day[i].Undone = undone[day[i].ID]
		out = append(out, day[i])
	}
	return out
}

// Need is one download waiting in Needs a look: one no engine could place,
// or one Undo put back (inbox.py's needs_list, in data/media-needs.json).
type Need struct {
	Path string `json:"path"`
	Name string `json:"name"`
	// Kind is what it looked like: movies, tv, music, audiobooks, or "".
	Kind  string `json:"kind"`
	Why   string `json:"why"`
	Since string `json:"since,omitempty"`
}

// NeedsPath is Needs a look's list, passed to every job as
// HOMELAB_MEDIA_NEEDS; the inbox rewrites it each time it saves.
func NeedsPath(root string) string { return filepath.Join(root, "data", "media-needs.json") }

// NeedsLook is what's waiting for a person, without what has gone since
// (moved or deleted by hand).
func NeedsLook(root string) []Need {
	out := []Need{}
	b, err := os.ReadFile(NeedsPath(root))
	if err != nil {
		return out
	}
	var all []Need
	if json.Unmarshal(b, &all) != nil {
		return out
	}
	for _, n := range all {
		if n.Path == "" {
			continue
		}
		if _, err := os.Stat(n.Path); err == nil {
			out = append(out, n)
		}
	}
	return out
}
