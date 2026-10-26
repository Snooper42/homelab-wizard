//go:build windows

package main

import (
	"context"
	"runtime"
	"syscall"

	"github.com/Snooper42/homelab-wizard/internal/battery"
)

// keepAwake asks Windows to keep the system (not the display) on while it
// is on power, until stopped; on battery the request is withdrawn, so a
// laptop sleeps as its settings say.
func keepAwake(ctx context.Context) error {
	const esContinuous, esSystemRequired = 0x80000000, 0x00000001
	// The request belongs to the thread that makes it, and onPower runs
	// on this one.
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	set := syscall.NewLazyDLL("kernel32.dll").NewProc("SetThreadExecutionState")
	if err := set.Find(); err != nil {
		return err
	}
	return onPower(ctx, battery.Power, func() (func(), <-chan error, error) {
		set.Call(uintptr(esContinuous | esSystemRequired))
		return func() { set.Call(uintptr(esContinuous)) }, nil, nil
	})
}
