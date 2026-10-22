package battery

import (
	"syscall"
	"unsafe"
)

// systemPowerStatus is Windows' SYSTEM_POWER_STATUS.
type systemPowerStatus struct {
	ACLineStatus        byte
	BatteryFlag         byte
	BatteryLifePercent  byte
	SystemStatusFlag    byte
	BatteryLifeTime     uint32
	BatteryFullLifeTime uint32
}

// windowsPowerStatus asks Windows whether it runs on AC power, and about
// its battery; ok is false when the call fails.
func windowsPowerStatus() (acLine, batteryFlag byte, ok bool) {
	var s systemPowerStatus
	r, _, _ := syscall.NewLazyDLL("kernel32.dll").NewProc("GetSystemPowerStatus").Call(uintptr(unsafe.Pointer(&s)))
	return s.ACLineStatus, s.BatteryFlag, r != 0
}
