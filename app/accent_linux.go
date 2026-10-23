package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// systemAccent is the accent picked in KDE's or GNOME's settings, or nil
// for their own blue (and on other desktops).
func systemAccent() *Accent {
	if strings.Contains(strings.ToUpper(os.Getenv("XDG_CURRENT_DESKTOP")), "KDE") {
		dir, err := os.UserConfigDir()
		if err != nil {
			return nil
		}
		data, err := os.ReadFile(filepath.Join(dir, "kdeglobals"))
		if err != nil {
			return nil
		}
		return kdeAccent(string(data))
	}
	out, err := exec.Command("gsettings", "get", "org.gnome.desktop.interface", "accent-color").Output()
	if err != nil {
		return nil // before GNOME 47, or another desktop
	}
	return gnomeAccent(string(out))
}
