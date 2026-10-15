// Package web is the desktop app's frontend (plain HTML, CSS, and
// JavaScript, no build step). The desktop app shows it in its window, and
// homelab serve shows the same screens on a phone.
package web

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var dist embed.FS

// Files is the frontend, index.html at its root.
func Files() fs.FS {
	sub, err := fs.Sub(dist, "dist")
	if err != nil {
		panic(err)
	}
	return sub
}
