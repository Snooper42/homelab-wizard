package main

import "golang.org/x/sys/windows/registry"

// systemAccent is the accent picked in Windows' Settings, or nil.
func systemAccent() *Accent {
	k, err := registry.OpenKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Explorer\Accent`, registry.QUERY_VALUE)
	if err != nil {
		return nil
	}
	defer k.Close()
	b, _, err := k.GetBinaryValue("AccentPalette")
	if err != nil {
		return nil
	}
	return accentFromPalette(b)
}
