// Package sysmem reads how much memory this machine has, for the install
// plan's check that the apps fit beside the system and everyday apps.
package sysmem

import (
	"bufio"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
)

// Everyday is what the system and everyday apps (a browser, mail) keep for
// themselves, in MB: the rest is room for the homelab.
const Everyday = 4096

// TotalMB is this machine's memory in MB; 0 where it cannot be read
// (Windows, for now). Tests replace it.
var TotalMB = func() int {
	switch runtime.GOOS {
	case "darwin":
		out, err := exec.Command("sysctl", "-n", "hw.memsize").Output()
		if err != nil {
			return 0
		}
		n, _ := strconv.ParseInt(strings.TrimSpace(string(out)), 10, 64)
		return int(n >> 20)
	case "linux":
		f, err := os.Open("/proc/meminfo")
		if err != nil {
			return 0
		}
		defer f.Close()
		return ParseMeminfo(bufio.NewScanner(f))
	}
	return 0
}

// ParseMeminfo reads MemTotal (in kB) from /proc/meminfo, in MB.
func ParseMeminfo(s *bufio.Scanner) int {
	for s.Scan() {
		if f := strings.Fields(s.Text()); len(f) >= 2 && f[0] == "MemTotal:" {
			kb, _ := strconv.Atoi(f[1])
			return kb >> 10
		}
	}
	return 0
}

// Room is how much of total (MB) the homelab's apps can use beside the
// system and everyday apps; never less than 1 GB.
func Room(total int) int {
	return max(total-Everyday, 1024)
}
