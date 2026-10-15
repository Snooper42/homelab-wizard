//go:build !darwin

package main

import (
	"os"
	"os/exec"

	"github.com/Snooper42/homelab-wizard/app/tray"
)

// runTrayIfAsked runs the tray item when the app was started with --tray.
func runTrayIfAsked() bool {
	for _, a := range os.Args[1:] {
		if a == "--tray" {
			tray.Run(openWizard)
			return true
		}
	}
	return false
}

// startTray starts this binary again as the tray item; it exits at once if
// one is running already.
func startTray() { start("--tray") }

// openWizard opens the app on a screen; a running app gets the request
// through its single-instance lock.
func openWizard(screen string) { start("--screen", screen) }

func start(args ...string) {
	exe, err := os.Executable()
	if err != nil {
		return
	}
	// From an AppImage, start the AppImage file: this copy's folder is
	// mounted only while this process runs, and the tray outlives the app.
	if img := os.Getenv("APPIMAGE"); img != "" {
		exe = img
	}
	if c := exec.Command(exe, args...); c.Start() == nil {
		go c.Wait()
	}
}
