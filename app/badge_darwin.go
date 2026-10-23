package main

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa
#import <Cocoa/Cocoa.h>
#include <stdlib.h>

static void setDockBadge(const char *label) {
	NSString *s = [NSString stringWithUTF8String:label];
	dispatch_async(dispatch_get_main_queue(), ^{
		[[NSApp dockTile] setBadgeLabel:(s.length ? s : nil)];
	});
}
*/
import "C"

import (
	"strconv"
	"unsafe"
)

// setBadge shows n on the app's Dock icon, as Mail shows unread mail; 0
// clears it.
func setBadge(n int) {
	label := ""
	if n > 0 {
		label = strconv.Itoa(n)
	}
	cs := C.CString(label)
	defer C.free(unsafe.Pointer(cs))
	C.setDockBadge(cs)
}
