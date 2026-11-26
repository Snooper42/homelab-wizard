package core

import (
	"os"
	"slices"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/diskspace"
	"github.com/Snooper42/homelab-wizard/internal/media"
)

// Tidy is Tidy Up as a phone's page shows it (lane D, D4): read only, and in
// a household's words. What it filed today, what needs a look, each
// library, the drive's room and the inbox, with no folder or file path: a
// title, a file's name and a kind, never where on the computer.
type Tidy struct {
	Running   *TidyRunning  `json:"running,omitempty"` // at work now
	Today     []TidyFiled   `json:"today"`             // newest first
	Needs     []TidyNeed    `json:"needs"`
	Libraries []TidyLibrary `json:"libraries"` // in media.Kinds' order
	Freed     int64         `json:"freed"`     // put in the Trash, all time, in bytes
	Drive     *TidyDrive    `json:"drive,omitempty"`
	Inbox     TidyInbox     `json:"inbox"`
}

// TidyRunning is the job Tidy Up is doing.
type TidyRunning struct {
	Kind   string    `json:"kind"`
	Action string    `json:"action"`
	Start  time.Time `json:"start"`
}

// TidyFiled is one download the inbox filed today.
type TidyFiled struct {
	Kind   string    `json:"kind"`
	Title  string    `json:"title"`
	Did    []string  `json:"did"`
	At     time.Time `json:"at"`
	Undone bool      `json:"undone,omitempty"`
}

// TidyNeed is one download waiting for a person.
type TidyNeed struct {
	Name  string `json:"name"`
	Kind  string `json:"kind,omitempty"`
	Why   string `json:"why"`
	Since string `json:"since,omitempty"`
}

// TidyRun is a job's last run.
type TidyRun struct {
	Action string    `json:"action"`
	OK     bool      `json:"ok"`
	At     time.Time `json:"at"`
}

// TidyLibrary is one library: whether its folder is there, its size as last
// measured, what tidying it freed, and its last run.
type TidyLibrary struct {
	Kind  string   `json:"kind"`
	Found bool     `json:"found"`
	Size  int64    `json:"size,omitempty"`
	Freed int64    `json:"freed"`
	Last  *TidyRun `json:"last,omitempty"`
}

// TidyDrive is the room on the disk holding most of the libraries.
type TidyDrive struct {
	Free  uint64 `json:"free"`
	Total uint64 `json:"total"`
}

// TidyInbox is the inbox: whether it watches, when it tidies (arrive,
// daily, manual), how many folders it watches, and its last sweep.
type TidyInbox struct {
	Watching bool     `json:"watching"`
	When     string   `json:"when"`
	Folders  int      `json:"folders"`
	Last     *TidyRun `json:"last,omitempty"`
}

func tidyOff(v string) bool {
	v = strings.ToLower(strings.TrimSpace(v))
	return v == "false" || v == "0" || v == "no" || v == "off"
}

// newest is the latest of a kind's runs.
func newest(runs map[string]media.Run) *TidyRun {
	var out *TidyRun
	for _, r := range runs {
		if out == nil || r.At.After(out.At) {
			out = &TidyRun{Action: r.Action, OK: r.OK, At: r.At}
		}
	}
	return out
}

// TidyOverview reads Tidy Up for the homelab at root, as of now.
func TidyOverview(root string, now time.Time) Tidy {
	env := Env(root)
	home, _ := os.UserHomeDir()
	rec := media.LoadRecord(root)
	out := Tidy{Today: []TidyFiled{}, Needs: []TidyNeed{}, Libraries: []TidyLibrary{}}
	if l, running := media.ReadLock(root); running {
		out.Running = &TidyRunning{Kind: l.Kind, Action: l.Action, Start: l.Start}
	}
	for _, f := range media.FiledToday(root, now) {
		out.Today = append(out.Today, TidyFiled{Kind: f.Kind, Title: f.Title, Did: f.Did, At: f.At, Undone: f.Undone})
	}
	for _, n := range media.NeedsLook(root) {
		out.Needs = append(out.Needs, TidyNeed{Name: n.Name, Kind: n.Kind, Why: n.Why, Since: n.Since})
	}
	sizes := media.LoadSizes(home)
	var locs []diskspace.Location
	for _, kind := range media.Kinds {
		folder := media.Library(env, home, kind)
		_, err := os.Stat(folder)
		lib := TidyLibrary{Kind: kind, Found: err == nil, Size: sizes[kind].Bytes, Freed: rec.Freed[kind], Last: newest(rec.Last[kind])}
		if lib.Found {
			locs = append(locs, diskspace.Location{Name: kind, Path: folder})
		}
		out.Freed += lib.Freed
		out.Libraries = append(out.Libraries, lib)
	}
	vols := diskspace.Check(locs)
	if i := slices.IndexFunc(vols, func(v diskspace.Volume) bool {
		return !slices.ContainsFunc(vols, func(w diskspace.Volume) bool { return len(w.Names) > len(v.Names) })
	}); i >= 0 {
		out.Drive = &TidyDrive{Free: vols[i].Free, Total: vols[i].Total}
	}
	when := strings.ToLower(strings.TrimSpace(env["TIDY_INBOX_WHEN"]))
	if when != "daily" && when != "manual" {
		when = "arrive"
	}
	out.Inbox = TidyInbox{Watching: !tidyOff(env["TIDY_UP"]) && !tidyOff(env["TIDY_INBOX"]), When: when, Folders: len(media.InboxFolders(env, home))}
	if r, ok := rec.Last["inbox"]["scan"]; ok {
		out.Inbox.Last = &TidyRun{Action: r.Action, OK: r.OK, At: r.At}
	}
	return out
}

// WithoutNames is the overview for a wall screen, which anyone walking past
// can read: how many were filed and need a look, without their titles and
// file names.
func (t Tidy) WithoutNames() Tidy {
	today, needs := make([]TidyFiled, len(t.Today)), make([]TidyNeed, len(t.Needs))
	for i, f := range t.Today {
		f.Title = ""
		today[i] = f
	}
	for i, n := range t.Needs {
		n.Name = ""
		needs[i] = n
	}
	t.Today, t.Needs = today, needs
	return t
}
