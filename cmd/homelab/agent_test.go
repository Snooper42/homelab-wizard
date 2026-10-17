package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestBackupDue(t *testing.T) {
	at := func(day, hour, min int) time.Time { return time.Date(2026, 10, day, hour, min, 0, 0, time.Local) }
	cases := []struct {
		now, last time.Time
		want      bool
	}{
		{at(17, 3, 31), at(16, 3, 30), true},  // tonight's slot has come
		{at(17, 3, 29), at(16, 3, 30), false}, // not yet
		{at(17, 9, 0), at(16, 3, 30), true},   // asleep at 03:30: as soon as it wakes
		{at(17, 9, 0), at(17, 3, 31), false},  // already ran today
		{at(17, 2, 0), at(15, 3, 30), true},   // missed last night's
	}
	for _, c := range cases {
		if got := backupDue(c.now, c.last); got != c.want {
			t.Errorf("backupDue(%v, %v) = %v", c.now, c.last, got)
		}
	}
}

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
