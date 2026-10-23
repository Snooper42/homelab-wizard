package main

import (
	"os"
	"strings"
)

// desktop names the Linux desktop the app runs on, for its look: "kde"
// (Plasma, SteamOS's desktop mode) draws it as Breeze; anything else
// keeps the GNOME look.
func desktop() string {
	if strings.Contains(strings.ToUpper(os.Getenv("XDG_CURRENT_DESKTOP")), "KDE") {
		return "kde"
	}
	return ""
}
