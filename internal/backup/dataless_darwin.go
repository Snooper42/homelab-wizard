//go:build darwin

package backup

import (
	"io/fs"
	"syscall"
)

// sfDataless is macOS's SF_DATALESS (sys/stat.h): the file's contents are
// not on this Mac yet, only in its cloud drive (a File Provider placeholder).
const sfDataless = 0x40000000

// Dataless reports whether a file is a cloud drive's placeholder.
func Dataless(info fs.FileInfo) bool {
	st, ok := info.Sys().(*syscall.Stat_t)
	return ok && st.Flags&sfDataless != 0
}
