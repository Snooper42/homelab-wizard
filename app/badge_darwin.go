package main

import (
	"strconv"

	"github.com/Snooper42/homelab-wizard/app/dock"
)

// setBadge shows n on the app's Dock icon, as Mail shows unread mail; 0
// clears it.
func setBadge(n int) {
	label := ""
	if n > 0 {
		label = strconv.Itoa(n)
	}
	dock.SetBadge(label)
}
