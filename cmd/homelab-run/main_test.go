package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

// The job script as each system runs it: a .cmd through a hidden cmd.exe
// on Windows (where homelab-run is installed), sh elsewhere. The folder has
// a space in it, as "Homelab Wizard" does.
func TestRunPassesTheExitCode(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "Homelab Wizard", "scripts")
	os.MkdirAll(dir, 0o755)
	name, exit := "job.sh", "exit %d\n"
	if runtime.GOOS == "windows" {
		name, exit = "job.cmd", "@exit /b %d\r\n"
	}
	script := filepath.Join(dir, name)
	for _, code := range []int{0, 3} {
		body := []byte(fmt.Sprintf(exit, code))
		if err := os.WriteFile(script, body, 0o644); err != nil {
			t.Fatal(err)
		}
		if got := cli([]string{script}); got != code {
			t.Errorf("%q: exit %d, want %d", body, got, code)
		}
	}
	// The script's own output goes where the script sends it: the log.
	log := filepath.Join(dir, "job.log")
	body := "echo ran > \"" + log + "\"\n"
	if runtime.GOOS == "windows" {
		body = "@echo ran> \"" + log + "\"\r\n"
	}
	os.WriteFile(script, []byte(body), 0o644)
	if got := cli([]string{script}); got != 0 {
		t.Fatalf("exit %d", got)
	}
	if data, _ := os.ReadFile(log); len(data) < 3 || string(data[:3]) != "ran" {
		t.Errorf("the log: %q", data)
	}
	if got := cli([]string{filepath.Join(dir, "missing.cmd")}); got != 1 {
		t.Errorf("a missing script: exit %d, want 1", got)
	}
}

func TestUsage(t *testing.T) {
	for _, args := range [][]string{nil, {"a", "b"}} {
		if got := cli(args); got != 2 {
			t.Errorf("%q: exit %d, want 2", args, got)
		}
	}
}
