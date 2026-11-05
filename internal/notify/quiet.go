package notify

import (
	"github.com/Snooper42/homelab-wizard/internal/applist"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

// The apps the watchdog does not alert about (homelab notify off <app>; on
// puts one back) are a record in data/, alerts-off.json (applist.AlertsOff).
// Their checks still run and show on Status.

// QuietKey is the .env setting that held the list before the record.
const QuietKey = "ALERTS_OFF"

// QuietPath is the record in the homelab folder.
func QuietPath(root string) string { return applist.AlertsOff.Path(root) }

// LoadQuiet lists the apps whose alerts are off: the record in root (none
// when root is ""), and any env still lists from before it.
func LoadQuiet(root string, env map[string]string) []string {
	return applist.AlertsOff.Load(root, env)
}

// SetQuiet turns an app's alerts off (quiet) or on again.
func SetQuiet(root, app string, quiet bool) error { return applist.AlertsOff.Set(root, app, quiet) }

// CarryQuiet moves the apps in env's QuietKey into the record and takes
// the key out of env, for the caller to save; it reports whether there
// was one.
func CarryQuiet(root string, env *envfile.File) (bool, error) {
	return applist.AlertsOff.Carry(root, env)
}
