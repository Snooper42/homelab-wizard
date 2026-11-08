// Package media is Tidy Up: the homelab's side of the media engines in
// tools/media (the owner's music and books organizers, vendored unchanged,
// and the movies, TV, audiobooks, inbox, and scrubber engines beside them).
// It writes their settings from .env, finds Python, holds the one media
// lock while files move, reads their JSON events, and keeps what each run
// found in data/media.json, so Status and Tidy Up read it without Python.
package media

import (
	"fmt"
	"path/filepath"
	"slices"
	"strings"
)

// Kinds are the libraries Tidy Up looks after, in the order it shows them.
var Kinds = []string{"music", "books", "movies", "tv", "audiobooks"}

// Action is one thing an engine does.
type Action struct {
	Script string // in tools/media
	// Lock: it moves, writes, or deletes files, so it holds the media lock.
	Lock bool
	// Power: heavy work (hours of tagging, merging, transcoding) that waits
	// for AC power, and stops when the machine goes on battery.
	Power bool
	// Confirm: it asks a question, answered by --yes once the person agreed.
	Confirm bool
}

// actions is every engine action homelab media runs, by kind.
var actions = map[string]map[string]Action{
	"music": {
		"init":              {Script: "music_organizer.py"},
		"status":            {Script: "music_organizer.py"},
		"scan":              {Script: "music_organizer.py"},
		"run":               {Script: "music_organizer.py", Lock: true, Power: true},
		"finalize":          {Script: "music_organizer.py", Lock: true, Confirm: true},
		"verify":            {Script: "music_organizer.py"},
		"genres":            {Script: "music_organizer.py", Lock: true},
		"undo":              {Script: "music_organizer.py", Lock: true, Confirm: true},
		"delete-backup":     {Script: "music_organizer.py", Lock: true, Confirm: true},
		"free-space":        {Script: "music_tidy.py", Lock: true},
		"navidrome-cleanup": {Script: "music_tidy.py"},
		"playlists":         {Script: "music_tidy.py", Lock: true},
		"lyrics":            {Script: "music_tidy.py", Lock: true, Power: true},
		"genre-counts":      {Script: "music_tidy.py"},
		"file":              {Script: "music_tidy.py", Lock: true},
	},
	"books": {
		"init":   {Script: "books_organizer.py"},
		"status": {Script: "books_organizer.py"},
		"review": {Script: "books_organizer.py"},
		"apply":  {Script: "books_organizer.py", Lock: true, Confirm: true},
		// A Calibre library from a folder of books with none: asks first.
		"build": {Script: "books_tidy.py", Lock: true, Confirm: true},
		"undo":  {Script: "books_organizer.py", Lock: true, Confirm: true},
		// Reads Calibre's database, writes nothing: no lock.
		"genre-counts": {Script: "books_tidy.py"},
	},
	"movies": {
		"status":       {Script: "movies_organizer.py"},
		"scan":         {Script: "movies_organizer.py"},
		"run":          {Script: "movies_organizer.py", Power: true},
		"collect":      {Script: "movies_organizer.py", Lock: true},
		"file":         {Script: "movies_organizer.py", Lock: true},
		"genre-counts": {Script: "movies_organizer.py"},
		"dedupe":       {Script: "movies_organizer.py", Lock: true, Confirm: true},
		"posters":      {Script: "movies_organizer.py"},
	},
	"tv": {
		"status":       {Script: "tv_organizer.py"},
		"scan":         {Script: "tv_organizer.py"},
		"run":          {Script: "tv_organizer.py", Power: true},
		"collect":      {Script: "tv_organizer.py", Lock: true},
		"file":         {Script: "tv_organizer.py", Lock: true},
		"genre-counts": {Script: "tv_organizer.py"},
		"dedupe":       {Script: "tv_organizer.py", Lock: true, Confirm: true},
		"posters":      {Script: "tv_organizer.py"},
	},
	"audiobooks": {
		"status": {Script: "audiobook_organizer.py"},
		"scan":   {Script: "audiobook_organizer.py"},
		"run":    {Script: "audiobook_organizer.py", Lock: true, Power: true},
		"file":   {Script: "audiobook_organizer.py", Lock: true},
	},
	// Not a library: the Downloads watcher and the nightly scrubber.
	"inbox":    {"scan": {Script: "inbox.py", Lock: true}},
	"scrubber": {"scan": {Script: "scrubber.py", Lock: true}},
	"tdarr":    {"setup": {Script: "tdarr_setup.py"}},
	// Undo: what a run put in the Trash goes back where it was.
	"trash": {"restore": {Script: "trash_restore.py", Lock: true, Confirm: true}},
}

// Lookup is the action kind/name, or an error that lists the ones there are.
func Lookup(kind, name string) (Action, error) {
	acts, ok := actions[kind]
	if !ok {
		return Action{}, fmt.Errorf("no %q in Tidy Up: music, books, movies, tv, or audiobooks", kind)
	}
	a, ok := acts[name]
	if !ok {
		return Action{}, fmt.Errorf("%s has no %q: %s", kind, name, strings.Join(Actions(kind), ", "))
	}
	return a, nil
}

// Actions are a kind's action names, sorted.
func Actions(kind string) []string {
	var out []string
	for n := range actions[kind] {
		out = append(out, n)
	}
	slices.Sort(out)
	return out
}

// Apps are the catalog apps that read or write a media library: while the
// media lock is held, the nightly update leaves them for the next night,
// updating one alone is refused, and up at login leaves them stopped, so
// nothing restarts Navidrome in the middle of a swap.
var Apps = []string{"navidrome", "beets", "calibre-web", "komga", "kavita", "audiobookshelf", "jellyfin-container",
	"lidarr", "sonarr", "radarr", "bazarr", "lazylibrarian", "tdarr"}

// IsApp reports whether id reads or writes a media library.
func IsApp(id string) bool { return slices.Contains(Apps, id) }

// ToolsDir is where the engines are, in the homelab folder.
func ToolsDir(root string) string { return filepath.Join(root, "tools", "media") }

// SettingsPath is the engines' settings file, written before each run.
func SettingsPath(root string) string { return filepath.Join(root, "data", "homelab_media.json") }

// LogDir holds each job's events, one JSON object a line, beside the jobs' logs.
func LogDir(root string) string { return filepath.Join(root, "scripts", "logs", "media") }

// ReportsDir is where the engines write reports, logs, and what they set
// aside, rather than ~/Downloads, which the inbox watches.
func ReportsDir(root string) string { return filepath.Join(root, "reports", "media") }
