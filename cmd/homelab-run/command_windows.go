package main

import (
	"os/exec"
	"syscall"
)

// createNoWindow keeps cmd.exe from opening a console window.
const createNoWindow = 0x08000000

// command runs the script through cmd.exe, hidden. /s with the doubled
// quotes keeps a path with spaces intact.
func command(script string) *exec.Cmd {
	c := exec.Command("cmd.exe")
	c.SysProcAttr = &syscall.SysProcAttr{
		CmdLine:       `cmd.exe /d /s /c ""` + script + `""`,
		HideWindow:    true,
		CreationFlags: createNoWindow,
	}
	return c
}
