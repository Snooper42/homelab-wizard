//go:build forreal

package main

import (
	"bufio"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/godbus/dbus/v5"
)

// "Needs a look" as a count on the app's icon, sent for real on a session
// bus of the test's own, as KDE Plasma's taskbar and Ubuntu's dock hear it
// (the Unity launcher API): the count, then cleared. CI runs it on Ubuntu
// (go test -tags forreal).
func TestBadgeArrivesForReal(t *testing.T) {
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
	// setBadge uses the shared session bus, which is this one from here.
	t.Setenv("DBUS_SESSION_BUS_ADDRESS", addr)

	dock, err := dbus.Connect(addr)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { dock.Close() })
	if err := dock.AddMatchSignal(dbus.WithMatchInterface("com.canonical.Unity.LauncherEntry"), dbus.WithMatchMember("Update")); err != nil {
		t.Fatal(err)
	}
	got := make(chan *dbus.Signal, 4)
	dock.Signal(got)

	heard := func(count int64, visible bool) {
		t.Helper()
		select {
		case s := <-got:
			if len(s.Body) != 2 {
				t.Fatalf("the update carries %v", s.Body)
			}
			app, _ := s.Body[0].(string)
			props, _ := s.Body[1].(map[string]dbus.Variant)
			if app != "application://io.github.snooper42.HomelabWizard.desktop" {
				t.Errorf("the update is for %q", app)
			}
			if n, _ := props["count"].Value().(int64); n != count {
				t.Errorf("count %v, want %d", props["count"], count)
			}
			if v, _ := props["count-visible"].Value().(bool); v != visible {
				t.Errorf("count-visible %v, want %v", props["count-visible"], visible)
			}
		case <-time.After(10 * time.Second):
			t.Fatal("no launcher update arrived")
		}
	}
	setBadge(3)
	heard(3, true)
	setBadge(0)
	heard(0, false)
}
