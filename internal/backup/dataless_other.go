//go:build !darwin

package backup

import "io/fs"

// Dataless reports whether a file is a cloud drive's placeholder: only a Mac
// marks one (dataless_darwin.go); elsewhere a cloud drive's files read as
// any other.
func Dataless(fs.FileInfo) bool { return false }
