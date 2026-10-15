package main

import (
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// docsURL is where Help's pages live.
const docsURL = "https://github.com/Snooper42/homelab-wizard/blob/main/docs/"

// appMenu is the Mac menu bar: the standard app, Edit, and Window menus, a
// View menu with the screens (⌘1 to ⌘5), Settings (⌘,), and Reload (⌘R),
// and Help. Wails' app menu has no place for Settings…, so it sits in View
// with the shortcut Mac apps use.
func appMenu(a *App) *menu.Menu {
	m := menu.NewMenu()
	m.Append(menu.AppMenu())
	m.Append(menu.EditMenu())

	view := m.AddSubmenu("View")
	go2 := func(screen string) menu.Callback {
		return func(*menu.CallbackData) { runtime.EventsEmit(a.ctx, "navigate", screen) }
	}
	view.AddText("Choose Stacks", keys.CmdOrCtrl("1"), go2("choose"))
	view.AddText("Status", keys.CmdOrCtrl("2"), go2("status"))
	view.AddText("Backups", keys.CmdOrCtrl("3"), go2("backups"))
	view.AddText("Setup", keys.CmdOrCtrl("4"), go2("setup"))
	view.AddText("Settings…", keys.CmdOrCtrl(","), go2("settings"))
	view.AddSeparator()
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
