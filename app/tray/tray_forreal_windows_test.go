//go:build forreal && windows

package tray

import (
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"
	"unsafe"

	"github.com/Snooper42/homelab-wizard/internal/core"
	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

// The tray item started for real on Windows: its icon is added to the
// notification area, seen in Windows' own record of the icons programs
// added there (Control Panel\NotifyIconSettings, one key per icon with the
// program's path and its tooltip, which Settings › Personalization ›
// Taskbar lists). Then its menu is opened as the taskbar opens it on a
// right click (the icon's message to the item's window), read from the
// menu Windows shows, and it is asked to quit as homelab quit asks it
// (choosing Quit Homelab Wizard… opens the app, which asks first). CI runs
// it on the Windows runner (go test -tags forreal).
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

	hwnd := trayWindow(uint32(tray.Process.Pid))
	if hwnd == 0 {
		t.Fatalf("no SystrayClass window for the tray's process\n%s", log.String())
	}
	var labels []string
	for end := time.Now().Add(30 * time.Second); ; time.Sleep(time.Second) {
		labels, _ = openMenu(hwnd)
		if len(labels) > 0 && !slices.Contains(labels, "Checking…") {
			break
		}
		if time.Now().After(end) {
			t.Fatalf("its menu was not read in 30 seconds: %q\n%s", labels, log.String())
		}
	}
	t.Logf("its menu: %q", labels)
	for _, want := range []string{"Open Homelab Wizard", "Back up now", "Update apps now", "Quit Homelab Wizard…"} {
		if !slices.Contains(labels, want) {
			t.Errorf("the menu has no %q: %q", want, labels)
		}
	}

	// Quit, as homelab quit asks it.
	if !core.QuitTray() {
		t.Fatal("the tray did not answer at its address")
	}
	select {
	case <-exited:
	case <-time.After(10 * time.Second):
		t.Fatal("asked to quit, the tray did not end")
	}
}

var (
	user32                       = windows.NewLazySystemDLL("user32.dll")
	procFindWindowExW            = user32.NewProc("FindWindowExW")
	procGetWindowThreadProcessId = user32.NewProc("GetWindowThreadProcessId")
	procPostMessage              = user32.NewProc("PostMessageW")
	procSendMessage              = user32.NewProc("SendMessageW")
	procGetMenuItemCount         = user32.NewProc("GetMenuItemCount")
	procGetMenuStringW           = user32.NewProc("GetMenuStringW")
	procGetMenuItemID            = user32.NewProc("GetMenuItemID")
)

const (
	wmCommand     = 0x0111
	wmCancelMode  = 0x001F
	wmRButtonUp   = 0x0205
	mnGetHMenu    = 0x01E1
	mfByPosition  = 0x0400
	trayIconEvent = 0x0400 + 1 // the item's own message (WM_USER+1) for its icon's clicks
)

// trayWindow finds the tray item's own window (the systray library's
// SystrayClass) in process pid.
func trayWindow(pid uint32) windows.HWND {
	class, _ := windows.UTF16PtrFromString("SystrayClass")
	var after uintptr
	for end := time.Now().Add(10 * time.Second); time.Now().Before(end); {
		h, _, _ := procFindWindowExW.Call(0, after, uintptr(unsafe.Pointer(class)), 0)
		if h == 0 {
			after = 0
			time.Sleep(200 * time.Millisecond)
			continue
		}
		var owner uint32
		procGetWindowThreadProcessId.Call(h, uintptr(unsafe.Pointer(&owner)))
		if owner == pid {
			return windows.HWND(h)
		}
		after = h
	}
	return 0
}

// openMenu opens the item's menu as a right click on its icon does, reads
// each item's text from the menu Windows shows (its #32768 window), and
// closes it again.
func openMenu(hwnd windows.HWND) (labels []string, ids map[string]uint32) {
	procPostMessage.Call(uintptr(hwnd), trayIconEvent, 0, wmRButtonUp)
	defer procSendMessage.Call(uintptr(hwnd), wmCancelMode, 0, 0)
	class, _ := windows.UTF16PtrFromString("#32768")
	var menu uintptr
	for end := time.Now().Add(5 * time.Second); menu == 0 && time.Now().Before(end); time.Sleep(200 * time.Millisecond) {
		if w, _, _ := procFindWindowExW.Call(0, 0, uintptr(unsafe.Pointer(class)), 0); w != 0 {
			menu, _, _ = procSendMessage.Call(w, mnGetHMenu, 0, 0)
		}
	}
	if menu == 0 {
		return nil, nil
	}
	ids = map[string]uint32{}
	n, _, _ := procGetMenuItemCount.Call(menu)
	for i := 0; i < int(int32(n)); i++ {
		buf := make([]uint16, 256)
		procGetMenuStringW.Call(menu, uintptr(i), uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)), mfByPosition)
		label := windows.UTF16ToString(buf)
		if label == "" {
			continue // a separator
		}
		id, _, _ := procGetMenuItemID.Call(menu, uintptr(i))
		labels = append(labels, label)
		ids[label] = uint32(id)
	}
	return labels, ids
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
