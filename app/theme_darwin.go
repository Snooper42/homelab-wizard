package main

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa
#import <Cocoa/Cocoa.h>

// setAppAppearance gives the app light (1), dark (2), or the system's (0)
// appearance: the translucent sidebar and the window's controls follow it.
static void setAppAppearance(int mode) {
	dispatch_async(dispatch_get_main_queue(), ^{
		NSAppearance *a = nil;
		if (mode == 1) a = [NSAppearance appearanceNamed:NSAppearanceNameAqua];
		if (mode == 2) a = [NSAppearance appearanceNamed:NSAppearanceNameDarkAqua];
		[NSApp setAppearance:a];
	});
}
*/
import "C"

// setNativeTheme sets the Mac's own appearance for the window, which Wails
// leaves to the system: "light", "dark", or anything else for the system's.
func setNativeTheme(theme string) {
	mode := 0
	switch theme {
	case "light":
		mode = 1
	case "dark":
		mode = 2
	}
	C.setAppAppearance(C.int(mode))
}
