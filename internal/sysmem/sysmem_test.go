package sysmem

import (
	"bufio"
	"errors"
	"os"
	"path/filepath"
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

// Each system's way, on every runner.
func TestTotalMBEachWay(t *testing.T) {
	total := TotalMB
	oldGOOS, oldSysctl, oldMeminfo := goos, sysctl, meminfo
	t.Cleanup(func() { goos, sysctl, meminfo = oldGOOS, oldSysctl, oldMeminfo })

	goos = "darwin"
	sysctl = func() ([]byte, error) { return []byte("17179869184\n"), nil }
	if got := total(); got != 16384 {
		t.Errorf("a 16 GB Mac: %d MB", got)
	}
	sysctl = func() ([]byte, error) { return nil, errors.New("not found") }
	if got := total(); got != 0 {
		t.Errorf("no sysctl: %d MB", got)
	}

	goos = "linux"
	meminfo = filepath.Join(t.TempDir(), "meminfo")
	if got := total(); got != 0 {
		t.Errorf("no meminfo: %d MB", got)
	}
	os.WriteFile(meminfo, []byte("MemTotal:        8040832 kB\nMemFree:  1 kB\n"), 0o644)
	if got := total(); got != 7852 {
		t.Errorf("an 8 GB Steam Deck: %d MB", got)
	}

	goos = "plan9"
	if got := total(); got != 0 {
		t.Errorf("an unknown system: %d MB", got)
	}
	goos = "windows"
	if got := total(); runtime.GOOS != "windows" && got != 0 || runtime.GOOS == "windows" && got < 512 {
		t.Errorf("Windows: %d MB", got)
	}
}
