package api

import (
	"github.com/Snooper42/homelab-wizard/internal/applist"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

// The apps pinned to the top of Status and of the menu bar's Open an app,
// in the order they were pinned (homelab pin <app>; homelab unpin puts one
// back in its group), are a record in data/, pinned.json (applist.Pinned).

// PinnedKey is the .env setting that held the list before the record.
const PinnedKey = "APPS_PINNED"

// PinnedPath is the record in the homelab folder.
func PinnedPath(root string) string { return applist.Pinned.Path(root) }

// Pinned lists the pinned apps in their order: the record in root (none
// when root is ""), and any env still lists from before it.
func Pinned(root string, env map[string]string) []string { return applist.Pinned.Load(root, env) }

// SetPinned pins an app (at the end, after those pinned before) or unpins it.
func SetPinned(root, app string, pin bool) error { return applist.Pinned.Set(root, app, pin) }

// CarryPinned moves the apps in env's PinnedKey into the record and takes
// the key out of env, for the caller to save; it reports whether there
// was one.
func CarryPinned(root string, env *envfile.File) (bool, error) {
	return applist.Pinned.Carry(root, env)
}
