package media

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// The trash log keeps what Undo can still reach (a run Recent activity or
// an action's last run names) and the last 30 days; older lines of runs no
// screen offers Undo for go.
func TestTrimTrashLog(t *testing.T) {
	root := t.TempDir()
	now := time.Date(2026, 11, 5, 12, 0, 0, 0, time.Local)
	old := now.AddDate(0, 0, -45).Format("2006-01-02T15:04:05")
	recent := now.AddDate(0, 0, -3).Format("2006-01-02T15:04:05")
	lines := []string{
		`{"run": "books-tidy-1", "from": "/a", "to": "/t/a", "at": "` + old + `"}`,   // old, offered by Recent activity: kept
		`{"run": "music-dedupe-2", "from": "/b", "to": "/t/b", "at": "` + old + `"}`, // old, an action's last run: kept
		`{"run": "movies-clean-3", "from": "/c", "to": "/t/c", "at": "` + old + `"}`, // old, offered nowhere: goes
		`{"run": "tv-clean-4", "from": "/d", "to": "/t/d", "at": "` + recent + `"}`,  // recent: kept
		`not a line the engines write`, // goes
	}
	path := TrashLogPath(root)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	rec := Record{
		Activity: []Activity{{Kind: "books", Undo: "books-tidy-1"}},
		Last:     map[string]map[string]Run{"music": {"dedupe": {ID: "music-dedupe-2"}}},
	}
	if err := TrimTrashLog(root, rec, now); err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(path)
	got := string(data)
	for _, keep := range []string{"books-tidy-1", "music-dedupe-2", "tv-clean-4"} {
		if !strings.Contains(got, keep) {
			t.Errorf("%s went:\n%s", keep, got)
		}
	}
	for _, gone := range []string{"movies-clean-3", "not a line"} {
		if strings.Contains(got, gone) {
			t.Errorf("%s stayed:\n%s", gone, got)
		}
	}
	if all, back := Thrown(root, "books-tidy-1"); all != 1 || back != 1 {
		t.Errorf("Undo's count after the trim: %d %d", all, back)
	}
	// No log: nothing to do.
	if err := TrimTrashLog(t.TempDir(), rec, now); err != nil {
		t.Errorf("no log: %v", err)
	}
}

// Each command writes a log of its own in scripts/logs/media (status and
// previews too, which the screen asks for often): those older than 30 days
// go when a new one is made.
func TestOldRunLogsGo(t *testing.T) {
	root := t.TempDir()
	dir := LogDir(root)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	old := filepath.Join(dir, "music-status-20260901-100000.jsonl")
	keep := filepath.Join(dir, "music-status-20261101-100000.jsonl")
	other := filepath.Join(dir, "background.log")
	for _, p := range []string{old, keep, other} {
		if err := os.WriteFile(p, []byte("{}\n"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	long := time.Now().AddDate(0, 0, -40)
	_ = os.Chtimes(old, long, long)
	_ = os.Chtimes(other, long, long)
	f, err := LogFile(root, "books", "status")
	if err != nil {
		t.Fatal(err)
	}
	f.Close()
	if _, err := os.Stat(old); !os.IsNotExist(err) {
		t.Errorf("a run's log 40 days old stayed: %v", err)
	}
	for _, p := range []string{keep, other, f.Name()} {
		if _, err := os.Stat(p); err != nil {
			t.Errorf("%s went: %v", filepath.Base(p), err)
		}
	}
}
