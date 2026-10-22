//go:build !windows

package battery

// windowsPowerStatus is only asked on Windows.
func windowsPowerStatus() (acLine, batteryFlag byte, ok bool) { return 0, 0, false }
