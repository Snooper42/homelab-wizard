//go:build !darwin

package main

// startTrayHelper: elsewhere the tray starts with the app's own autostart.
func startTrayHelper(string) {}
