package backup

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// The restore test's log is replaced whole, never rewritten in place: one
// read half-written says no test ever passed, and Backups asks for one
// again.
func TestTheRestoreLogIsReplacedWhole(t *testing.T) {
	path := filepath.Join(t.TempDir(), "scripts", "logs", "restore-test.json")
	if err := (RestoreLog{LastTest: time.Now()}).Save(path); err != nil {
		t.Fatal(err)
	}
	was, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := (RestoreLog{LastTest: time.Now(), LastSummary: "ok"}).Save(path); err != nil {
		t.Fatal(err)
	}
	now, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if os.SameFile(was, now) {
		t.Error("the restore log was rewritten in place")
	}
}
