package homepage

import (
	"os"
	"path/filepath"
	"testing"
)

// Homepage's config is replaced whole, never rewritten in place: the
// Homepage container reads it live, and a read at that moment would show
// a dashboard with half its apps.
func TestTheConfigIsReplacedWhole(t *testing.T) {
	path := filepath.Join(t.TempDir(), "services.yaml")
	if _, err := Write(path, []byte(Marker+"\n- one\n")); err != nil {
		t.Fatal(err)
	}
	was, err := statNow(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Write(path, []byte(Marker+"\n- one\n- two\n")); err != nil {
		t.Fatal(err)
	}
	now, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if os.SameFile(was, now) {
		t.Error("the config was rewritten in place")
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
