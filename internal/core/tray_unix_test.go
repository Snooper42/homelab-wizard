//go:build !windows

package core

import (
	"os"
	"path/filepath"
	"testing"
)

// The tray's folder is used only when it is a real folder of this
// account's own: a link (to somewhere another account chose) is refused,
// and one others can open is closed to them first.
func TestTheTrayFolderMustBeThisAccountsOwn(t *testing.T) {
	dir := t.TempDir()
	open := filepath.Join(dir, "open")
	if err := os.Mkdir(open, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := ownFolder(open); err != nil {
		t.Fatal(err)
	}
	if fi, _ := os.Stat(open); fi.Mode().Perm() != 0o700 {
		t.Errorf("mode %v, want 0700", fi.Mode().Perm())
	}
	link := filepath.Join(dir, "link")
	if err := os.Symlink(open, link); err != nil {
		t.Fatal(err)
	}
	if ownFolder(link) == nil {
		t.Error("a link was taken as the tray's folder")
	}
	if os.Getuid() == 0 {
		theirs := filepath.Join(dir, "theirs")
		os.Mkdir(theirs, 0o700)
		if err := os.Chown(theirs, 65534, 65534); err != nil {
			t.Fatal(err)
		}
		if ownFolder(theirs) == nil {
			t.Error("another account's folder was taken as the tray's")
		}
	}
}
