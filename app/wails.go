package main

import "github.com/wailsapp/wails/v2/pkg/runtime"

// The Wails runtime's calls the App's methods make. Each needs the
// window's context, so tests replace them to run the methods without one.
var (
	emitEvent       = runtime.EventsEmit
	openURL         = runtime.BrowserOpenURL
	directoryDialog = runtime.OpenDirectoryDialog
	fileDialog      = runtime.OpenFileDialog
	saveDialog      = runtime.SaveFileDialog
	messageDialog   = runtime.MessageDialog
	clipboardSet    = runtime.ClipboardSetText
	clipboardGet    = runtime.ClipboardGetText
	quitApp         = runtime.Quit

	// The window's size and place (window.go).
	windowIsMinimised  = runtime.WindowIsMinimised
	windowIsFullscreen = runtime.WindowIsFullscreen
	windowIsMaximised  = runtime.WindowIsMaximised
	windowGetSize      = runtime.WindowGetSize
	windowGetPosition  = runtime.WindowGetPosition
	windowSetSize      = runtime.WindowSetSize
	windowSetPosition  = runtime.WindowSetPosition
	screenGetAll       = runtime.ScreenGetAll
)
