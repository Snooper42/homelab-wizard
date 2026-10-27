//go:build forreal && windows

package tray

import (
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"golang.org/x/sys/windows/registry"
)

// The tray item started for real on Windows: its icon is added to the
// notification area, seen in Windows' own record of the icons programs
// added there (Control Panel\NotifyIconSettings, one key per icon with the
// program's path and its tooltip, which Settings › Personalization ›
// Taskbar lists). CI runs it on the Windows runner (go test -tags forreal).
func TestTrayRegistersForReal(t *testing.T) {
	// Built before HOME moves: Go's module cache under a test's HOME is
	// read-only, so its folder could not be removed afterwards.
	bin := filepath.Join(t.TempDir(), "homelab-tray.exe")
	if out, err := exec.Command("go", "build", "-o", bin, "../cmd/homelab-tray").CombinedOutput(); err != nil {
		t.Fatalf("go build: %v\n%s", err, out)
	}
	homelab(t) // the profile folders, with a homelab folder the tray finds

	tray := exec.Command(bin)
	var log strings.Builder
	tray.Stdout, tray.Stderr = &log, &log
	if err := tray.Start(); err != nil {
		t.Fatal(err)
	}
	exited := make(chan error, 1)
	go func() { exited <- tray.Wait() }()
	t.Cleanup(func() { _ = tray.Process.Kill() })

	var seen []string
	for end := time.Now().Add(30 * time.Second); ; time.Sleep(time.Second) {
		select {
		case err := <-exited:
			t.Fatalf("the tray exited: %v\n%s", err, log.String())
		default:
		}
		found, tip, all, err := notifyIcon(bin)
		if err != nil && err != registry.ErrNotExist {
			t.Fatalf("reading NotifyIconSettings: %v", err)
		}
		if found {
			t.Logf("its icon is listed, tooltip %q", tip)
			break
		}
		seen = all
		if time.Now().After(end) {
			t.Fatalf("no notification area icon for %s after 30 seconds; Windows lists: %q\n%s", bin, seen, log.String())
		}
	}
}

// notifyIcon reads Windows' record of notification area icons: whether exe
// added one, its tooltip, and every program listed. A path under a known
// folder is kept with the folder's GUID in place of its start, so the
// program is matched by its file name.
func notifyIcon(exe string) (found bool, tip string, all []string, err error) {
	k, err := registry.OpenKey(registry.CURRENT_USER, `Control Panel\NotifyIconSettings`, registry.READ)
	if err != nil {
		return false, "", nil, err
	}
	defer k.Close()
	names, err := k.ReadSubKeyNames(-1)
	if err != nil {
		return false, "", nil, err
	}
	for _, n := range names {
		icon, err := registry.OpenKey(k, n, registry.READ)
		if err != nil {
			continue
		}
		path, _, _ := icon.GetStringValue("ExecutablePath")
		t, _, _ := icon.GetStringValue("InitialTooltip")
		icon.Close()
		all = append(all, path)
		if strings.EqualFold(filepath.Base(path), filepath.Base(exe)) {
			found, tip = true, t
		}
	}
	return found, tip, all, nil
}
