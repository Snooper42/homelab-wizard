//go:build !darwin

package main

// setBadge does nothing off the Mac: Windows' taskbar and Linux docks have
// no plain number on an app's icon.
func setBadge(int) {}
