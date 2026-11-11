// Package history is the record of what was done (unison-handoff.md section
// 4, item 4; ADR-0022): every start, stop, restart, update, roll back and
// removal, the watchdog's restarts, settings saved and Finances changed,
// with who did it (this computer, a phone by its name, the watchdog, the
// nightly update) and when, kept 90 days and searchable.
//
// It is the homelab's first SQLite table: one file, data/homelab.db (0600,
// in WAL mode, so the app, the agent and a phone's request read while one
// writes), pure Go (modernc.org/sqlite, no cgo). Each entry is a line in
// plain words. It never holds a secret, a setting's value or an amount of
// money: settings are named, Finances says only what kind of thing changed.
package history

import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	_ "modernc.org/sqlite" // the "sqlite" driver
)

// Entry is one thing that was done.
type Entry struct {
	ID int64     `json:"id"`
	At time.Time `json:"at"`
	// Kind: start, stop, restart, update, rollback, remove, heal, settings,
	// finances.
	Kind string `json:"kind"`
	// App is the app's id, "" for what isn't one app's (settings, Finances).
	App string `json:"app,omitempty"`
	// Who did it: "this computer", a phone's name, "the watchdog",
	// "the nightly update".
	Who string `json:"who"`
	// Text is the line as a person reads it: "Restarted Immich".
	Text string `json:"text"`
}

// Kept: what's older goes, and at most MaxEntries stay (the newest).
const (
	Keep       = 90 * 24 * time.Hour
	MaxEntries = 20000
	// maxText is the longest line kept; a longer one is cut.
	maxText = 500
)

// Who's names for what wasn't a person at a screen.
const (
	ThisComputer = "this computer"
	Watchdog     = "the watchdog"
	Nightly      = "the nightly update"
)

// Path is the database's file in the homelab folder root.
func Path(root string) string { return filepath.Join(root, "data", "homelab.db") }

// migrations are the database's changes, in order; the database's
// user_version says how many it has had. Only ever add to the end.
var migrations = []string{
	`CREATE TABLE actions (
		id   INTEGER PRIMARY KEY AUTOINCREMENT,
		at   INTEGER NOT NULL,
		kind TEXT NOT NULL,
		app  TEXT NOT NULL DEFAULT '',
		who  TEXT NOT NULL DEFAULT '',
		text TEXT NOT NULL
	);
	CREATE INDEX actions_at ON actions(at);
	CREATE INDEX actions_app ON actions(app, at);`,
	// The alerts the computer sent (alerts.go).
	`CREATE TABLE alerts (
		id            INTEGER PRIMARY KEY AUTOINCREMENT,
		at            INTEGER NOT NULL,
		topic         TEXT NOT NULL DEFAULT '',
		title         TEXT NOT NULL,
		body          TEXT NOT NULL DEFAULT '',
		priority      INTEGER NOT NULL DEFAULT 0,
		checks        TEXT NOT NULL DEFAULT '',
		cleared_at    INTEGER NOT NULL DEFAULT 0,
		snoozed_until INTEGER NOT NULL DEFAULT 0,
		snoozed_by    TEXT NOT NULL DEFAULT ''
	);
	CREATE INDEX alerts_at ON alerts(at);`,
}

// DB is the open record.
type DB struct{ db *sql.DB }

// Open opens (and makes, the first time) the database in root's data/.
func Open(root string) (*DB, error) {
	path := Path(root)
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, err
	}
	// Made 0600 before SQLite opens it, so it is never readable by others.
	f, err := os.OpenFile(path, os.O_RDWR|os.O_CREATE, 0o600)
	if err != nil {
		return nil, err
	}
	f.Close()
	db, err := sql.Open("sqlite", "file:"+filepath.ToSlash(path)+"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)")
	if err != nil {
		return nil, err
	}
	d := &DB{db: db}
	if err := d.migrate(); err != nil {
		db.Close()
		return nil, fmt.Errorf("the record of what was done (%s): %w", path, err)
	}
	keepPrivate(path)
	return d, nil
}

// keepPrivate makes the database's files this account's alone: the WAL
// and shared-memory files SQLite makes beside it too.
func keepPrivate(path string) {
	for _, p := range []string{path, path + "-wal", path + "-shm"} {
		if _, err := os.Stat(p); err == nil {
			_ = os.Chmod(p, 0o600)
		}
	}
}

