//go:build !windows

package crash

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

// Crash notes are this account's only: the folder they are in is 0700,
// one an older version made 0755 included, and each note is 0600. Another
// account on the computer can't read the household's diagnostics.
func TestCrashNotesAreThisAccountsOnly(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "logs")
	if err := os.MkdirAll(dir, 0o755); err != nil { // as an older version made it
		t.Fatal(err)
	}
	cmd := exec.Command(os.Args[0], "-test.run=^$")
	cmd.Env = append(os.Environ(), "CRASH_TEST_DIR="+dir)
	if err := cmd.Run(); err == nil {
		t.Fatal("the process should have crashed")
	}
	if fi, err := os.Stat(dir); err != nil || fi.Mode().Perm() != 0o700 {
		t.Errorf("the logs folder is %v (%v), not 0700", fi.Mode().Perm(), err)
	}
	c, ok := Newest(dir)
	if !ok {
		t.Fatal("no crash saved")
	}
	if fi, err := os.Stat(filepath.Join(dir, filepath.Base(c.File))); err != nil || fi.Mode().Perm() != 0o600 {
		t.Errorf("the crash note is %v (%v), not 0600", fi.Mode().Perm(), err)
	}
}
