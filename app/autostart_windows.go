package main

import (
	"errors"
	"os"

	"golang.org/x/sys/windows/registry"
)

// runKeyPath holds the commands Windows starts when this user signs in.
const runKeyPath = `Software\Microsoft\Windows\CurrentVersion\Run`

func trayAtLogin() bool {
	k, err := registry.OpenKey(registry.CURRENT_USER, runKeyPath, registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	defer k.Close()
	_, _, err = k.GetStringValue(autostartID)
	return err == nil
}

// trayCommand is this app with --tray.
func trayCommand() (string, []string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", nil, err
	}
	return exe, []string{"--tray"}, nil
}

func enableTrayAtLogin(exe string, args []string) error {
	k, _, err := registry.CreateKey(registry.CURRENT_USER, runKeyPath, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	return k.SetStringValue(autostartID, runValue(exe, args))
}

func disableTrayAtLogin() error {
	k, err := registry.OpenKey(registry.CURRENT_USER, runKeyPath, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	if err := k.DeleteValue(autostartID); err != nil && !errors.Is(err, registry.ErrNotExist) {
		return err
	}
	return nil
}

// foldTrayIntoAgent: only the Mac starts the tray from the homelab agent.
func foldTrayIntoAgent() {}

func agentOutsideBundle() bool { return false }
