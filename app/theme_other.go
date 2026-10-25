//go:build !darwin

package main

// setNativeTheme does nothing here: Wails sets Windows' title bar, and on
// Linux the page draws everything.
func setNativeTheme(string) {}
