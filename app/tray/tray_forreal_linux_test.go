//go:build forreal && linux

package tray

import (
	"bufio"
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
	"github.com/godbus/dbus/v5"
)

// The tray item started for real on Linux, the way a desktop shows it: it
// registers with the desktop's status notifier watcher over D-Bus, and its
// menu is read and clicked over D-Bus, as KDE Plasma and GNOME's
// AppIndicator extension do. The desktop here is a session bus of its own
// and a watcher in this test. CI runs it on Ubuntu (go test -tags forreal).
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

	addr, conn := sessionBus(t)

	// The desktop's watcher, which the tray registers with.
	w := watcher{got: make(chan string, 4)}
	if err := conn.Export(w, "/StatusNotifierWatcher", "org.kde.StatusNotifierWatcher"); err != nil {
		t.Fatal(err)
	}
	if reply, err := conn.RequestName("org.kde.StatusNotifierWatcher", dbus.NameFlagDoNotQueue); err != nil || reply != dbus.RequestNameReplyPrimaryOwner {
		t.Fatalf("the watcher's name: %v %v", reply, err)
	}

	tray := exec.Command(bin)
	tray.Env = append(os.Environ(), "DBUS_SESSION_BUS_ADDRESS="+addr)
	var log strings.Builder
	tray.Stdout, tray.Stderr = &log, &log
	if err := tray.Start(); err != nil {
		t.Fatal(err)
	}
	exited := make(chan error, 1)
	go func() { exited <- tray.Wait() }()
	t.Cleanup(func() { _ = tray.Process.Kill() })

	var item string
	select {
	case item = <-w.got:
	case err := <-exited:
		t.Fatalf("the tray exited before registering: %v\n%s", err, log.String())
	case <-time.After(20 * time.Second):
		t.Fatalf("the tray did not register with the watcher in 20 seconds\n%s", log.String())
	}
	sender, path, _ := strings.Cut(item, " ")
	if path != "/StatusNotifierItem" {
		t.Fatalf("registered %q", item)
	}
	obj := conn.Object(sender, dbus.ObjectPath(path))
	var tooltip, menuPath dbus.Variant
	if err := obj.Call("org.freedesktop.DBus.Properties.Get", 0, "org.kde.StatusNotifierItem", "Menu").Store(&menuPath); err != nil {
		t.Fatalf("its menu's path: %v", err)
	}
	if err := obj.Call("org.freedesktop.DBus.Properties.Get", 0, "org.kde.StatusNotifierItem", "ToolTip").Store(&tooltip); err != nil || !strings.Contains(tooltip.String(), "Homelab") {
		t.Fatalf("its tooltip: %v %v", tooltip, err)
	}

	menu := conn.Object(sender, menuPath.Value().(dbus.ObjectPath))
	var labels map[string]int32
	for end := time.Now().Add(20 * time.Second); ; time.Sleep(500 * time.Millisecond) {
		var rev uint32
		var root layout
		if err := menu.Call("com.canonical.dbusmenu.GetLayout", 0, int32(0), int32(-1), []string{}).Store(&rev, &root); err != nil {
			t.Fatalf("its menu: %v", err)
		}
		labels = map[string]int32{}
		root.labels(labels)
		_, checking := labels["Checking…"]
		if !checking || time.Now().After(end) {
			break
		}
	}
	awake := host.Current().KeepAwakeItem()
	for _, want := range []string{"Open Homelab Wizard", "Open an app", "Back up now", "Update apps now", awake, "Quit Homelab Wizard…"} {
		if _, ok := labels[want]; !ok {
			t.Errorf("the menu has no %q: %q", want, keys(labels))
		}
	}
	// Keep this computer awake, a check box ticked over D-Bus, then
	// clicked as the desktop clicks it: KEEP_AWAKE turns off.
	var groups []struct {
		ID    int32
		Props map[string]dbus.Variant
	}
	if err := menu.Call("com.canonical.dbusmenu.GetGroupProperties", 0, []int32{labels[awake]}, []string{"toggle-type", "toggle-state"}).Store(&groups); err != nil || len(groups) != 1 {
		t.Fatalf("%s's properties: %v %v", awake, err, groups)
	}
	props := groups[0].Props
	if fmt.Sprint(props["toggle-type"].Value()) != "checkmark" || fmt.Sprint(props["toggle-state"].Value()) != "1" {
		t.Errorf("%s is not a ticked check box: %v", awake, props)
	}
	if err := menu.Call("com.canonical.dbusmenu.Event", 0, labels[awake], "clicked", dbus.MakeVariant(""), uint32(time.Now().Unix())).Err; err != nil {
		t.Fatalf("clicking %s: %v", awake, err)
	}
	keepAwakeWritten(t, root, "false")
	if _, ok := labels["Checking…"]; ok {
		t.Errorf("the menu still says Checking… after 20 seconds: %q", keys(labels))
	}

	// Quit, as homelab quit asks it (clicking Quit Homelab Wizard… opens
	// the app, which asks first).
	if !core.QuitTray() {
		t.Fatal("the tray did not answer at its address")
	}
	select {
	case <-exited:
	case <-time.After(10 * time.Second):
		t.Fatal("asked to quit, the tray did not end")
	}
}

// sessionBus starts a D-Bus session bus of its own and connects to it.
func sessionBus(t *testing.T) (addr string, conn *dbus.Conn) {
	t.Helper()
	bus := exec.Command("dbus-daemon", "--session", "--nofork", "--print-address=1")
	stdout, _ := bus.StdoutPipe()
	if err := bus.Start(); err != nil {
		t.Fatalf("dbus-daemon: %v", err)
	}
	t.Cleanup(func() { _ = bus.Process.Kill(); _ = bus.Wait() })
	addr, err := bufio.NewReader(stdout).ReadString('\n')
	if err != nil {
		t.Fatalf("the bus's address: %v", err)
	}
	addr = strings.TrimSpace(addr)
	if conn, err = dbus.Connect(addr); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	return addr, conn
}

// watcher stands in for the desktop's org.kde.StatusNotifierWatcher.
type watcher struct{ got chan string }

func (w watcher) RegisterStatusNotifierItem(sender dbus.Sender, path string) *dbus.Error {
	w.got <- string(sender) + " " + path
	return nil
}

// layout is a dbusmenu item and the items under it.
type layout struct {
	ID       int32
	Props    map[string]dbus.Variant
	Children []dbus.Variant
}

func (l layout) labels(into map[string]int32) {
	if s, ok := l.Props["label"].Value().(string); ok && s != "" {
		into[s] = l.ID
	}
	for _, c := range l.Children {
		var child layout
		if err := dbus.Store([]interface{}{c.Value()}, &child); err == nil {
			child.labels(into)
		}
	}
}

func keys(m map[string]int32) []string {
	var out []string
	for k := range m {
		out = append(out, k)
	}
	slices.Sort(out)
	return out
}
