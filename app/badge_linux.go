package main

import (
	"os"

	"github.com/godbus/dbus/v5"
)

// setBadge shows n on the app's icon in the taskbar or dock, as the Mac's
// Dock badge does: KDE Plasma (SteamOS's desktop), Ubuntu's dock, and
// GNOME's Dash to Dock read the Unity launcher API on the session bus;
// elsewhere nothing shows. 0 clears it.
func setBadge(n int) {
	conn, err := dbus.SessionBus() // shared: not closed here
	if err != nil {
		return
	}
	// The desktop file the app was started from: the package's, or the
	// one an AppImage adds to the app menu (menuentry_linux.go).
	id := "io.github.snooper42.HomelabWizard.desktop"
	if os.Getenv("APPIMAGE") != "" {
		id = menuID + ".desktop"
	}
	_ = conn.Emit("/com/canonical/unity/launcherentry/homelabwizard", "com.canonical.Unity.LauncherEntry.Update",
		"application://"+id, map[string]dbus.Variant{"count": dbus.MakeVariant(int64(n)), "count-visible": dbus.MakeVariant(n > 0)})
}
