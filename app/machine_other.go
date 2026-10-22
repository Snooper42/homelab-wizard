//go:build !darwin && !linux && !windows

package main

func readMachine() (string, string) { return "", "" }
