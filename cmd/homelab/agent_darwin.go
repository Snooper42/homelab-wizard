package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

// trayAtLoginFile marks that the menu bar item starts at login; the agent
// starts it then, so it needs no login item of its own. The app writes it.
func trayAtLoginFile() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	return filepath.Join(dir, "Homelab Wizard", "tray-at-login")
}

// startTrayHelper starts the menu bar helper beside this binary in the app
// bundle when it is to start at login; it exits by itself if one runs.
func startTrayHelper(self string) {
	if _, err := os.Stat(trayAtLoginFile()); err != nil {
		return
	}
	helper := trayHelperFor(self)
	if helper == "" {
		return
	}
	c := exec.Command(helper)
	// Its own session, so it stays when the agent restarts.
	c.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	if c.Start() == nil {
		go c.Wait()
	}
}

// trayHelperFor finds the menu bar helper for the agent at self: beside it
// in Contents/Helpers, or, from the agent's own bundle in
// Contents/Library/LoginItems, in the outer app's Contents/Helpers.
func trayHelperFor(self string) string {
	candidates := []string{filepath.Join(filepath.Dir(self), "homelab-tray")}
	if i := strings.Index(self, "/Contents/Library/LoginItems/"); i >= 0 {
		candidates = append(candidates, self[:i]+"/Contents/Helpers/homelab-tray")
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	return ""
}
