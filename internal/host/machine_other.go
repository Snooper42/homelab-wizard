//go:build !linux && !darwin && !windows

package host

import "time"

func memory() uint64    { return 0 }
func booted() time.Time { return time.Time{} }
