package main

import (
	"os"
	"strings"
	"testing"
)

func TestTrayAtLoginOnLinux(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("APPIMAGE", "/home/deck/Homelab-Wizard-x86_64.AppImage")
	a := &App{}
	if a.TrayAtLogin() {
		t.Fatal("on before it was turned on")
	}
	if err := a.SetTrayAtLogin(true); err != nil || !a.TrayAtLogin() {
		t.Fatalf("turn on: %v", err)
	}
	data, _ := os.ReadFile(autostartPath())
	if !strings.Contains(string(data), "Exec=/home/deck/Homelab-Wizard-x86_64.AppImage --tray") {
		t.Errorf("the entry does not start the AppImage:\n%s", data)
	}
	if err := a.SetTrayAtLogin(false); err != nil || a.TrayAtLogin() {
		t.Fatalf("turn off: %v", err)
	}
	if err := a.SetTrayAtLogin(false); err != nil {
		t.Errorf("turning off twice: %v", err)
	}
}
