//go:build !windows

package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// The jobs' logs are this account's only: scripts/logs is 0700, one an
// older version made 0755 included, and a job's log and its older half
// are 0600 (Account 3's note in audit-loop.md).
func TestJobLogsAreThisAccountsOnly(t *testing.T) {
	h := &homelab{root: t.TempDir()}
	if err := os.MkdirAll(h.logsDir(), 0o755); err != nil { // as an older version made it
		t.Fatal(err)
	}
	if err := h.makeLogsDir(); err != nil {
		t.Fatal(err)
	}
	if fi, err := os.Stat(h.logsDir()); err != nil || fi.Mode().Perm() != 0o700 {
		t.Errorf("scripts/logs is %v (%v), not 0700", fi.Mode().Perm(), err)
	}
	f, err := openJobLog(h.logsDir(), "watchdog", 64)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = f.WriteString(strings.Repeat("watchdog: 47 checks passed\n", 8))
	_ = f.Close()
	f, err = openJobLog(h.logsDir(), "watchdog", 64) // past the limit: split
	if err != nil {
		t.Fatal(err)
	}
	_ = f.Close()
	for _, name := range []string{"watchdog.log", "watchdog.1.log"} {
		if fi, err := os.Stat(filepath.Join(h.logsDir(), name)); err != nil || fi.Mode().Perm() != 0o600 {
			t.Errorf("%s is %v (%v), not 0600", name, fi.Mode().Perm(), err)
		}
	}
}
