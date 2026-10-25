package main

import (
	"github.com/Snooper42/homelab-wizard/app/tray"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Appearance is how the app looks on this machine (Settings › Appearance).
func (a *App) Appearance() tray.Appearance { return tray.LoadAppearance() }

// SetAppearance keeps a new appearance and returns it as kept. The page
// draws itself from it, the window's own parts follow the theme
// (windowTheme), and the menu bar item its icon colour.
func (a *App) SetAppearance(look tray.Appearance) (tray.Appearance, error) {
	kept, err := tray.SaveAppearance(look)
	if err == nil {
		a.windowTheme(kept)
	}
	return kept, err
}

// windowTheme sets the window's own parts to the theme picked: the title
// bar on Windows, the translucent sidebar on the Mac.
func (a *App) windowTheme(look tray.Appearance) {
	setNativeTheme(look.Theme)
	switch look.Theme {
	case "light":
		runtime.WindowSetLightTheme(a.ctx)
	case "dark":
		runtime.WindowSetDarkTheme(a.ctx)
	default:
		runtime.WindowSetSystemDefaultTheme(a.ctx)
	}
}
