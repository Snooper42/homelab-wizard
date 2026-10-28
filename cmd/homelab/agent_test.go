package main

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/ui"
)

func TestBackupDue(t *testing.T) {
	at := func(day, hour, min int) time.Time { return time.Date(2026, 10, day, hour, min, 0, 0, time.Local) }
	cases := []struct {
		now, last time.Time
		want      bool
	}{
		{at(17, 3, 31), at(16, 3, 30), true},  // tonight's slot has come
		{at(17, 3, 29), at(16, 3, 30), false}, // not yet
		{at(17, 9, 0), at(16, 3, 30), true},   // asleep at 03:30: as soon as it wakes
		{at(17, 9, 0), at(17, 3, 31), false},  // already ran today
		{at(17, 2, 0), at(15, 3, 30), true},   // missed last night's
	}
	for _, c := range cases {
		if got := backupDue(c.now, c.last); got != c.want {
			t.Errorf("backupDue(%v, %v) = %v", c.now, c.last, got)
		}
	}
}

// A year of the watchdog's runs, every 15 minutes, as the agent logs them:
// the folder stays under 30 MB, neither file passes the limit by more than
// one run, and the report still finds the newest lines and the ones just
// before the split.
func TestJobLogsTrimmedOverAYear(t *testing.T) {
	dir := t.TempDir()
	start := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	const runs = 365 * 24 * 4
	quiet := strings.Repeat("watchdog: 47 checks passed, nothing to do\n", 14)                             // about 600 bytes
	bad := strings.Repeat("watchdog: photos.example.com: HTTP 530 through the tunnel (since 03:12)\n", 56) // about 4 KB
	for i := 0; i < runs; i++ {
		f, err := openJobLog(dir, "watchdog", jobLogLimit)
		if err != nil {
			t.Fatal(err)
		}
		out := quiet
		if i/96 >= 200 && i/96 < 207 { // a bad week in July
			out = bad
		}
		fmt.Fprintf(f, "\n== %s\n%s", start.Add(time.Duration(i)*watchdogEvery).Format(time.RFC3339), out)
		f.Close()
	}
	var total int64
	entries, _ := os.ReadDir(dir)
	for _, e := range entries {
		fi, _ := e.Info()
		total += fi.Size()
		if fi.Size() > jobLogLimit+8<<10 {
			t.Errorf("%s is %d bytes, over the limit", e.Name(), fi.Size())
		}
	}
	if total > 30<<20 {
		t.Errorf("the folder is %d MB after a year", total>>20)
	}
	if len(entries) != 2 {
		t.Errorf("want watchdog.log and watchdog.1.log, have %d files", len(entries))
	}
	last := start.Add((runs - 1) * watchdogEvery).Format(time.RFC3339)
	path := filepath.Join(dir, "watchdog.log")
	if tail := tailFile(path, 40, filepath.Join(dir, "watchdog.1.log")); !strings.Contains(tail, last) {
		t.Errorf("the newest run (%s) is not in the last lines", last)
	}

	// Just after a split the job's own log is short: the report reads on
	// into the older half for the rest of its 40 lines.
	_ = os.WriteFile(filepath.Join(dir, "backup.1.log"), []byte("older 1\nolder 2\n"), 0o644)
	_ = os.WriteFile(filepath.Join(dir, "backup.log"), []byte("newer 1\n"), 0o644)
	if got := tailFile(filepath.Join(dir, "backup.log"), 2, filepath.Join(dir, "backup.1.log")); got != "older 2\nnewer 1\n" {
		t.Errorf("tail across the split = %q", got)
	}
}

// Started as the app's login item, the agent has no --root and runs from
// /: it finds the homelab folder as the app does (here HOMELAB_ROOT).
func TestFindsTheAppsFolderWithoutRoot(t *testing.T) {
	root, _ := repoCopy(t)
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
	t.Setenv("AppData", filepath.Join(home, "AppData"))
	t.Setenv("HOMELAB_ROOT", root)
	t.Chdir(t.TempDir())
	h, err := newHomelab(&ui.UI{Out: io.Discard}, "")
	if err != nil {
		t.Fatal(err)
	}
	if want, _ := filepath.EvalSymlinks(root); h.root != root && h.root != want {
		t.Fatalf("found %q, want %q", h.root, root)
	}
}
