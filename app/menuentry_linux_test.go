package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMenuEntryOnLinux(t *testing.T) {
	t.Setenv("XDG_DATA_HOME", t.TempDir())
	appdir := t.TempDir()
	t.Setenv("APPDIR", appdir)
	icon := filepath.Join(appdir, "usr", "share", "icons", "hicolor", "256x256", "apps", "homelab-wizard.png")
	os.MkdirAll(filepath.Dir(icon), 0o755)
	os.WriteFile(icon, []byte("png"), 0o644)
	a := &App{}

	t.Setenv("APPIMAGE", "")
	if s := a.MenuEntry(); s.Available || s.Added {
		t.Errorf("a package offers the menu entry: %+v", s)
	}
	if a.SetMenuEntry(true) == nil {
		t.Error("a package added a menu entry")
	}

	t.Setenv("APPIMAGE", "/home/deck/Homelab-Wizard-x86_64.AppImage")
	if s := a.MenuEntry(); !s.Available || s.Added {
		t.Fatalf("before adding: %+v", s)
	}
	if err := a.SetMenuEntry(true); err != nil || !a.MenuEntry().Added {
		t.Fatalf("add: %v", err)
	}
	if data, _ := os.ReadFile(menuIconPath()); string(data) != "png" {
		t.Errorf("icon not copied: %q", data)
	}
	if err := a.SetMenuEntry(false); err != nil || a.MenuEntry().Added || fileExists(menuIconPath()) {
		t.Fatalf("remove: %v", err)
	}
	if err := a.SetMenuEntry(false); err != nil {
		t.Errorf("removing twice: %v", err)
	}
}

func TestFollowAppImage(t *testing.T) {
	t.Setenv("XDG_DATA_HOME", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("APPDIR", t.TempDir())
	dir := t.TempDir()
	old := filepath.Join(dir, "Homelab-Wizard-old.AppImage")
	os.WriteFile(old, nil, 0o755)
	a := &App{}

	// Both entries made by the old AppImage.
	t.Setenv("APPIMAGE", old)
	if err := a.SetMenuEntry(true); err != nil {
		t.Fatal(err)
	}
	if err := a.SetTrayAtLogin(true); err != nil {
		t.Fatal(err)
	}

	// A new one elsewhere, while the old one is still there: left alone.
	moved := filepath.Join(dir, "Apps", "Homelab-Wizard.AppImage")
	t.Setenv("APPIMAGE", moved)
	followAppImage()
	for _, p := range []string{menuEntryPath(), autostartPath()} {
		if data, _ := os.ReadFile(p); execPath(data) != old {
			t.Errorf("%s changed while the old AppImage exists:\n%s", p, data)
		}
	}

	// The old one gone: both follow the new one.
	os.Remove(old)
	followAppImage()
	for _, p := range []string{menuEntryPath(), autostartPath()} {
		if data, _ := os.ReadFile(p); execPath(data) != moved {
			t.Errorf("%s still starts the old AppImage:\n%s", p, data)
		}
	}
	if data, _ := os.ReadFile(autostartPath()); !strings.Contains(string(data), " --tray") {
		t.Errorf("the login entry lost --tray:\n%s", data)
	}
}
