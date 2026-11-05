package api

import "strings"

// PinnedKey is the .env key listing the apps pinned to the top of Status
// and of the menu bar's Open an app, in the order they were pinned
// (homelab pin <app>; homelab unpin puts one back in its group).
const PinnedKey = "APPS_PINNED"

// Pinned lists the pinned apps, from .env values, in their order.
func Pinned(env map[string]string) []string {
	var out []string
	seen := map[string]bool{}
	for _, id := range strings.Split(env[PinnedKey], ",") {
		if id = strings.TrimSpace(id); id != "" && !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	return out
}

// SetPinned pins an app (at the end, after those pinned before) or unpins
// it, and returns the new value for PinnedKey.
func SetPinned(env map[string]string, app string, pin bool) string {
	var out []string
	for _, id := range Pinned(env) {
		if id != app {
			out = append(out, id)
		}
	}
	if pin {
		out = append(out, app)
	}
	return strings.Join(out, ",")
}