func (d *DB) migrate() error {
	var have int
	if err := d.db.QueryRow(`PRAGMA user_version`).Scan(&have); err != nil {
		return err
	}
	if have > len(migrations) {
		return fmt.Errorf("it was made by a newer Homelab Wizard (version %d, this one knows %d)", have, len(migrations))
	}
	for v := have; v < len(migrations); v++ {
		tx, err := d.db.Begin()
		if err != nil {
			return err
		}
		if _, err := tx.Exec(migrations[v]); err != nil {
			tx.Rollback()
			return err
		}
		if _, err := tx.Exec(fmt.Sprintf(`PRAGMA user_version = %d`, v+1)); err != nil {
			tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}

// Close closes it.
func (d *DB) Close() error { return d.db.Close() }

// Add keeps e (its ID and, when unset, At are filled in), then lets go of
// what's past the limits.
func (d *DB) Add(e Entry) error {
	if e.At.IsZero() {
		e.At = time.Now()
	}
	e.Text = clean(e.Text, maxText)
	e.Who = clean(e.Who, 80)
	if e.Text == "" {
		return errors.New("an entry needs its line")
	}
	if _, err := d.db.Exec(`INSERT INTO actions (at, kind, app, who, text) VALUES (?, ?, ?, ?, ?)`,
		e.At.UnixMilli(), e.Kind, e.App, e.Who, e.Text); err != nil {
		return err
	}
	return d.trim(time.Now())
}

// trim lets go of entries older than Keep, and all but the newest MaxEntries.
func (d *DB) trim(now time.Time) error {
	if _, err := d.db.Exec(`DELETE FROM actions WHERE at < ?`, now.Add(-Keep).UnixMilli()); err != nil {
		return err
	}
	_, err := d.db.Exec(`DELETE FROM actions WHERE id <= (SELECT id FROM actions ORDER BY id DESC LIMIT 1 OFFSET ?)`, MaxEntries)
	return err
}

// clean is s on one line, without control characters, at most max runes.
func clean(s string, max int) string {
	s = strings.Map(func(r rune) rune {
		switch {
		case r == '\n' || r == '\r' || r == '\t':
			return ' '
		case r < 0x20 || r == 0x7f:
			return -1
		}
		return r
	}, s)
	s = strings.TrimSpace(s)
	if r := []rune(s); len(r) > max {
		s = string(r[:max-1]) + "…"
	}
	return s
}

// Filter narrows what List gives.
type Filter struct {
	// App: only this app's.
	App string
	// Search: entries whose line, app or who has it (any case).
	Search string
	// Before: only entries older than this ID (for the next page); 0 for
	// the newest.
	Before int64
	// Limit: at most this many (default 100, at most 500).
	Limit int
}

// List gives what was done, newest first.
func (d *DB) List(f Filter) ([]Entry, error) {
	limit := f.Limit
	if limit <= 0 {
		limit = 100
	}
	limit = min(limit, 500)
	q := `SELECT id, at, kind, app, who, text FROM actions WHERE at >= ?`
	args := []any{time.Now().Add(-Keep).UnixMilli()}
	if f.App != "" {
		q += ` AND app = ?`
		args = append(args, f.App)
	}
	if s := strings.TrimSpace(f.Search); s != "" {
		like := "%" + strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(strings.ToLower(s)) + "%"
		q += ` AND (lower(text) LIKE ? ESCAPE '\' OR lower(app) LIKE ? ESCAPE '\' OR lower(who) LIKE ? ESCAPE '\')`
		args = append(args, like, like, like)
	}
	if f.Before > 0 {
		q += ` AND id < ?`
		args = append(args, f.Before)
	}
	q += ` ORDER BY id DESC LIMIT ?`
	args = append(args, limit)
	rows, err := d.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Entry{}
	for rows.Next() {
		var e Entry
		var at int64
		if err := rows.Scan(&e.ID, &at, &e.Kind, &e.App, &e.Who, &e.Text); err != nil {
			return nil, err
		}
		e.At = time.UnixMilli(at)
		out = append(out, e)
	}
	return out, rows.Err()
}

// Snapshot writes a consistent copy of the database to dst (0600), for the
// nightly backup: through SQLite (VACUUM INTO), never as a file copied
// while it's being written.
func (d *DB) Snapshot(dst string) error {
	if err := os.MkdirAll(filepath.Dir(dst), 0o700); err != nil {
		return err
	}
	if err := os.Remove(dst); err != nil && !os.IsNotExist(err) {
		return err
	}
	if _, err := d.db.Exec(`VACUUM INTO ?`, dst); err != nil {
		return err
	}
	return os.Chmod(dst, 0o600)
}

// SettingsChanged is the line for settings saved: their names, never their
// values.
func SettingsChanged(values map[string]string) string {
	keys := make([]string, 0, len(values))
	for k := range values {
		keys = append(keys, k)
	}
	slices.Sort(keys)
	if len(keys) > 8 {
		keys = append(keys[:8], "…")
	}
	return "Changed settings: " + strings.Join(keys, ", ")
}

// Record keeps e in root's record, best effort: what was done is never
// undone, nor reported as failed, because its line couldn't be kept.
func Record(root string, e Entry) {
	d, err := Open(root)
	if err != nil {
		return
	}
	defer d.Close()
	_ = d.Add(e)
}

// List is the record in root, as DB.List; none yet is an empty list.
func List(root string, f Filter) ([]Entry, error) {
	if _, err := os.Stat(Path(root)); os.IsNotExist(err) {
		return []Entry{}, nil
	}
	d, err := Open(root)
	if err != nil {
		return nil, err
	}
	defer d.Close()
	return d.List(f)
}
