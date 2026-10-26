//go:build forreal

package main

import (
	"context"
	"os/exec"
	"runtime"
	"strings"
	"testing"
	"time"
)

// The awake job's hold on sleep, on the machine this runs on: keepAwake
// started as the job starts it (a runner is on mains power), the hold
// seen in the system's own list of what keeps it awake (pmset -g
// assertions on macOS, powercfg /requests on Windows, systemd-inhibit
// --list on Linux), then gone once the job stops. CI runs it on each
// system's runner (go test -tags forreal), where the runner is an
// administrator, as powercfg /requests needs.
func TestKeepAwakeForReal(t *testing.T) {
	var list []string
	var held func(out string) bool
	switch runtime.GOOS {
	case "darwin":
		list = []string{"pmset", "-g", "assertions"}
		held = func(out string) bool {
			for _, line := range strings.Split(out, "\n") {
				if strings.Contains(line, "(caffeinate)") && strings.Contains(line, "PreventSystemSleep") {
					return true
				}
			}
			return false
		}
	case "windows":
		list = []string{"powercfg", "/requests"}
		// The SYSTEM section names this test's program while it holds.
		held = func(out string) bool {
			_, system, _ := strings.Cut(out, "SYSTEM:")
			system, _, _ = strings.Cut(system, "AWAYMODE:")
			return strings.Contains(strings.ToLower(system), ".test.exe")
		}
	case "linux":
		list = []string{"systemd-inhibit", "--list", "--no-pager"}
		held = func(out string) bool {
			for _, line := range strings.Split(out, "\n") {
				if strings.Contains(line, "homelab") && strings.Contains(line, "sleep") && strings.Contains(line, "block") {
					return true
				}
			}
			return false
		}
	default:
		t.Fatalf("nothing keeps %s awake", runtime.GOOS)
	}
	read := func() string {
		t.Helper()
		out, err := exec.Command(list[0], list[1:]...).CombinedOutput()
		if err != nil {
			t.Fatalf("%s: %v\n%s", strings.Join(list, " "), err, out)
		}
		return string(out)
	}
	wait := func(want bool, what string) {
		t.Helper()
		out := ""
		for end := time.Now().Add(30 * time.Second); ; time.Sleep(500 * time.Millisecond) {
			if out = read(); held(out) == want {
				return
			}
			if time.Now().After(end) {
				t.Fatalf("%s within 30 seconds; %s says:\n%s", what, strings.Join(list, " "), out)
			}
		}
	}
	if held(read()) {
		t.Fatal("something of homelab's holds sleep off before the test")
	}

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- keepAwake(ctx) }()
	t.Cleanup(cancel)
	select {
	case err := <-done:
		t.Fatalf("the awake job ended at once: %v", err)
	case <-time.After(time.Second):
	}
	wait(true, "no hold on sleep")
	t.Logf("held:\n%s", read())

	cancel()
	select {
	case <-done:
	case <-time.After(30 * time.Second):
		t.Fatal("the awake job did not stop within 30 seconds")
	}
	wait(false, "the hold on sleep is still there after the job stopped")
}
