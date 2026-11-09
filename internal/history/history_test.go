package history

import (
	"database/sql"
	"os"
	"runtime"
	"strings"
	"testing"
	"time"
)

func TestAddListAndSearch(t *testing.T) {
	root := t.TempDir()
	d, err := Open(root)
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	now := time.Now()
	for i, e := range []Entry{
		{Kind: "restart", App: "immich", Who: Watchdog, Text: "Restarted Immich: it stopped answering"},
		{Kind: "update", App: "vaultwarden", Who: Nightly, Text: "Updated Vaultwarden"},
		{Kind: "stop", App: "immich", Who: "Sam's iPhone", Text: "Stopped Immich"},
		{Kind: "settings", Who: ThisComputer, Text: "Changed settings: QUIET_HOURS"},
		{Kind: "finances", Who: "Sam's iPhone", Text: "Changed\nFinances' transactions"},
	} {
		e.At = now.Add(time.Duration(i) * time.Second)
		if err := d.Add(e); err != nil {
			t.Fatal(err)
		}
	}
	all, err := d.List(Filter{})
	if err != nil || len(all) != 5 || all[0].Text != "Changed Finances' transactions" || all[4].App != "immich" {
		t.Fatalf("all, newest first, on one line: %+v %v", all, err)
	}
	if got, _ := d.List(Filter{App: "immich"}); len(got) != 2 || got[0].Kind != "stop" {
		t.Fatalf("Immich's: %+v", got)
	}
	if got, _ := d.List(Filter{Search: "IPHONE"}); len(got) != 2 {
		t.Fatalf("by who, any case: %+v", got)
	}
	if got, _ := d.List(Filter{Search: "vault"}); len(got) != 1 || got[0].Who != Nightly {
		t.Fatalf("by the line: %+v", got)
	}
	// % and _ are only themselves.
	if got, _ := d.List(Filter{Search: "%"}); len(got) != 0 {
		t.Fatalf("%% matched: %+v", got)
	}
	if got, _ := d.List(Filter{Search: "QUIET_HOURS"}); len(got) != 1 {
		t.Fatalf("an underscore: %+v", got)
	}
	// The next page.
	page, _ := d.List(Filter{Limit: 2})
	next, _ := d.List(Filter{Limit: 2, Before: page[1].ID})
	if len(page) != 2 || len(next) != 2 || next[0].ID >= page[1].ID {
		t.Fatalf("pages: %+v then %+v", page, next)
	}
	if err := d.Add(Entry{Kind: "start", Text: " \n "}); err == nil {
		t.Fatal("an entry with no line was kept")
	}
}

func TestLimits(t *testing.T) {
	root := t.TempDir()
	d, err := Open(root)
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	old := time.Now().Add(-Keep - time.Hour)
	if err := d.Add(Entry{Kind: "start", Text: "Started Immich", At: old}); err != nil {
		t.Fatal(err)
	}
	if err := d.Add(Entry{Kind: "stop", Text: "Stopped Immich"}); err != nil {
		t.Fatal(err)
	}
	var n int
	if err := d.db.QueryRow(`SELECT count(*) FROM actions`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("older than 90 days kept: %d %v", n, err)
	}
	// At most MaxEntries, the newest.
	tx, _ := d.db.Begin()
	for i := 0; i < MaxEntries+5; i++ {
		if _, err := tx.Exec(`INSERT INTO actions (at, kind, text) VALUES (?, 'start', 'x')`, time.Now().UnixMilli()); err != nil {
			t.Fatal(err)
		}
	}
	tx.Commit()
	if err := d.Add(Entry{Kind: "start", Text: "the newest"}); err != nil {
		t.Fatal(err)
	}
	if err := d.db.QueryRow(`SELECT count(*) FROM actions`).Scan(&n); err != nil || n != MaxEntries {
		t.Fatalf("%d kept, want %d (%v)", n, MaxEntries, err)
	}
	if got, _ := d.List(Filter{Limit: 1}); got[0].Text != "the newest" {
		t.Fatalf("the newest went: %+v", got)
	}
	long := strings.Repeat("a", 2*maxText)
	if err := d.Add(Entry{Kind: "start", Text: long}); err != nil {
		t.Fatal(err)
	}
	if got, _ := d.List(Filter{Limit: 1}); len([]rune(got[0].Text)) != maxText {
		t.Fatalf("a long line kept whole: %d", len(got[0].Text))
	}
}

func TestPrivateMigratedAndSnapshot(t *testing.T) {
	root := t.TempDir()
	d, err := Open(root)
	if err != nil {
		t.Fatal(err)
	}
	if err := d.Add(Entry{Kind: "start", App: "immich", Text: "Started Immich"}); err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" {
		for _, p := range []string{Path(root), Path(root) + "-wal"} {
			if st, err := os.Stat(p); err == nil && st.Mode().Perm() != 0o600 {
				t.Fatalf("%s is %v", p, st.Mode().Perm())
			}
		}
	}
	snap := t.TempDir() + "/copy/homelab.db"
	if err := d.Snapshot(snap); err != nil {
		t.Fatal(err)
	}
	d.Close()
	// The copy opens on its own, with what was in it.
	c, err := sql.Open("sqlite", "file:"+snap)
	if err != nil {
		t.Fatal(err)
	}
	var text string
	if err := c.QueryRow(`SELECT text FROM actions`).Scan(&text); err != nil || text != "Started Immich" {
		t.Fatalf("the snapshot: %q %v", text, err)
	}
	c.Close()
	// Opened again, nothing is migrated twice; a newer one isn't opened.
	if d, err = Open(root); err != nil {
		t.Fatal(err)
	}
	if _, err := d.db.Exec(`PRAGMA user_version = 99`); err != nil {
		t.Fatal(err)
	}
	d.Close()
	if _, err := Open(root); err == nil || !strings.Contains(err.Error(), "newer Homelab Wizard") {
		t.Fatalf("a newer database opened: %v", err)
	}
	// None yet is an empty list, and makes nothing.
	empty := t.TempDir()
	if got, err := List(empty, Filter{}); err != nil || len(got) != 0 {
		t.Fatalf("no record: %v %v", got, err)
	}
	if _, err := os.Stat(Path(empty)); !os.IsNotExist(err) {
		t.Fatal("listing made a database")
	}
}
