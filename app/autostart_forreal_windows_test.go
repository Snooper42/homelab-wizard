//go:build forreal

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"
)

// The tray started at sign-in, turned on as Settings does: its Run value
// is written, read back with reg, and its command line run as Windows
// runs it at sign-in (a stand-in that leaves a file). Turned off, the
// value is gone.
func TestTrayAtLoginForReal(t *testing.T) {
	if trayAtLogin() {
		t.Fatal("the tray already starts at sign-in before the test")
	}
	t.Cleanup(func() { _ = disableTrayAtLogin() })
	dir := t.TempDir()
	if strings.ContainsRune(dir, ' ') {
		t.Fatalf("the test's folder has a space: %s", dir)
	}
	marker := filepath.Join(dir, "started")
	cmd := filepath.Join(os.Getenv("SystemRoot"), "System32", "cmd.exe")
	if err := enableTrayAtLogin(cmd, []string{"/c", "echo.>" + marker}); err != nil {
		t.Fatal(err)
	}
	if !trayAtLogin() {
		t.Fatal("turned on, but trayAtLogin says off")
	}
	out, err := exec.Command("reg", "query", `HKCU\`+runKeyPath, "/v", autostartID).CombinedOutput()
	if err != nil {
		t.Fatalf("reg query: %v\n%s", err, out)
	}
	// The value's text after its type, as Windows runs it.
	_, value, ok := strings.Cut(string(out), "REG_SZ")
	value = strings.TrimSpace(value)
	if !ok || !strings.HasPrefix(value, `"`+cmd+`"`) {
		t.Fatalf("the Run value is not the command written:\n%s", out)
	}
	run := &exec.Cmd{Path: cmd, SysProcAttr: &syscall.SysProcAttr{CmdLine: value}}
	if out, err := run.CombinedOutput(); err != nil {
		t.Fatalf("the Run value's command: %v\n%s", err, out)
	}
	for end := time.Now().Add(30 * time.Second); ; time.Sleep(500 * time.Millisecond) {
		if _, err := os.Stat(marker); err == nil {
			break
		}
		if time.Now().After(end) {
			t.Fatalf("the Run value's command left no %s", marker)
		}
	}

	if err := disableTrayAtLogin(); err != nil {
		t.Fatal(err)
	}
	if trayAtLogin() {
		t.Fatal("turned off, but trayAtLogin says on")
	}
	if exec.Command("reg", "query", `HKCU\`+runKeyPath, "/v", autostartID).Run() == nil {
		t.Fatal("turned off, but the Run value is still there")
	}
}
