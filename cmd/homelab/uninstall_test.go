package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestUninstall(t *testing.T) {
	calls := fakeDocker(t, nil)
	t.Setenv("HOME", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(os.Getenv("HOME"), ".config"))
	root, _ := repoCopy(t)
	appdata := filepath.Join(root, "data", "appdata", "ntfy")
	if err := os.MkdirAll(appdata, 0o755); err != nil {
		t.Fatal(err)
	}
	if out, code := homelabCmd(t, root, "", "uninstall"); code == 0 && !strings.Contains(out, "Preview") {
		t.Fatalf("without --apply it only shows the plan (exit %d):\n%s", code, out)
	}
	out, code := homelabCmd(t, root, "", "uninstall", "--apply")
	log := readCalls(t, calls)
	if !strings.Contains(log, "down --remove-orphans --rmi all") || strings.Contains(log, "--volumes") || !strings.Contains(log, "network rm homelab") {
		t.Fatalf("exit %d:\n%s\n%s", code, out, log)
	}
	if _, err := os.Stat(appdata); err != nil {
		t.Error("the data went without --data")
	}
	if _, code = homelabCmd(t, root, "", "uninstall", "--data", "--apply"); !strings.Contains(readCalls(t, calls), "--volumes") {
		t.Errorf("--data keeps the volumes (exit %d)", code)
	}
	if _, err := os.Stat(appdata); !os.IsNotExist(err) {
		t.Error("--data left the data")
	}
	if _, err := os.Stat(filepath.Join(root, ".env")); err != nil {
		t.Error(".env went too")
	}
}
