//go:build !linux

package main

// desktop is empty off Linux: the Mac and Windows have one look each.
func desktop() string { return "" }
