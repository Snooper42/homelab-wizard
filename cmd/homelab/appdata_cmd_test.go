package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/appdata"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

// Quality-loop D3 part 2 (the owner's yes, Nov 26: "keep the old copy"): the move stops the running apps, copies and
// checks every file, points APPDATA_ROOT at the copy, and makes every container anew on it (the running ones
// started, a stopped one left stopped); undo goes back; remove-old deletes only the copy not in use.
func TestAppdataMove(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-vaultwarden-1", Image: "vaultwarden/server:latest", Running: true, Project: "homelab_security", Service: "vaultwarden"},
		{Name: "homelab_household-mealie-1", Image: "ghcr.io/mealie-recipes/mealie:latest", Running: false, Project: "homelab_household", Service: "mealie"},
	})
	fakeSystemctl(t)
	root, _ := repoCopy(t)
	old := filepath.Join(root, "data", "appdata")
	os.MkdirAll(filepath.Join(old, "vaultwarden"), 0o755)
	os.WriteFile(filepath.Join(old, "vaultwarden", "db.sqlite3"), []byte("passwords"), 0o600)
	to := filepath.Join(t.TempDir(), "Fast", "appdata")
	env := func() string {
		f, _ := envfile.Load(filepath.Join(root, ".env"))
		v, _ := f.Get("APPDATA_ROOT")
		return v
	}

	if out, code := homelabCmd(t, root, "", "appdata", "move", to); code != 0 || !strings.Contains(out, "Preview only") || env() != "" {
		t.Fatalf("a preview moved (exit %d):\n%s", code, out)
	}
	out, code := homelabCmd(t, root, "", "appdata", "move", to, "--apply")
	if code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	if got, _ := os.ReadFile(filepath.Join(to, "vaultwarden", "db.sqlite3")); string(got) != "passwords" {
		t.Errorf("the copy: %q", got)
	}
	if env() != to {
		t.Errorf("APPDATA_ROOT=%q", env())
	}
	if _, err := os.Stat(filepath.Join(old, "vaultwarden", "db.sqlite3")); err != nil {
		t.Error("the old copy is gone")
	}
	if m, ok := appdata.LoadMove(root); !ok || m.Old != old || m.New != to || m.Files != 1 {
		t.Errorf("the record: %+v", m)
	}
	log, _ := os.ReadFile(calls)
	for _, want := range []string{"stop homelab_security-vaultwarden-1", "up --detach --force-recreate vaultwarden", "create --force-recreate mealie"} {
		if !strings.Contains(string(log), want) {
			t.Errorf("no %q in:\n%s", want, log)
		}
	}
	if strings.Contains(string(log), "stop homelab_household-mealie-1") {
		t.Error("it stopped an app that wasn't running")
	}
	// A second move waits for the first's old copy to go.
	if out, code := homelabCmd(t, root, "", "appdata", "move", t.TempDir(), "--apply"); code == 0 || !strings.Contains(out, "remove-old") {
		t.Errorf("a second move (exit %d):\n%s", code, out)
	}
	// Remove-old never deletes the folder in use.
	if out, code := homelabCmd(t, root, "", "appdata", "undo", "--apply"); code != 0 || env() != "" {
		t.Fatalf("undo (exit %d, APPDATA_ROOT=%q):\n%s", code, env(), out)
	}
	if m, _ := appdata.LoadMove(root); m.Old != to {
		t.Errorf("after undo the copy not in use is the moved one: %+v", m)
	}
	if out, code := homelabCmd(t, root, "", "appdata", "remove-old", "--apply"); code != 0 {
		t.Fatalf("remove-old (exit %d):\n%s", code, out)
	}
	if _, err := os.Stat(to); err == nil {
		t.Error("the moved copy is still there")
	}
	if _, err := os.Stat(filepath.Join(old, "vaultwarden", "db.sqlite3")); err != nil {
		t.Error("remove-old deleted the folder in use")
	}
	if _, ok := appdata.LoadMove(root); ok {
		t.Error("the record outlived its copy")
	}
}

// A folder that isn't empty, the backups' own, or the data's own folder is refused, and nothing changes.
func TestAppdataMoveRefuses(t *testing.T) {
	fakeDocker(t, nil)
	fakeSystemctl(t)
	full := t.TempDir()
	os.WriteFile(filepath.Join(full, "x"), []byte("x"), 0o644)
	backups := t.TempDir()
	root, _ := repoCopy(t, "BACKUP_DESTINATION="+backups)
	os.MkdirAll(filepath.Join(root, "data", "appdata", "a"), 0o755)
	os.WriteFile(filepath.Join(root, "data", "appdata", "a", "f"), []byte("f"), 0o644)
	for _, to := range []string{full, filepath.Join(backups, "appdata"), filepath.Join(root, "data", "appdata")} {
		if out, code := homelabCmd(t, root, "", "appdata", "move", to, "--apply"); code == 0 {
			t.Errorf("moved to %s:\n%s", to, out)
		}
	}
	f, _ := envfile.Load(filepath.Join(root, ".env"))
	if v, _ := f.Get("APPDATA_ROOT"); v != "" {
		t.Errorf("APPDATA_ROOT=%q", v)
	}
}
