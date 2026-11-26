package host

import (
	"os"
	"time"
)

func memory() uint64 {
	data, _ := os.ReadFile("/proc/meminfo")
	return parseMeminfo(data)
}

func booted() time.Time {
	data, _ := os.ReadFile("/proc/stat")
	return parseBtime(data)
}
