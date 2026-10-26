package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestTrayHelperFor(t *testing.T) {
	app := filepath.Join(t.TempDir(), "Homelab Wizard.app")
	agent := filepath.Join(app, "Contents", "Library", "LoginItems", "Homelab Wizard Agent.app", "Contents", "MacOS", "homelab")
	tray := filepath.Join(app, "Contents", "Helpers", "homelab-tray")
	for _, p := range []string{agent, tray} {
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, nil, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	if got := trayHelperFor(agent); got != tray {
		t.Errorf("from the agent bundle: %q", got)
	}
	if got := trayHelperFor(filepath.Join(app, "Contents", "Helpers", "homelab")); got != tray {
		t.Errorf("from Helpers: %q", got)
	}
	if got := trayHelperFor("/usr/local/bin/homelab"); got != "" {
		t.Errorf("outside a bundle: %q", got)
	}
}
