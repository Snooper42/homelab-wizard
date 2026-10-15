//go:build darwin || linux

package diskspace

import (
	"fmt"
	"os"
	"syscall"
)

func usage(path string) (free, total uint64, err error) {
	var st syscall.Statfs_t
	if err := syscall.Statfs(path, &st); err != nil {
		return 0, 0, err
	}
	// Bavail: what an ordinary user may still write (root keeps a reserve).
	return uint64(st.Bavail) * uint64(st.Bsize), uint64(st.Blocks) * uint64(st.Bsize), nil
}

// volumeID is the device the folder is on.
func volumeID(path string) string {
	if fi, err := os.Stat(path); err == nil {
		if st, ok := fi.Sys().(*syscall.Stat_t); ok {
			return fmt.Sprint(st.Dev)
		}
	}
	return path
}
