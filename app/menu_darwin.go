package main

import (
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// docsURL is where Help's pages live.
const docsURL = "https://github.com/Snooper42/homelab-wizard/blob/main/docs/"

// appMenu is the Mac menu bar: the standard app, Edit, and Window menus, a
// View menu with the screens (⌘1 to ⌘4, then Finances on ⌘6, the numbers the
// window's own shortcuts use), Settings (⌘,), Hide Amounts (⌘⇧H), the Command Palette (⌘K), and Reload (⌘R), and Help. Wails' app menu has no place for Settings…, so it sits in View
// with the shortcut Mac apps use.
func appMenu(a *App) *menu.Menu {
	m := menu.NewMenu()
	m.Append(menu.AppMenu())
	m.Append(menu.EditMenu())

	view := m.AddSubmenu("View")
	go2 := func(screen string) menu.Callback {
		return func(*menu.CallbackData) { runtime.EventsEmit(a.ctx, "navigate", screen) }
	}
	// The strip's three first, as the sidebar has them (the owner, Nov 27), then Backups and Find an App; Setup is in
	// Settings now, with no number of its own.
	view.AddText("Home", keys.CmdOrCtrl("1"), go2("status"))
	view.AddText("Library", keys.CmdOrCtrl("2"), go2("tidy"))
	view.AddText("Finances", keys.CmdOrCtrl("3"), go2("finances"))
	view.AddText("Backups", keys.CmdOrCtrl("4"), go2("backups"))
	view.AddText("Find an App", keys.CmdOrCtrl("5"), go2("choose"))
	view.AddText("Setup", nil, go2("setup"))
	view.AddText("Settings…", keys.CmdOrCtrl(","), go2("settings"))
	view.AddSeparator()
	// Every money figure as $•••, or back: the page toggles it (⌘⇧H).
	view.AddText("Hide Amounts", keys.Combo("h", keys.CmdOrCtrlKey, keys.ShiftKey), func(*menu.CallbackData) { runtime.EventsEmit(a.ctx, "hideAmounts") })
	// Type an app or a command (palette/Palette.tsx): the page opens it.
	view.AddText("Command Palette…", keys.CmdOrCtrl("k"), func(*menu.CallbackData) { runtime.EventsEmit(a.ctx, "palette") })
	view.AddText("Reload", keys.CmdOrCtrl("r"), func(*menu.CallbackData) { runtime.EventsEmit(a.ctx, "refresh") })

	m.Append(menu.WindowMenu())

	help := m.AddSubmenu("Help")
	open := func(page string) menu.Callback {
		return func(*menu.CallbackData) { runtime.BrowserOpenURL(a.ctx, docsURL+page) }
	}
	help.AddText("Getting Started", nil, open("Getting%20Started.md"))
	help.AddText("Troubleshooting", nil, open("Troubleshooting.md"))
	help.AddText("Known Issues", nil, open("Known%20Issues.md"))
	return m
}
