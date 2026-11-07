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
	was, err := statNow(path)
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

// statNow stats the file at path as it is now. os.Stat on Windows reads
// the file's identity only when SameFile asks, by path, so it would see
// whatever file is there by then; a stat through an open file reads it at
// once.
func statNow(path string) (os.FileInfo, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return f.Stat()
}
