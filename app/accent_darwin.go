package main

import "os/exec"

// systemAccent is the accent picked in System Settings › Appearance, or
// nil for Multicolor and blue (the Mac's own).
func systemAccent() *Accent {
	out, err := exec.Command("defaults", "read", "-g", "AppleAccentColor").Output()
	if err != nil {
		return nil // never set: Multicolor
	}
	return macAccent(string(out))
}
