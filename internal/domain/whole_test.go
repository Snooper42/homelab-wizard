package domain

import (
	"os"
	"path/filepath"
	"testing"
)

// The home address is replaced whole, never rewritten in place: one read
// half-written (the app's Settings, domain setup run again) would read as
// no address set.
func TestTheHomeAddressIsReplacedWhole(t *testing.T) {
	path := HomePath(t.TempDir())
	if err := (Home{Address: "192.168.1.10"}).Save(path); err != nil {
		t.Fatal(err)
	}
	was, err := statNow(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := (Home{Address: "192.168.1.10", AdGuard: true}).Save(path); err != nil {
		t.Fatal(err)
	}
	now, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if os.SameFile(was, now) {
		t.Errorf("%s was rewritten in place", filepath.Base(path))
	}
	if h := LoadHome(path); !h.AdGuard {
		t.Errorf("home %+v", h)
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
