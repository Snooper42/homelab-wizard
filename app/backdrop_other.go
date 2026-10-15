//go:build !windows

package main

// micaSupported is Windows-only; the Mac's translucency needs no check.
func micaSupported() bool { return false }
