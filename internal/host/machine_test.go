package host

import (
	"runtime"
	"testing"
	"time"
)

func TestParseMeminfo(t *testing.T) {
	data := []byte("MemFree:  1000 kB\nMemTotal:       32768000 kB\nMemAvailable: 5 kB\n")
	if got := parseMeminfo(data); got != 32768000*1024 {
		t.Errorf("%d", got)
	}
	for _, bad := range []string{"", "MemTotal:\n", "MemTotal: lots kB\n", "MemFree: 1 kB\n"} {
		if got := parseMeminfo([]byte(bad)); got != 0 {
			t.Errorf("%q: %d", bad, got)
		}
	}
	if got := parseMeminfo([]byte("MemTotal: 2048\n")); got != 2048 {
		t.Errorf("no unit: %d", got)
	}
}

func TestParseBtime(t *testing.T) {
	if got := parseBtime([]byte("cpu  1 2 3\nbtime 1764000000\nprocesses 5\n")); !got.Equal(time.Unix(1764000000, 0)) {
		t.Errorf("%v", got)
	}
	for _, bad := range []string{"", "btime\n", "btime x\n", "btime 0\n"} {
		if got := parseBtime([]byte(bad)); !got.IsZero() {
			t.Errorf("%q: %v", bad, got)
		}
	}
}

// On the systems CI runs (Linux, macOS, Windows), this machine's memory and boot time are told, and make sense.
func TestThisMachine(t *testing.T) {
	switch runtime.GOOS {
	case "linux", "darwin", "windows":
	default:
		t.Skip("not told here")
	}
	if m := Memory(); m < 256<<20 {
		t.Errorf("memory: %d", m)
	}
	if b := Booted(); b.IsZero() || b.After(time.Now()) || time.Since(b) > 10*365*24*time.Hour {
		t.Errorf("booted: %v", b)
	}
}
