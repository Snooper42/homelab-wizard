//go:build forreal

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

// The tray started at login, turned on as Settings does: its autostart
// entry is written (in a config folder of the test's own), and gio starts
// it the way the desktop's session does at login (a stand-in that leaves
// a file, its path with a space to test the quoting). Turned off, the
// entry is gone.
func TestTrayAtLoginForReal(t *testing.T) {
	config := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", config)
	dir := filepath.Join(t.TempDir(), "a folder")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	marker := filepath.Join(dir, "started")
	if err := enableTrayAtLogin("/usr/bin/touch", []string{marker}); err != nil {
		t.Fatal(err)
	}
	if !trayAtLogin() {
		t.Fatal("turned on, but trayAtLogin says off")
	}
	if out, err := exec.Command("gio", "launch", autostartPath()).CombinedOutput(); err != nil {
		t.Fatalf("gio launch: %v\n%s", err, out)
	}
	for end := time.Now().Add(30 * time.Second); ; time.Sleep(500 * time.Millisecond) {
		if _, err := os.Stat(marker); err == nil {
			break
		}
		if time.Now().After(end) {
			t.Fatalf("the autostart entry's command left no %s", marker)
		}
	}

	if err := disableTrayAtLogin(); err != nil {
		t.Fatal(err)
	}
	if trayAtLogin() || fileExists(autostartPath()) {
		t.Fatalf("turned off, but %s is still there", autostartPath())
	}
}
