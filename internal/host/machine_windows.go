package host

import (
	"syscall"
	"time"
	"unsafe"
)

// memoryStatusEx is Windows' MEMORYSTATUSEX.
type memoryStatusEx struct {
	Length               uint32
	MemoryLoad           uint32
	TotalPhys            uint64
	AvailPhys            uint64
	TotalPageFile        uint64
	AvailPageFile        uint64
	TotalVirtual         uint64
	AvailVirtual         uint64
	AvailExtendedVirtual uint64
}

var kernel32 = syscall.NewLazyDLL("kernel32.dll")

func memory() uint64 {
	m := memoryStatusEx{Length: uint32(unsafe.Sizeof(memoryStatusEx{}))}
	if r, _, _ := kernel32.NewProc("GlobalMemoryStatusEx").Call(uintptr(unsafe.Pointer(&m))); r == 0 {
		return 0
	}
	return m.TotalPhys
}

func booted() time.Time {
	ms, _, _ := kernel32.NewProc("GetTickCount64").Call()
	if ms == 0 {
		return time.Time{}
	}
	return time.Now().Add(-time.Duration(ms) * time.Millisecond).Truncate(time.Second)
}
