//go:build forreal && darwin

package tray

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"
)

// The menu bar item started for real on macOS, as the app bundle's helper
// runs: it puts its item in the menu bar, and its menu is opened and read
// through System Events (the Accessibility API, as VoiceOver reads it),
// then Quit is clicked. CI runs it on the macOS runner (go test -tags
// forreal).
func TestTrayRegistersForReal(t *testing.T) {
	// Built before HOME moves: Go's module cache under a test's HOME is
	// read-only, so its folder could not be removed afterwards.
	bin := filepath.Join(t.TempDir(), "homelab-tray")
	if out, err := exec.Command("go", "build", "-o", bin, "../cmd/homelab-tray").CombinedOutput(); err != nil {
		t.Fatalf("go build: %v\n%s", err, out)
	}
	homelab(t) // HOME, with a homelab folder the tray finds

	tray := exec.Command(bin)
	var log strings.Builder
	tray.Stdout, tray.Stderr = &log, &log
	if err := tray.Start(); err != nil {
		t.Fatal(err)
	}
	exited := make(chan error, 1)
	go func() { exited <- tray.Wait() }()
	t.Cleanup(func() { _ = tray.Process.Kill() })

	// The process's last menu bar holds its menu bar extra (the only one,
	// as the helper keeps out of the Dock and has no app menus): the
	// item's menu, opened as a click opens it, then read, then closed with
	// Escape.
	pid := tray.Process.Pid
	read := fmt.Sprintf(`tell application "System Events"
	set p to first process whose unix id is %d
	tell p
		click menu bar item 1 of last menu bar
		delay 0.5
		set names to name of every menu item of menu 1 of menu bar item 1 of last menu bar
		key code 53
	end tell
end tell
set AppleScript's text item delimiters to linefeed
return names as text`, pid)

	var labels []string
	var last string
	for end := time.Now().Add(30 * time.Second); ; time.Sleep(time.Second) {
		select {
		case err := <-exited:
			t.Fatalf("the menu bar item exited: %v\n%s", err, log.String())
		default:
		}
		out, err := exec.Command("osascript", "-e", read).CombinedOutput()
		last = strings.TrimSpace(string(out))
		if err == nil {
			labels = strings.Split(last, "\n")
			if !slices.Contains(labels, "Checking…") {
				break
			}
		}
		if time.Now().After(end) {
			tree, _ := exec.Command("osascript", "-e", fmt.Sprintf(`tell application "System Events" to tell (first process whose unix id is %d) to return {count of menu bars, entire contents}`, pid)).CombinedOutput()
			t.Fatalf("its menu was not read in 30 seconds: %v %s\nwhat System Events sees: %s\n%s", err, last, tree, log.String())
		}
	}
	// The runner has no Docker, so the summary says so and there are no
	// apps to open (no "Open an app"); the rest is the same as anywhere.
	if len(labels) == 0 || !strings.Contains(labels[0], "docker") {
		t.Errorf("the summary line does not say Docker is missing: %q", labels)
	}
	for _, want := range []string{"Open Homelab Wizard", "Back up now", "Update apps now", "Pause nightly updates", "Quit"} {
		if !slices.Contains(labels, want) {
			t.Errorf("the menu has no %q: %q", want, labels)
		}
	}

	// Quit, clicked as a person clicks it.
	quit := fmt.Sprintf(`tell application "System Events" to tell (first process whose unix id is %d)
	click menu bar item 1 of last menu bar
	delay 0.5
	click menu item "Quit" of menu 1 of menu bar item 1 of last menu bar
end tell`, pid)
	if out, err := exec.Command("osascript", "-e", quit).CombinedOutput(); err != nil {
		t.Fatalf("clicking Quit: %v %s", err, out)
	}
	select {
	case <-exited:
	case <-time.After(10 * time.Second):
		t.Fatal("Quit did not end the menu bar item")
	}
	_ = os.Remove(bin)
}
