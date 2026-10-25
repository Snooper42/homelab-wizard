//go:build !darwin && !linux

package main

// setBadge does nothing on Windows: its taskbar has no plain number on an
// app's icon; the tray icon's dot says something needs a look instead.
func setBadge(int) {}
