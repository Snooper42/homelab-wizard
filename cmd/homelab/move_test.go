package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// fakeSystemctl stands in for systemctl, so installing and removing the
// scheduled jobs touches nothing on this machine.
func fakeSystemctl(t *testing.T) {
	t.Helper()
	dir := t.TempDir()
	for _, name := range []string{"systemctl", "loginctl", "launchctl"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("#!/bin/sh\nexit 0\n"), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	t.Setenv("PATH", dir+string(os.PathListSeparator)+os.Getenv("PATH"))
	t.Setenv("HOME", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(os.Getenv("HOME"), ".config"))
}

func TestMoveOutAndIn(t *testing.T) {
	calls := fakeDocker(t, ghostfolioDB())
	fakeSystemctl(t)
	old, media := repoCopy(t)
	for _, d := range []string{"photos", "downloads"} {
		_ = os.MkdirAll(filepath.Join(media, d), 0o755)
	}
	if err := os.MkdirAll(filepath.Join(old, "data", "appdata", "mealie"), 0o755); err != nil {
		t.Fatal(err)
	}
	_ = os.WriteFile(filepath.Join(old, "data", "appdata", "mealie", "mealie.db"), []byte("recipes"), 0o600)
	bundle := filepath.Join(t.TempDir(), "move.tar")

	if out, code := homelabCmd(t, old, "", "move", "out", "--to", filepath.Join(old, "inside.tar"), "--apply"); code == 0 || !strings.Contains(out, "outside the homelab folder") {
		t.Errorf("a move file inside the folder (exit %d):\n%s", code, out)
	}
	out, code := homelabCmd(t, old, "", "move", "out", "--to", bundle, "--apply")
	if code != 0 {
		t.Fatalf("move out: exit %d:\n%s", code, out)
	}
	if log := readCalls(t, calls); !strings.Contains(log, "pg_dumpall") || !strings.Contains(log, " stop") {
		t.Errorf("move out did not back up and stop:\n%s", log)
	}

	fresh, _ := repoCopy(t)
	_ = os.Remove(filepath.Join(fresh, ".env"))
	out, code = homelabCmd(t, fresh, "", "move", "in", bundle, "--apply")
	if code != 0 {
		t.Fatalf("move in: exit %d:\n%s\n%s", code, out, readCalls(t, calls))
	}
	if data, _ := os.ReadFile(filepath.Join(fresh, "data", "appdata", "mealie", "mealie.db")); string(data) != "recipes" {
		t.Errorf("the data did not come along: %q", data)
	}
	log := readCalls(t, calls)
	for _, want := range []string{"up --detach --no-deps ghostfolio-db", "exec -i homelab_ghostfolio-ghostfolio-db-1"} {
		if !strings.Contains(log, want) {
			t.Errorf("missing %q in:\n%s", want, log)
		}
	}
	if _, err := os.Stat(filepath.Join(fresh, "data", "homelab-move-done.json")); err != nil {
		t.Error("the move is not marked done")
	}
	if out, code := homelabCmd(t, fresh, "", "move", "in", bundle, "--apply"); code == 0 || !strings.Contains(out, "already has apps' data") {
		t.Errorf("moving in twice (exit %d):\n%s", code, out)
	}
}

func TestMoveInStopsForMissingFolders(t *testing.T) {
	fakeDocker(t, nil)
	fakeSystemctl(t)
	old, _ := repoCopy(t, "MEDIA_ROOT=/Volumes/NotHere")
	bundle := filepath.Join(t.TempDir(), "move.tar")
	if out, code := homelabCmd(t, old, "", "move", "out", "--to", bundle, "--apply"); code != 0 {
		t.Fatalf("move out: exit %d:\n%s", code, out)
	}
	fresh, _ := repoCopy(t)
	out, code := homelabCmd(t, fresh, "", "move", "in", bundle, "--apply")
	if code == 0 || !strings.Contains(out, "MEDIA_ROOT") {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	// Carrying on after fixing the setting needs no file.
	if out, _ := homelabCmd(t, fresh, "", "move", "in", "--apply"); !strings.Contains(out, "MEDIA_ROOT") {
		t.Errorf("carrying on:\n%s", out)
	}
}

func TestMoveInFromAnotherSystem(t *testing.T) {
	fakeDocker(t, nil)
	fakeSystemctl(t)
	old, _ := repoCopy(t, `MEDIA_ROOT=Q:\Hobbies`, "ADGUARD_DNS_BIND_IP=10.9.9.9", "PUID=4242", "PGID=4242")
	bundle := filepath.Join(t.TempDir(), "move.tar")
	if out, code := homelabCmd(t, old, "", "move", "out", "--to", bundle, "--apply"); code != 0 {
		t.Fatalf("move out: exit %d:\n%s", code, out)
	}
	fresh, _ := repoCopy(t)
	out, code := homelabCmd(t, fresh, "", "move", "in", bundle, "--apply")
	if code == 0 || !strings.Contains(out, `MEDIA_ROOT (the media drive) is Q:\Hobbies, which is not on this machine`) {
		t.Fatalf("a Windows drive moved here (exit %d):\n%s", code, out)
	}
	data, _ := os.ReadFile(filepath.Join(fresh, ".env"))
	if strings.Contains(string(data), "10.9.9.9") {
		t.Errorf("AdGuard Home still listens on the old machine's address:\n%s", data)
	}
	if os.Getuid() > 0 && strings.Contains(string(data), "PUID=4242") {
		t.Errorf("the old machine's account ids came along:\n%s", data)
	}
}
