package main

import (
	"strings"
	"testing"
)

func TestMenuEntry(t *testing.T) {
	e := string(menuEntry("/home/deck/Apps/Homelab Wizard.AppImage"))
	for _, want := range []string{"Exec=\"/home/deck/Apps/Homelab Wizard.AppImage\"\n", "TryExec=/home/deck/Apps/Homelab Wizard.AppImage\n", "Icon=homelab-wizard\n"} {
		if !strings.Contains(e, want) {
			t.Errorf("missing %q in:\n%s", want, e)
		}
	}
}

func TestExecPath(t *testing.T) {
	for _, path := range []string{"/home/deck/Homelab-Wizard-x86_64.AppImage", `/home/deck/my "apps"/a$b\c.AppImage`} {
		if got := execPath(menuEntry(path)); got != path {
			t.Errorf("menu entry: got %q, want %q", got, path)
		}
		if got := execPath(autostartEntry(path, []string{"--tray"})); got != path {
			t.Errorf("autostart entry: got %q, want %q", got, path)
		}
	}
	if got := execPath([]byte("[Desktop Entry]\nName=x\n")); got != "" {
		t.Errorf("no Exec: got %q", got)
	}
}
