//go:build !windows

package main

import (
	"os/exec"
	"syscall"
)

// detach starts c in a session of its own, so it outlives the terminal and
// the app that started it.
func detach(c *exec.Cmd) {
	if c.SysProcAttr == nil {
		c.SysProcAttr = &syscall.SysProcAttr{}
	}
	c.SysProcAttr.Setsid = true
}
