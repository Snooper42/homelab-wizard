//go:build !windows

package selfupdate

import "syscall"

// detached puts the helper in its own session, so it outlives the app.
func detached() *syscall.SysProcAttr { return &syscall.SysProcAttr{Setsid: true} }
