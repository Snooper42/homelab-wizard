//go:build forreal

package notify

import (
	"bytes"
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// An alert on the Mac's screen, through the code path the watchdog uses
// (Desktop: osascript's display notification), seen in Notification
// Center's own record of what it delivered (usernoted's database, where
// each notification's title is kept in its record). CI runs it on the
// macOS runner (go test -tags forreal).
func TestDesktopAlertArrivesForReal(t *testing.T) {
	title := "Homelab test " + time.Now().Format("150405.000")
	if err := Desktop(context.Background(), title, "Sent by TestDesktopAlertArrivesForReal."); err != nil {
		t.Fatal(err)
	}
	dbs := notificationDatabases(t)
	if len(dbs) == 0 {
		t.Fatal("no Notification Center database found (usernoted's db2)")
	}
	var why []string
	for end := time.Now().Add(15 * time.Second); ; time.Sleep(time.Second) {
		why = why[:0]
		for _, db := range dbs {
			// The newest records may still be in the write-ahead log.
			for _, f := range []string{db, db + "-wal"} {
				data, err := os.ReadFile(f)
				switch {
				case err == nil && bytes.Contains(data, []byte(title)):
					t.Logf("%q found in %s", title, f)
					return
				case err != nil && !os.IsNotExist(err):
					why = append(why, err.Error())
				}
			}
		}
		if time.Now().After(end) {
			t.Fatalf("no notification %q in Notification Center's record after 15 seconds (%s) %s", title, strings.Join(dbs, ", "), strings.Join(why, "; "))
		}
	}
}

// notificationDatabases are usernoted's databases: in its group container
// since macOS 15, under the per-user folder before.
func notificationDatabases(t *testing.T) []string {
	t.Helper()
	var out []string
	home, _ := os.UserHomeDir()
	candidates := []string{filepath.Join(home, "Library", "Group Containers", "group.com.apple.usernoted", "db2", "db")}
	if dir, err := exec.Command("getconf", "DARWIN_USER_DIR").Output(); err == nil {
		candidates = append(candidates, filepath.Join(strings.TrimSpace(string(dir)), "com.apple.notificationcenter", "db2", "db"))
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil || !os.IsNotExist(err) {
			out = append(out, c)
		}
	}
	return out
}
