package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/host"
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

// What compose down cannot reach goes too (found on a PC taken off after
// the homelab moved to a Mac): the copies an update kept for its undo, the
// backup's helper, and a homelab project no compose file lists any more.
// Whatever is not the homelab's stays, and uninstall names it.
func TestUninstallLeftovers(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		// The fake's IDs follow the order: id0, id1, id2.
		{Name: "homelab_old-gone-1", Image: "example/gone:latest", Project: "homelab_old", Service: "gone"},
		{Name: "budget-tracker-prod-db-1", Image: "postgres:16", Running: true, Project: "budget-tracker-prod", Service: "db"},
		{Name: "beets", Image: "lscr.io/linuxserver/beets:latest"},
	})
	dir := filepath.Dir(calls)
	images := "homelab-rollback/grocy:previous\nhomelab/sqlite:1\npostgres:16\nlscr.io/linuxserver/beets:latest\nhomelab/nginx-proxy-manager-crowdsec:2.16.0\n"
	volumes := "homelab_old_db homelab_old\nbudget_db budget-tracker-prod\nloose \n"
	for name, data := range map[string]string{"images.txt": images, "volumes.txt": volumes} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(strings.ReplaceAll(data, `\n`, "\n")), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
	root, _ := repoCopy(t)

	out, code := homelabCmd(t, root, "", "uninstall", "--apply")
	log := readCalls(t, calls)
	for _, want := range []string{"image rm homelab-rollback/grocy:previous", "image rm homelab/sqlite:1", "rm --force id0\n"} {
		if !strings.Contains(log, want) {
			t.Errorf("no %q (exit %d):\n%s\n%s", want, code, out, log)
		}
	}
	for _, never := range []string{"image rm postgres", "image rm lscr.io", "rm --force id1", "rm --force id2", "volume rm"} {
		if strings.Contains(log, never) {
			t.Errorf("%q, which is not the homelab's, or data without --data:\n%s", never, log)
		}
	}
	if !strings.Contains(out, "not the homelab's, so left as they are: beets, budget-tracker-prod") {
		t.Errorf("does not name what it left:\n%s", out)
	}

	homelabCmd(t, root, "", "uninstall", "--data", "--apply")
	log = readCalls(t, calls)
	if !strings.Contains(log, "volume rm homelab_old_db") || strings.Contains(log, "volume rm budget_db") || strings.Contains(log, "volume rm loose") {
		t.Errorf("--data removes only the homelab's volumes:\n%s", log)
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

// Each system's own way to remove the app, never the Mac's on the others.
func TestRemoveAppOnEachSystem(t *testing.T) {
	for _, tc := range []struct {
		p    host.Profile
		want string
	}{
		{host.For("darwin"), "Trash"},
		{host.For("windows"), "Installed apps"},
		{host.For("linux"), "homelab-wizard package"},
		{host.SteamOS(host.For("linux")), "AppImage"},
	} {
		if got := removeApp(tc.p); !strings.Contains(got, tc.want) {
			t.Errorf("%s: %q, want %q in it", tc.p.Name, got, tc.want)
		}
	}
	for goos, want := range map[string]string{"darwin": "open -e", "windows": "notepad", "linux": "text editor"} {
		if got := editEnv(goos); !strings.Contains(got, want) {
			t.Errorf("%s: %q, want %q in it", goos, got, want)
		}
	}
}
