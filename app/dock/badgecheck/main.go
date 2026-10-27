//go:build darwin

// Command badgecheck is a Mac app of its own for dock's test: it shows in
// the Dock, puts each line it reads on its Dock icon with dock.SetBadge
// (an empty line clears it), and runs until it is ended.
package main

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa
#import <Cocoa/Cocoa.h>

static void start(void) {
	[NSApplication sharedApplication];
	[NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];
	[NSApp finishLaunching];
}

static void run(void) { [NSApp run]; }
*/
import "C"

import (
	"bufio"
	"os"
	"runtime"

	"github.com/Snooper42/homelab-wizard/app/dock"
)

func init() { runtime.LockOSThread() } // Cocoa's run loop is the main thread's

func main() {
	C.start()
	go func() {
		lines := bufio.NewScanner(os.Stdin)
		for lines.Scan() {
			dock.SetBadge(lines.Text())
		}
	}()
	C.run()
}
