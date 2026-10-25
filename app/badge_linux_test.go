package main

import (
	"bufio"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/godbus/dbus/v5"
)

func TestBadgeOnTheSessionBus(t *testing.T) {
	if _, err := exec.LookPath("dbus-daemon"); err != nil {
		t.Skip("no dbus-daemon")
	}
	bus := exec.Command("dbus-daemon", "--session", "--nofork", "--print-address")
	out, _ := bus.StdoutPipe()
	if err := bus.Start(); err != nil {
		t.Skip(err)
	}
	defer bus.Process.Kill()
	addr, _ := bufio.NewReader(out).ReadString('\n')
	t.Setenv("DBUS_SESSION_BUS_ADDRESS", strings.TrimSpace(addr))
	os.Unsetenv("APPIMAGE")

	listen, err := dbus.ConnectSessionBus()
	if err != nil {
		t.Fatal(err)
	}
	defer listen.Close()
	if err := listen.AddMatchSignal(dbus.WithMatchInterface("com.canonical.Unity.LauncherEntry")); err != nil {
		t.Fatal(err)
	}
	got := make(chan *dbus.Signal, 2)
	listen.Signal(got)

	setBadge(3)
	select {
	case s := <-got:
		props, _ := s.Body[1].(map[string]dbus.Variant)
		if s.Name != "com.canonical.Unity.LauncherEntry.Update" || s.Body[0] != "application://io.github.snooper42.HomelabWizard.desktop" ||
			props["count"].Value() != int64(3) || props["count-visible"].Value() != true {
			t.Errorf("signal: %v %v", s.Name, s.Body)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("no signal")
	}
}
