package main

import (
	"os/exec"
	"strings"
)

func readMachine() (string, string) {
	version := ""
	if out, err := exec.Command("sw_vers", "-productVersion").Output(); err == nil {
		version = "macOS " + strings.TrimSpace(string(out))
	}
	model := ""
	if out, err := exec.Command("system_profiler", "SPHardwareDataType").Output(); err == nil {
		model = macModel(string(out))
	}
	return version, model
}
