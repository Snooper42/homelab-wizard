//go:build !darwin && !linux && !windows

package diskspace

import "errors"

func usage(string) (uint64, uint64, error) { return 0, 0, errors.New("not supported on this system") }

func volumeID(path string) string { return path }
