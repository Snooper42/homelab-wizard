package storage

import (
	"os"
	"path/filepath"
	"testing"
)

// A reading is replaced whole, never rewritten in place: one read
// half-written (the app's Storage screen, while the nightly job saves)
// would show no apps at all.
func TestAReadingIsReplacedWhole(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data", "storage.json")
	if err := (Record{}).Save(path); err != nil {
		t.Fatal(err)
	}
	was, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := (Record{}).Save(path); err != nil {
		t.Fatal(err)
	}
	now, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if os.SameFile(was, now) {
		t.Error("the reading was rewritten in place")
	}
	if now.Mode().Perm() != 0o600 && os.PathSeparator == '/' {
		t.Errorf("mode %v", now.Mode().Perm())
	}
}
