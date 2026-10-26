package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/options"
)

// The window opens where it was left: its size, its place on the screen,
// and whether it filled the screen, as apps do on the Mac, Windows, and
// Linux. Kept beside update.json in the user's settings folder.

// windowState is the window as it was when the app last quit.
type windowState struct {
	X         int  `json:"x"`
	Y         int  `json:"y"`
	Width     int  `json:"width"`
	Height    int  `json:"height"`
	Maximised bool `json:"maximised"`
}

// The window's first size, and the smallest it may be.
const (
	defaultWidth, defaultHeight = 1180, 780
	minWidth, minHeight         = 860, 560
)

func windowStatePath() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	return filepath.Join(dir, "Homelab Wizard", "window.json")
}

func loadWindowState() windowState {
	var s windowState
	if data, err := os.ReadFile(windowStatePath()); err == nil {
		_ = json.Unmarshal(data, &s)
	}
	return s
}

func (s windowState) save() {
	path := windowStatePath()
	if path == "" || os.MkdirAll(filepath.Dir(path), 0o755) != nil {
		return
	}
	data, _ := json.MarshalIndent(s, "", "  ")
	_ = os.WriteFile(path, data, 0o644)
}

// size is the size to open at: the one left, kept within the smallest the
// window allows and the screen it opens on; else the first size.
func (s windowState) size(screenW, screenH int) (int, int) {
	w, h := s.Width, s.Height
	if w < minWidth || h < minHeight {
		return defaultWidth, defaultHeight
	}
	if screenW > 0 && w > screenW {
		w = max(screenW, minWidth)
	}
	if screenH > 0 && h > screenH {
		h = max(screenH, minHeight)
	}
	return w, h
}

// placed reports whether the place left still puts the window on the
// screen it opens on (a display unplugged since would leave it out of
// reach). 0,0 is where Linux under Wayland reports every window, so it
// does not count as a place.
func (s windowState) placed(w, h, screenW, screenH int) bool {
	if s.X == 0 && s.Y == 0 || screenW <= 0 || screenH <= 0 {
		return false
	}
	return s.X >= 0 && s.Y >= 0 && s.X+w/2 <= screenW && s.Y+40 <= screenH
}

// windowOptions sets the window's first size and state from the last run.
func windowOptions(o *options.App) {
	s := loadWindowState()
	o.Width, o.Height = s.size(0, 0)
	o.MinWidth, o.MinHeight = minWidth, minHeight
	if s.Maximised {
		o.WindowStartState = options.Maximised
	}
}

// restoreWindow puts the window back in its place, once the screen it
// opens on is known.
func (a *App) restoreWindow(ctx context.Context) {
	s := loadWindowState()
	if s.Maximised {
		return
	}
	screenW, screenH := currentScreen(ctx)
	w, h := s.size(screenW, screenH)
	if w != s.Width || h != s.Height {
		windowSetSize(ctx, w, h)
	}
	if s.placed(w, h, screenW, screenH) {
		windowSetPosition(ctx, s.X, s.Y)
	}
}

// rememberWindow keeps the window's size and place for the next run. A
// window that fills the screen keeps the size it had before, for when it
// is made smaller again; a minimised or full-screen one (the Mac's green
// button) is not noted.
func (a *App) rememberWindow(ctx context.Context) {
	if windowIsMinimised(ctx) || windowIsFullscreen(ctx) {
		return
	}
	s := loadWindowState()
	s.Maximised = windowIsMaximised(ctx)
	if !s.Maximised {
		s.Width, s.Height = windowGetSize(ctx)
		s.X, s.Y = windowGetPosition(ctx)
	}
	s.save()
}

// currentScreen is the size of the screen the window is on, or 0, 0.
func currentScreen(ctx context.Context) (int, int) {
	screens, err := screenGetAll(ctx)
	if err != nil {
		return 0, 0
	}
	for _, sc := range screens {
		if sc.IsCurrent {
			return sc.Size.Width, sc.Size.Height
		}
	}
	return 0, 0
}
