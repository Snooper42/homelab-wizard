//go:build forreal

package main

import (
	"os"
	"os/exec"
	"runtime"
	"strings"
	"testing"
)

// Setup's Machine row read on the machine this runs on, from each
// system's own source: sw_vers and system_profiler on macOS, the registry
// on Windows, /etc/os-release and the firmware's product name on Linux.
// A runner is a virtual machine, so its model is whatever its firmware
// says; each must still give a system and a model. CI runs it on each
// system's runner (go test -tags forreal).
func TestMachineReadForReal(t *testing.T) {
	version, model := readMachine()
	t.Logf("this machine: %q, %q", version, model)
	switch runtime.GOOS {
	case "darwin":
		out, err := exec.Command("sw_vers", "-productVersion").Output()
		if err != nil {
			t.Fatal(err)
		}
		if want := "macOS " + strings.TrimSpace(string(out)); version != want {
			t.Errorf("the system reads %q, want %q", version, want)
		}
	case "windows":
		if !strings.HasPrefix(version, "Windows 1") {
			t.Errorf("the system reads %q, want Windows 10 or 11", version)
		}
	case "linux":
		data, err := os.ReadFile("/etc/os-release")
		if err != nil {
			t.Fatal(err)
		}
		if want := osRelease(string(data)); version == "" || version != want {
			t.Errorf("the system reads %q, want %q", version, want)
		}
	default:
		t.Fatalf("no machine to read on %s", runtime.GOOS)
	}
	if model == "" {
		t.Error("no model read")
	}
}
