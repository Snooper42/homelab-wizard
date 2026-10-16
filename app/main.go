// Command homelab-wizard is the desktop app for the homelab: pick stacks,
// watch them install, and see their status. It drives the same engine as
// the homelab CLI (internal/api, internal/install).
package main

import (
	_ "embed"
	"log"

	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/web"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

// icon is the app's icon, for the Mac's About panel.
//
//go:embed build/appicon.png
var icon []byte

func main() {
	core.FixPath()
	if runTrayIfAsked() {
		return
	}
	app := &App{}
	err := wails.Run(&options.App{
		Title:         "Homelab Wizard",
		Width:         1180,
		Height:        780,
		MinWidth:      860,
		MinHeight:     560,
		AssetServer:   &assetserver.Options{Assets: web.Files()},
		OnStartup:     app.startup,
		OnBeforeClose: app.beforeClose,
		OnShutdown:    app.shutdown,
		Bind:          []interface{}{app},
		Menu:          appMenu(app),
		// The Mac: the window buttons inside the sidebar, which shows the
		// desktop through it (style.css, html.os-mac), as in Finder and Mail.
		Mac: &mac.Options{
			TitleBar:             mac.TitleBarHiddenInset(),
			WebviewIsTransparent: true,
			WindowIsTranslucent:  true,
			About:                &mac.AboutInfo{Title: "Homelab Wizard", Message: "Version " + version + "\nYour apps, at home.", Icon: icon},
		},
		// Windows 11: the navigation pane on Mica, as in Settings and File
		// Explorer (style.css, html.os-windows.backdrop), where Windows draws it.
		Windows: &windows.Options{
			WebviewIsTransparent: micaSupported(),
			WindowIsTranslucent:  micaSupported(),
			BackdropType:         windows.Mica,
			Theme:                windows.SystemDefault,
		},
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId:               "com.snooper42.homelab-wizard",
			OnSecondInstanceLaunch: app.onSecondInstance,
		},
	})
	if err != nil {
		log.Fatal(err)
	}
}
