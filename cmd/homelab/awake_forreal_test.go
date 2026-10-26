//go:build forreal

package main

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/awake"
	"github.com/Snooper42/homelab-wizard/internal/ui"
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
		held = awake.Listed
		allowLinux(t)
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
		// Its program's own words: the job keeps none.
		name, args, _ := awakeCommand()
		again, stop := context.WithTimeout(context.Background(), 10*time.Second)
		defer stop()
		out, _ := exec.CommandContext(again, name, args...).CombinedOutput()
		if runtime.GOOS == "linux" {
			// Who refused: polkit's answer for this process, and whether
			// polkit runs at all (logind refuses without it).
			pk, err := exec.Command("pkcheck", "--action-id", "org.freedesktop.login1.inhibit-block-sleep", "--process", strconv.Itoa(os.Getpid())).CombinedOutput()
			out = append(out, fmt.Sprintf("pkcheck inhibit-block-sleep: %v %s\n", err, pk)...)
			active, _ := exec.Command("systemctl", "is-active", "polkit").CombinedOutput()
			out = append(out, fmt.Sprintf("polkit: %s", active)...)
		}
		t.Fatalf("the awake job ended at once: %v; %s %s says:\n%s", err, name, strings.Join(args, " "), out)
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

// allowLinux gives this account the permission the awake job needs on
// Linux, as Setup's step does (homelab awake allow --apply, through sudo
// on the runner), after seeing polkit refuse it without; the rule is taken
// back with --undo at the end, and must then be gone.
func allowLinux(t *testing.T) {
	t.Helper()
	pk := func() error {
		return exec.Command("pkcheck", "--action-id", "org.freedesktop.login1.inhibit-block-sleep", "--process", strconv.Itoa(os.Getpid())).Run()
	}
	h := &homelab{ui: &ui.UI{Out: io.Discard}}
	ctx := context.Background()
	// The rules folder is root's and polkit's alone (Ubuntu): read through sudo.
	rule := func() string {
		out, _ := exec.Command("sudo", "-n", "cat", awake.RulePath).CombinedOutput()
		return string(out)
	}
	if exec.Command("sudo", "-n", "test", "-e", awake.RulePath).Run() == nil || awake.Allowed() {
		t.Fatalf("a rule of homelab's is in place before the test: %s", awake.RulePath)
	}
	if pk() == nil {
		t.Log("polkit allows a sleep block here without the rule")
	}
	if err := h.awake(ctx, []string{"allow", "--apply"}); err != nil {
		t.Fatalf("homelab awake allow --apply: %v", err)
	}
	t.Cleanup(func() {
		if err := h.awake(context.Background(), []string{"allow", "--undo", "--apply"}); err != nil {
			t.Errorf("homelab awake allow --undo --apply: %v", err)
		}
		if exec.Command("sudo", "-n", "test", "-e", awake.RulePath).Run() == nil || awake.Allowed() {
			t.Errorf("the rule is still there after --undo: %s", awake.RulePath)
		}
	})
	if !awake.Allowed() || !strings.Contains(rule(), `subject.user == "`+awake.User()+`"`) {
		t.Fatalf("allowed, but %s does not name %s:\n%s", awake.RulePath, awake.User(), rule())
	}
	// polkit reads its rules again by itself, a moment after the write.
	for end := time.Now().Add(15 * time.Second); pk() != nil; time.Sleep(500 * time.Millisecond) {
		if time.Now().After(end) {
			out, _ := exec.Command("pkcheck", "--action-id", "org.freedesktop.login1.inhibit-block-sleep", "--process", strconv.Itoa(os.Getpid())).CombinedOutput()
			t.Fatalf("polkit still refuses a sleep block with the rule in place: %s", out)
		}
	}
}
