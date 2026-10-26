//go:build !windows

package main

import (
	"os"
	"path/filepath"
	"syscall"
	"testing"
)

func TestGiveToPUID(t *testing.T) {
	root, _ := repoCopy(t, "PUID=4242", "PGID=4343")
	h := &homelab{root: root, envFile: filepath.Join(root, ".env")}
	dir := t.TempDir()
	h.giveToPUID(dir)
	st, err := os.Stat(dir)
	if err != nil {
		t.Fatal(err)
	}
	owner := st.Sys().(*syscall.Stat_t)
	// As root, the folder becomes the apps' account's; as anyone else it
	// stays the maker's, which is already that account.
	if os.Geteuid() == 0 && (owner.Uid != 4242 || owner.Gid != 4343) {
		t.Errorf("as root: owned by %d:%d, want 4242:4343", owner.Uid, owner.Gid)
	}
	if os.Geteuid() != 0 && int(owner.Uid) != os.Geteuid() {
		t.Errorf("as %d: owned by %d", os.Geteuid(), owner.Uid)
	}
}
