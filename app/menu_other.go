//go:build !darwin

package main

import "github.com/wailsapp/wails/v2/pkg/menu"

// appMenu is nil off the Mac: Windows 11 and Linux desktop apps of this kind
// have no menu bar, and the sidebar and shortcuts do its work.
func appMenu(*App) *menu.Menu { return nil }
