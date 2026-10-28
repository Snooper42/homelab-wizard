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

	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/host"
)

// The menu bar item started for real on macOS, as the app bundle's helper
// runs: it puts its item in the menu bar, and its menu is opened and read
// through System Events (the Accessibility API, as VoiceOver reads it),
// then it is asked to quit as homelab quit asks it (clicking Quit
// Homelab Wizard… opens the app, which asks first). CI runs it on the
// macOS runner (go test -tags forreal).
func TestTrayRegistersForReal(t *testing.T) {
	// Built before HOME moves: Go's module cache under a test's HOME is
	// read-only, so its folder could not be removed afterwards.
	bin := filepath.Join(t.TempDir(), "homelab-tray")
	if out, err := exec.Command("go", "build", "-o", bin, "../cmd/homelab-tray").CombinedOutput(); err != nil {
		t.Fatalf("go build: %v\n%s", err, out)
	}
	root := homelab(t) // HOME, with a homelab folder the tray finds
	// Its .env, with the homelab keeping this machine awake (the default).
	if err := os.WriteFile(filepath.Join(root, ".env"), []byte("KEEP_AWAKE=true\n"), 0o600); err != nil {
		t.Fatal(err)
	}

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
	awake := host.Current().KeepAwakeItem()
	for _, want := range []string{"Open Homelab Wizard", "Back up now", "Update apps now", "Pause nightly updates", awake, "Quit Homelab Wizard…"} {
		if !slices.Contains(labels, want) {
			t.Errorf("the menu has no %q: %q", want, labels)
		}
	}

	// Keep this Mac awake, ticked, then clicked as a person clicks it:
	// KEEP_AWAKE turns off.
	item := fmt.Sprintf(`menu item %q of menu 1 of menu bar item 1 of last menu bar`, awake)
	ticked := fmt.Sprintf(`tell application "System Events" to tell (first process whose unix id is %d)
	click menu bar item 1 of last menu bar
	delay 0.5
	set mark to value of attribute "AXMenuItemMarkChar" of %s
	key code 53
	return mark
end tell`, pid, item)
	if out, err := exec.Command("osascript", "-e", ticked).CombinedOutput(); err != nil || strings.TrimSpace(string(out)) != "✓" {
		t.Errorf("%s is not ticked: %v %q", awake, err, strings.TrimSpace(string(out)))
	}
	click := fmt.Sprintf(`tell application "System Events" to tell (first process whose unix id is %d)
	click menu bar item 1 of last menu bar
	delay 0.5
	click %s
end tell`, pid, item)
	if out, err := exec.Command("osascript", "-e", click).CombinedOutput(); err != nil {
		t.Fatalf("clicking %s: %v %s", awake, err, out)
	}
	keepAwakeWritten(t, root, "false")

	// Quit, as homelab quit asks it.
	if !core.QuitTray() {
		t.Fatal("the menu bar item did not answer at its address")
	}
	select {
	case <-exited:
	case <-time.After(10 * time.Second):
		t.Fatal("asked to quit, the menu bar item did not end")
	}
	_ = os.Remove(bin)
}
