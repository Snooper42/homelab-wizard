package dock

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

import "unsafe"

// SetBadge shows label on the app's Dock icon, as Mail shows unread mail;
// "" clears it. The app's run loop draws it.
func SetBadge(label string) {
	cs := C.CString(label)
	defer C.free(unsafe.Pointer(cs))
	C.setDockBadge(cs)
}
