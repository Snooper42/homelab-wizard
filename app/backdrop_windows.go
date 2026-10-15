package main

import "golang.org/x/sys/windows"

// micaSupported reports whether Windows draws the Mica backdrop: Windows 11
// 22H2 (build 22621) or later. Older Windows keeps an opaque window.
func micaSupported() bool { return windows.RtlGetVersion().BuildNumber >= 22621 }
