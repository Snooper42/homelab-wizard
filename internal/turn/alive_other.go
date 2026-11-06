//go:build !windows

package turn

import (
	"errors"
	"syscall"
)

// processAlive reports whether pid runs: signal 0 checks without sending
// anything; EPERM means it runs as someone else.
func processAlive(pid int) bool {
	err := syscall.Kill(pid, 0)
	return err == nil || errors.Is(err, syscall.EPERM)
}
