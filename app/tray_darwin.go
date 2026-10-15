package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

// On macOS the menu bar item is a separate helper in the bundle: Wails and
// the tray library both define an AppDelegate class, so they cannot share
// one binary.
func runTrayIfAsked() bool { return false }

// startTray starts the helper; it exits at once if one is running already.
// Under wails dev there is no bundle, so nothing starts.
func startTray() {
	exe, err := os.Executable()
	if err != nil {
		return
	}
	helper := filepath.Join(filepath.Dir(exe), "..", "Helpers", "homelab-tray")
	if _, err := os.Stat(helper); err == nil {
		c := exec.Command(helper)
		// Its own session, so it keeps running when the app quits.
		c.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
		if c.Start() == nil {
			go c.Wait()
		}
	}
}
