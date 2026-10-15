package procattr

import (
	"os/exec"
	"runtime"
	"testing"
)

func TestHideReturnsTheCommand(t *testing.T) {
	cmd := exec.Command("go", "version")
	if Hide(cmd) != cmd {
		t.Fatal("Hide should return the command it was given")
	}
	if runtime.GOOS != "windows" && cmd.SysProcAttr != nil {
		t.Errorf("Hide changed the command on %s", runtime.GOOS)
	}
}
