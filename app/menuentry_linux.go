package main

import (
	"errors"
	"os"
	"path/filepath"
)

// dataHome is where per-user app menu entries and icons go.
func dataHome() string {
	if dir := os.Getenv("XDG_DATA_HOME"); dir != "" {
		return dir
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".local", "share")
}

func menuEntryPath() string { return filepath.Join(dataHome(), "applications", menuID+".desktop") }

func menuIconPath() string {
	return filepath.Join(dataHome(), "icons", "hicolor", "256x256", "apps", "homelab-wizard.png")
}

func menuEntryState() MenuEntry {
	return MenuEntry{Available: os.Getenv("APPIMAGE") != "", Added: fileExists(menuEntryPath())}
}

func addMenuEntry() error {
	img := os.Getenv("APPIMAGE")
	if img == "" {
		return errors.New("only the AppImage adds itself to the app menu; the packages come with an entry")
	}
	// The icon, from inside the AppImage (AppRun sets APPDIR).
	if icon, err := os.ReadFile(filepath.Join(os.Getenv("APPDIR"), "usr", "share", "icons", "hicolor", "256x256", "apps", "homelab-wizard.png")); err == nil {
		if err := os.MkdirAll(filepath.Dir(menuIconPath()), 0o755); err != nil {
			return err
		}
		if err := os.WriteFile(menuIconPath(), icon, 0o644); err != nil {
			return err
		}
	}
	if err := os.MkdirAll(filepath.Dir(menuEntryPath()), 0o755); err != nil {
		return err
	}
	return os.WriteFile(menuEntryPath(), menuEntry(img), 0o644)
}

func removeMenuEntry() error {
	for _, p := range []string{menuEntryPath(), menuIconPath()} {
		if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	return nil
}

// followAppImage points the app menu entry and the tray's login entry at
// this AppImage when the file they start is gone: the AppImage moved, or a
// newer one replaced it under another name.
func followAppImage() {
	img := os.Getenv("APPIMAGE")
	if img == "" {
		return
	}
	entries := map[string][]byte{
		menuEntryPath(): menuEntry(img),
		autostartPath(): autostartEntry(img, []string{"--tray"}),
	}
	for path, want := range entries {
		cur, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		if old := execPath(cur); old != "" && old != img && !fileExists(old) {
			_ = os.WriteFile(path, want, 0o644)
		}
	}
}
