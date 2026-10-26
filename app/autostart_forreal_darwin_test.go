//go:build forreal

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"testing"
	"time"
)

// The menu bar item started at login, turned on as Settings does: its
// LaunchAgent is written, and launchd loads it and runs its program, as
// at login (a stand-in that leaves a file). Turned off, nothing is left.
func TestTrayAtLoginForReal(t *testing.T) {
	if homelabAgent() || trayAtLogin() {
		t.Fatal("the homelab's agent or the tray's login item is installed before the test")
	}
	marker := filepath.Join(t.TempDir(), "started")
	domain := "gui/" + strconv.Itoa(os.Getuid())
	t.Cleanup(func() {
		_ = exec.Command("launchctl", "bootout", domain+"/"+autostartID).Run()
		_ = disableTrayAtLogin()
	})
	if err := enableTrayAtLogin("/usr/bin/touch", []string{marker}); err != nil {
		t.Fatal(err)
	}
	if !trayAtLogin() {
		t.Fatal("turned on, but trayAtLogin says off")
	}
	if out, err := exec.Command("plutil", "-lint", agentPath()).CombinedOutput(); err != nil {
		t.Fatalf("plutil -lint: %v\n%s", err, out)
	}
	if out, err := exec.Command("launchctl", "bootstrap", domain, agentPath()).CombinedOutput(); err != nil {
		t.Fatalf("launchctl bootstrap: %v\n%s", err, out)
	}
	waitForFile(t, marker)
	if out, err := exec.Command("launchctl", "bootout", domain+"/"+autostartID).CombinedOutput(); err != nil {
		t.Fatalf("launchctl bootout: %v\n%s", err, out)
	}

	if err := disableTrayAtLogin(); err != nil {
		t.Fatal(err)
	}
	if trayAtLogin() || fileExists(agentPath()) {
		t.Fatalf("turned off, but %s is still there", agentPath())
	}
	if exec.Command("launchctl", "print", domain+"/"+autostartID).Run() == nil {
		t.Fatal("turned off, but launchd still has it")
	}
}

// waitForFile waits up to 30 seconds for the program at login to run.
func waitForFile(t *testing.T, path string) {
	t.Helper()
	for end := time.Now().Add(30 * time.Second); ; time.Sleep(500 * time.Millisecond) {
		if _, err := os.Stat(path); err == nil {
			return
		}
		if time.Now().After(end) {
			t.Fatalf("what starts at login did not run within 30 seconds (no %s)", path)
		}
	}
}
