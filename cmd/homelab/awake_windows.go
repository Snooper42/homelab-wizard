//go:build windows

package main

import (
	"context"
	"runtime"
	"syscall"
	"time"
)

// keepAwake asks Windows to keep the system (not the display) on, and
// renews the request until stopped.
func keepAwake(ctx context.Context) error {
	const esContinuous, esSystemRequired = 0x80000000, 0x00000001
	// The request belongs to the thread that makes it.
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	set := syscall.NewLazyDLL("kernel32.dll").NewProc("SetThreadExecutionState")
	if err := set.Find(); err != nil {
		return err
	}
	set.Call(uintptr(esContinuous | esSystemRequired))
	defer set.Call(uintptr(esContinuous))
	t := time.NewTicker(time.Minute)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-t.C:
			set.Call(uintptr(esContinuous | esSystemRequired))
		}
	}
}
