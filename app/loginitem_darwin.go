package main

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Foundation -framework ServiceManagement
#import <Foundation/Foundation.h>
#import <ServiceManagement/ServiceManagement.h>
#include <stdlib.h>

// The agent as this app's login item: SMAppService (macOS 13 and later)
// with the plist in Contents/Library/LaunchAgents. -1 where there is none.
static int loginItemStatus(void) {
	if (@available(macOS 13.0, *)) {
		return (int)[SMAppService agentServiceWithPlistName:@"com.homelab.agent.plist"].status;
	}
	return -1;
}

// loginItemChange registers (on 1) or unregisters (on 0) it; the error's
// words, or NULL.
static char *loginItemChange(int on) {
	if (@available(macOS 13.0, *)) {
		SMAppService *s = [SMAppService agentServiceWithPlistName:@"com.homelab.agent.plist"];
		NSError *err = nil;
		BOOL ok = on ? [s registerAndReturnError:&err] : [s unregisterAndReturnError:&err];
		if (ok) return NULL;
		return strdup(err ? err.localizedDescription.UTF8String : "failed");
	}
	return strdup("SMAppService needs macOS 13 or later");
}
*/
import "C"

import (
	"errors"
	"unsafe"
)

// SMAppService's states for the login item.
const (
	itemNone             = -1 // macOS 12 or earlier
	itemNotRegistered    = 0
	itemEnabled          = 1
	itemRequiresApproval = 2
	itemNotFound         = 3
)

func loginItemState() int { return int(C.loginItemStatus()) }

func loginItemSet(on bool) error {
	flag := 0
	if on {
		flag = 1
	}
	if msg := C.loginItemChange(C.int(flag)); msg != nil {
		defer C.free(unsafe.Pointer(msg))
		return errors.New(C.GoString(msg))
	}
	return nil
}
