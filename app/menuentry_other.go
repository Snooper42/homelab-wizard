//go:build !linux

package main

import "errors"

// Only a Linux AppImage needs to add itself to the app menu.
func menuEntryState() MenuEntry { return MenuEntry{} }

func addMenuEntry() error { return errors.New("only the Linux AppImage adds itself to the app menu") }

func removeMenuEntry() error { return nil }

func followAppImage() {}
