package procattr

import (
	"os/exec"
	"sync"
	"syscall"
)

// createNoWindow starts a console program without a console window.
const createNoWindow = 0x08000000

var noConsole = sync.OnceValue(func() bool {
	r, _, _ := syscall.NewLazyDLL("kernel32.dll").NewProc("GetConsoleWindow").Call()
	return r == 0
})

func hide(cmd *exec.Cmd) {
	if !noConsole() {
		return
	}
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.HideWindow = true
	cmd.SysProcAttr.CreationFlags |= createNoWindow
}
