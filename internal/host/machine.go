package host

import (
	"bufio"
	"bytes"
	"strconv"
	"strings"
	"time"
)

// Memory is the machine's memory in bytes, 0 where it can't be told: the
// machine card's "Memory · 11 of 32 GB" (lane D, D5).
func Memory() uint64 { return memory() }

// Booted is when the machine last started, zero where it can't be told: the
// machine card's "Up 23 days".
func Booted() time.Time { return booted() }

// parseMeminfo reads MemTotal from Linux's /proc/meminfo, in bytes.
func parseMeminfo(data []byte) uint64 {
	s := bufio.NewScanner(bytes.NewReader(data))
	for s.Scan() {
		name, rest, ok := strings.Cut(s.Text(), ":")
		if !ok || name != "MemTotal" {
			continue
		}
		f := strings.Fields(rest)
		if len(f) == 0 {
			return 0
		}
		n, err := strconv.ParseUint(f[0], 10, 64)
		if err != nil {
			return 0
		}
		if len(f) > 1 && strings.EqualFold(f[1], "kB") {
			n *= 1024
		}
		return n
	}
	return 0
}

// parseBtime reads the boot time from Linux's /proc/stat (its btime line, in
// seconds since 1970).
func parseBtime(data []byte) time.Time {
	s := bufio.NewScanner(bytes.NewReader(data))
	for s.Scan() {
		if f := strings.Fields(s.Text()); len(f) == 2 && f[0] == "btime" {
			if n, err := strconv.ParseInt(f[1], 10, 64); err == nil && n > 0 {
				return time.Unix(n, 0)
			}
		}
	}
	return time.Time{}
}
