package main

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// backupJob writes one job's backup as the stand-in Duplicati restores it:
// Duplicati's file, the passphrase that opens it, and the files it holds.
func backupJob(t *testing.T, folder, job, passphrase string, files map[string]string) {
	t.Helper()
	dir := filepath.Join(folder, job)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	for name, body := range files {
		p := filepath.Join(dir, "files", name)
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	_ = os.WriteFile(filepath.Join(dir, "duplicati-20261030T050000Z.dlist.zip.aes"), nil, 0o644)
	_ = os.WriteFile(filepath.Join(dir, "passphrase"), []byte(passphrase), 0o644)
}

// A machine lost, a new homelab folder, and the backup folder: rebuild
// restores .env and the household's records with the Secrets passphrase,
// the apps' data with the passphrase .env holds, and starts the homelab;
// a wrong passphrase stops it before anything is written, and the
// passphrase never goes on a command line.
func TestRebuild(t *testing.T) {
	calls := fakeDocker(t, nil)
	fakeSystemctl(t)
	old, media := repoCopy(t)
	for _, d := range []string{"photos", "downloads"} {
		_ = os.MkdirAll(filepath.Join(media, d), 0o755)
	}
	env, err := os.ReadFile(filepath.Join(old, ".env"))
	if err != nil {
		t.Fatal(err)
	}
	env = append(env, []byte("\nDUPLICATI_PASSPHRASE=open-the-rest\nDUPLICATI_PORT=1\n")...)
	folder := t.TempDir()
	backupJob(t, folder, "secrets", "sesame", map[string]string{
		"homelab.env":          string(env),
		"data/people.json":     `[{"name":"Anna"}]`,
		"data/people/anna.txt": "anna",
	})
	backupJob(t, folder, "appdata", "open-the-rest", map[string]string{"mealie/mealie.db": "recipes"})
	backupJob(t, folder, "infrastructure", "open-the-rest", map[string]string{"custom/myapp/compose.yaml": "services: {}\n", "media/compose.yaml": "not mine"})

	fresh, _ := repoCopy(t)
	_ = os.Remove(filepath.Join(fresh, ".env"))
	t.Setenv("DUPLICATI_SECRETS_PASSPHRASE", "not it")
	if out, code := homelabCmd(t, fresh, "", "rebuild", folder, "--apply"); code == 0 || !strings.Contains(out, "the passphrase does not open it") {
		t.Fatalf("a wrong passphrase (exit %d):\n%s", code, out)
	}
	if _, err := os.Stat(filepath.Join(fresh, ".env")); err == nil {
		t.Error(".env was written with a wrong passphrase")
	}

	t.Setenv("DUPLICATI_SECRETS_PASSPHRASE", "sesame")
	out, code := homelabCmd(t, fresh, "", "rebuild", folder, "--apply")
	if code != 0 {
		t.Fatalf("rebuild: exit %d:\n%s\n%s", code, out, readCalls(t, calls))
	}
	// .env, its restored copy, and the household's records are this
	// account's alone (a mode Windows does not keep).
	if runtime.GOOS != "windows" {
		for _, f := range []string{".env", "recovery-staging/secrets/homelab.env", "data/people.json"} {
			if info, err := os.Stat(filepath.Join(fresh, f)); err != nil || info.Mode().Perm() != 0o600 {
				t.Errorf("%s: %v %v", f, info, err)
			}
		}
	}
	got := envMapOf(t, fresh)
	if got["DUPLICATI_PASSPHRASE"] != "open-the-rest" || got["BACKUP_DESTINATION"] != folder {
		t.Errorf("the restored .env: passphrase %q, backups to %q", got["DUPLICATI_PASSPHRASE"], got["BACKUP_DESTINATION"])
	}
	for path, want := range map[string]string{
		"data/people.json":                 `[{"name":"Anna"}]`,
		"data/people/anna.txt":             "anna",
		"data/appdata/mealie/mealie.db":    "recipes",
		"stacks/custom/myapp/compose.yaml": "services: {}\n",
	} {
		if data, _ := os.ReadFile(filepath.Join(fresh, path)); string(data) != want {
			t.Errorf("%s: %q", path, data)
		}
	}
	if data, _ := os.ReadFile(filepath.Join(fresh, "stacks", "media", "compose.yaml")); string(data) == "not mine" {
		t.Error("the backup's stacks replaced the homelab's own files")
	}
	log := readCalls(t, calls)
	if strings.Contains(log, "sesame") || strings.Contains(log, "open-the-rest") {
		t.Errorf("a passphrase went on a command line:\n%s", log)
	}
	if !strings.Contains(log, "duplicati-cli") || !strings.Contains(log, "-e PASSPHRASE") {
		t.Errorf("not restored with Duplicati's command line:\n%s", log)
	}
	if _, err := os.Stat(filepath.Join(fresh, "data", "homelab-rebuild-done.json")); err != nil {
		t.Error("the rebuild is not marked done")
	}
	if !strings.Contains(out, "Left to do") {
		t.Errorf("no list of what is left:\n%s", out)
	}
	if out, code := homelabCmd(t, fresh, "", "rebuild", folder, "--apply"); code == 0 || !strings.Contains(out, "already has apps' data") {
		t.Errorf("rebuilding twice (exit %d):\n%s", code, out)
	}
	if out, code := homelabCmd(t, fresh, "", "rebuild", t.TempDir(), "--apply"); code == 0 || !strings.Contains(out, "no Homelab Secrets backup") {
		t.Errorf("a folder with no backups (exit %d):\n%s", code, out)
	}
	empty := t.TempDir()
	backupJob(t, empty, "secrets", "sesame", nil)
	again, _ := repoCopy(t)
	_ = os.Remove(filepath.Join(again, ".env"))
	if out, code := homelabCmd(t, again, "", "rebuild", empty, "--apply"); code == 0 || !strings.Contains(out, "holds no files") {
		t.Errorf("a Secrets backup of an empty folder (exit %d):\n%s", code, out)
	}
}

// A link in a restored backup is left out, not followed out of it.
func TestCopyTreeLeavesLinks(t *testing.T) {
	src, dst, outside := t.TempDir(), t.TempDir(), t.TempDir()
	if err := os.WriteFile(filepath.Join(outside, "secret"), []byte("not for the copy"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(src, "kept"), []byte("kept"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(outside, "secret"), filepath.Join(src, "link")); err != nil {
		t.Skip("no links here:", err)
	}
	if err := copyTree(src, dst, true); err != nil {
		t.Fatal(err)
	}
	if b, err := os.ReadFile(filepath.Join(dst, "kept")); err != nil || string(b) != "kept" {
		t.Fatalf("kept: %q, %v", b, err)
	}
	if _, err := os.Lstat(filepath.Join(dst, "link")); !os.IsNotExist(err) {
		t.Fatalf("the link was copied: %v", err)
	}
	if err := copyTree(filepath.Join(src, "missing"), dst, false); err != nil {
		t.Fatalf("a missing folder: %v", err)
	}
}
