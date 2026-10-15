package main

import (
	"fmt"
	"strings"
)

// menuID names the app menu entry an AppImage adds for itself. It differs
// from the packages' entry, so the two never replace each other.
const menuID = "io.github.snooper42.HomelabWizard.AppImage"

// MenuEntry is whether this copy of the app can add itself to the system's
// app menu (an AppImage on Linux, which nothing installs), and whether it has.
type MenuEntry struct {
	Available bool `json:"available"`
	Added     bool `json:"added"`
}

// MenuEntry reports whether the app is in the app menu.
func (a *App) MenuEntry() MenuEntry { return menuEntryState() }

// SetMenuEntry adds the AppImage to the app menu, or takes it out.
func (a *App) SetMenuEntry(on bool) error {
	if on {
		return addMenuEntry()
	}
	return removeMenuEntry()
}

// menuEntry is the app menu entry that starts the AppImage at img. In
// SteamOS's desktop mode, its menu item also has Add to Steam, for Game Mode.
func menuEntry(img string) []byte {
	return []byte(fmt.Sprintf(`[Desktop Entry]
Type=Application
Name=Homelab Wizard
Comment=Choose, install, and watch your homelab apps
Exec=%s
TryExec=%s
Icon=homelab-wizard
Categories=System;Utility;
Terminal=false
StartupWMClass=homelab-wizard
`, desktopQuote(img), desktopString(img)))
}

// desktopString escapes a plain string value of a desktop entry.
func desktopString(s string) string {
	return strings.NewReplacer(`\`, `\\`, "\n", `\n`, "\t", `\t`, "\r", `\r`).Replace(s)
}

// execPath is the program an entry's Exec line starts, unquoted, or "".
func execPath(entry []byte) string {
	for _, line := range strings.Split(string(entry), "\n") {
		v, ok := strings.CutPrefix(line, "Exec=")
		if !ok {
			continue
		}
		if !strings.HasPrefix(v, `"`) {
			path, _, _ := strings.Cut(v, " ")
			return path
		}
		var b strings.Builder
		for i := 1; i < len(v); i++ {
			switch c := v[i]; {
			case c == '\\' && i+1 < len(v):
				i++
				b.WriteByte(v[i])
			case c == '"':
				return b.String()
			default:
				b.WriteByte(c)
			}
		}
		return ""
	}
	return ""
}
