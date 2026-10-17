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

// trayMarker tells the homelab's background agent to start the menu bar
// item at login (homelab agent), so it needs no login item of its own.
func trayMarker() string {
	dir, _ := os.UserConfigDir()
	return filepath.Join(dir, "Homelab Wizard", "tray-at-login")
}

// homelabAgent is the homelab's one background job, when it is installed.
func homelabAgent() bool {
	home, _ := os.UserHomeDir()
	return fileExists(filepath.Join(home, "Library", "LaunchAgents", "com.homelab.agent.plist"))
}

func trayAtLogin() bool { return fileExists(agentPath()) || fileExists(trayMarker()) }

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
	// With the homelab's agent running at login, it starts the menu bar
	// item: one login item instead of two.
	if homelabAgent() {
		if err := os.MkdirAll(filepath.Dir(trayMarker()), 0o755); err != nil {
			return err
		}
		if err := os.WriteFile(trayMarker(), nil, 0o644); err != nil {
			return err
		}
		return removeIfThere(agentPath())
	}
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
	if err := removeIfThere(trayMarker()); err != nil {
		return err
	}
	return removeIfThere(agentPath())
}

func removeIfThere(path string) error {
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

// foldTrayIntoAgent moves starting the menu bar item at login from its own
// login item to the homelab's agent, once the agent is installed.
func foldTrayIntoAgent() {
	if homelabAgent() && fileExists(agentPath()) {
		if exe, args, err := trayCommand(); err == nil {
			_ = enableTrayAtLogin(exe, args)
		}
	}
}
