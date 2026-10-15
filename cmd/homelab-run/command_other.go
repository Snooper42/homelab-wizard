//go:build !windows

package main

import "os/exec"

// command runs the script with sh; homelab-run is only installed on
// Windows, where jobs would otherwise open a window.
func command(script string) *exec.Cmd { return exec.Command("sh", script) }
