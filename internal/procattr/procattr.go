// Package procattr keeps commands started by the desktop app from opening a
// console window each on Windows. A GUI program has no console, so Windows
// gives every docker, git, schtasks, or homelab command it starts a window
// of its own, which flashed every few seconds as Status refreshed.
package procattr

import "os/exec"

// Hide sets cmd to start without a console window when this process has
// none (the desktop app, or a command it started); a CLI in a terminal
// keeps sharing its console. Elsewhere it does nothing. It returns cmd.
func Hide(cmd *exec.Cmd) *exec.Cmd {
	hide(cmd)
	return cmd
}
