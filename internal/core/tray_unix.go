//go:build !windows

package core

import (
	"fmt"
	"os"
	"syscall"
)

// ownFolder makes sure dir is a folder (not a link) that this account owns
// and only it can open: one another account made first in a shared
// temporary folder is refused, not used.
func ownFolder(dir string) error {
	fi, err := os.Lstat(dir)
	if err != nil {
		return err
	}
	st, ok := fi.Sys().(*syscall.Stat_t)
	if !fi.IsDir() || !ok || int(st.Uid) != os.Getuid() {
		return fmt.Errorf("%s is not this account's own folder", dir)
	}
	if fi.Mode().Perm()&0o077 != 0 {
		return os.Chmod(dir, 0o700)
	}
	return nil
}
