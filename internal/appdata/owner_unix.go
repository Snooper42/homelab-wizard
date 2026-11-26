//go:build !windows

package appdata

import (
	"os"
	"syscall"
)

// keepOwner gives the copy the original's owner where the system allows it (as root, or the same user already);
// containers that run as their own user read their files as before.
func keepOwner(p string, info os.FileInfo) {
	if st, ok := info.Sys().(*syscall.Stat_t); ok {
		_ = os.Lchown(p, int(st.Uid), int(st.Gid))
	}
}
