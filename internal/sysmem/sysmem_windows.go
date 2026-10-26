//go:build windows

package sysmem

import (
	"syscall"
	"unsafe"
)

// memoryStatusEx is Windows' MEMORYSTATUSEX.
type memoryStatusEx struct {
	length, memoryLoad                   uint32
	totalPhys, availPhys                 uint64
	totalPageFile, availPageFile         uint64
	totalVirtual, availVirtual, availExt uint64
}

// windowsTotal is the physical memory in bytes (GlobalMemoryStatusEx), or
// 0 where it cannot be read.
func windowsTotal() uint64 {
	m := memoryStatusEx{}
	m.length = uint32(unsafe.Sizeof(m))
	proc := syscall.NewLazyDLL("kernel32.dll").NewProc("GlobalMemoryStatusEx")
	if err := proc.Find(); err != nil {
		return 0
	}
	if ok, _, _ := proc.Call(uintptr(unsafe.Pointer(&m))); ok == 0 {
		return 0
	}
	return m.totalPhys
}
