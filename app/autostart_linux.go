package main

import (
	"os"
	"path/filepath"
)

// autostartPath is the XDG autostart entry that starts the tray at login.
func autostartPath() string {
	dir := os.Getenv("XDG_CONFIG_HOME")
	if dir == "" {
		home, _ := os.UserHomeDir()
		dir = filepath.Join(home, ".config")
	}
	return filepath.Join(dir, "autostart", autostartID+".desktop")
}

func trayAtLogin() bool { return fileExists(autostartPath()) }

// trayCommand is this app with --tray; from an AppImage, the AppImage file
// (its mounted folder changes on every start).
func trayCommand() (string, []string, error) {
	if img := os.Getenv("APPIMAGE"); img != "" {
		return img, []string{"--tray"}, nil
	}
	exe, err := os.Executable()
	if err != nil {
		return "", nil, err
	}
	return exe, []string{"--tray"}, nil
}

func enableTrayAtLogin(exe string, args []string) error {
	if err := os.MkdirAll(filepath.Dir(autostartPath()), 0o755); err != nil {
		return err
	}
	return os.WriteFile(autostartPath(), autostartEntry(exe, args), 0o644)
}

func disableTrayAtLogin() error {
	if err := os.Remove(autostartPath()); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
