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
	was, err := os.Stat(path)
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
