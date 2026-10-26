package sysmem

import (
	"bufio"
	"runtime"
	"strings"
	"testing"
)

func TestParseMeminfo(t *testing.T) {
	in := "MemFree:  1000 kB\nMemTotal:       16326412 kB\n"
	if got := ParseMeminfo(bufio.NewScanner(strings.NewReader(in))); got != 15943 {
		t.Errorf("got %d", got)
	}
}

func TestRoom(t *testing.T) {
	for total, want := range map[int]int{8192: 4096, 16384: 12288, 4096: 1024} {
		if got := Room(total); got != want {
			t.Errorf("Room(%d) = %d, want %d", total, got, want)
		}
	}
}

// Every runner (Linux, macOS, Windows) reads its own memory.
func TestTotalMBOnThisSystem(t *testing.T) {
	if mb := TotalMB(); mb < 512 {
		t.Errorf("%s: %d MB", runtime.GOOS, mb)
	}
}
