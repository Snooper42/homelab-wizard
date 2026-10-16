package main

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"strings"
)

// agentPath is the LaunchAgent that starts the menu bar helper at login.
func agentPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "Library", "LaunchAgents", autostartID+".plist")
}

func trayAtLogin() bool { return fileExists(agentPath()) }

// trayCommand is the menu bar helper inside this app's bundle.
func trayCommand() (string, []string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", nil, err
	}
	helper := filepath.Clean(filepath.Join(filepath.Dir(exe), "..", "Helpers", "homelab-tray"))
	switch {
	case strings.Contains(helper, "/AppTranslocation/"):
		return "", nil, errors.New("move Homelab Wizard to Applications first: until then macOS runs it from a temporary copy")
	case !fileExists(helper):
		return "", nil, errors.New("this build has no menu bar helper (Contents/Helpers/homelab-tray)")
	}
	return helper, nil, nil
}

func enableTrayAtLogin(exe string, args []string) error {
	if err := os.MkdirAll(filepath.Dir(agentPath()), 0o755); err != nil {
		return err
	}
	plist := launchAgent(exe, args)
	// Rewriting an unchanged one makes macOS announce it again.
	if old, err := os.ReadFile(agentPath()); err == nil && bytes.Equal(old, plist) {
		return nil
	}
	return os.WriteFile(agentPath(), plist, 0o644)
}

func disableTrayAtLogin() error {
	if err := os.Remove(agentPath()); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
