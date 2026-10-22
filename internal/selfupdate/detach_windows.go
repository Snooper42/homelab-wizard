package selfupdate

import "syscall"

// detached: the Linux helper never runs on Windows.
func detached() *syscall.SysProcAttr { return nil }
