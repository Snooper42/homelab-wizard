//go:build !windows

package sysmem

// windowsTotal is Windows-only; TotalMB reads the others' own way.
func windowsTotal() uint64 { return 0 }
