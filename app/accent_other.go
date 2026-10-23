//go:build !windows

package main

// systemAccent is nil here: the page keeps the platform's own blue.
func systemAccent() *Accent { return nil }
