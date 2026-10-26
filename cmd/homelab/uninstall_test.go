package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestUninstall(t *testing.T) {
	calls := fakeDocker(t, nil)
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home) // os.UserHomeDir on Windows
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

// With Docker Engine run as root, the apps' files belong to root, and the
// folder cannot be deleted as you (found by the nightly run): a container
// empties it first.
func TestUninstallDataOwnedByRoot(t *testing.T) {
	calls := fakeDocker(t, nil)
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
	root, _ := repoCopy(t)
	data := filepath.Join(root, "data")
	if err := os.MkdirAll(filepath.Join(data, "appdata", "nginx-proxy-manager"), 0o755); err != nil {
		t.Fatal(err)
	}
	emptied := false
	saved := removeAll
	removeAll = func(p string) error {
		if p == data && !strings.Contains(readCalls(t, calls), "-v "+data+":/v alpine:3 sh -c rm -rf") {
			return &os.PathError{Op: "unlinkat", Path: p, Err: os.ErrPermission}
		}
		emptied = emptied || p == data
		return os.RemoveAll(p)
	}
	t.Cleanup(func() { removeAll = saved })
	out, code := homelabCmd(t, root, "", "uninstall", "--data", "--apply")
	if code != 0 || !emptied {
		t.Fatalf("exit %d, emptied %v:\n%s\n%s", code, emptied, out, readCalls(t, calls))
	}
	if _, err := os.Stat(data); !os.IsNotExist(err) {
		t.Error("the data folder is still there")
	}
}
