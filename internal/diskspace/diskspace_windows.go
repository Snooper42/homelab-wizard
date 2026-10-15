package diskspace

import (
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

var getDiskFreeSpaceEx = syscall.NewLazyDLL("kernel32.dll").NewProc("GetDiskFreeSpaceExW")

func usage(path string) (free, total uint64, err error) {
	p, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return 0, 0, err
	}
	// The free bytes this user may write (quotas count), and the disk's size.
	r, _, callErr := getDiskFreeSpaceEx.Call(uintptr(unsafe.Pointer(p)), uintptr(unsafe.Pointer(&free)), uintptr(unsafe.Pointer(&total)), 0)
	if r == 0 {
		return 0, 0, callErr
	}
	return free, total, nil
}

// volumeID is the drive (C:) or share (\\server\share) the folder is on.
func volumeID(path string) string {
	if abs, err := filepath.Abs(path); err == nil {
		path = abs
	}
	return strings.ToUpper(filepath.VolumeName(path))
}
