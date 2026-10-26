package tray

import (
	"context"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	goruntime "runtime"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// homelab is a homelab folder from this repository's catalog, with the
// docker package's fake as the runtime and a launcher that says what it
// was asked (and fails when told to).
func homelab(t *testing.T, ctrs ...docker.FakeContainer) string {
	t.Helper()
	home := t.TempDir()
	for _, k := range []string{"HOME", "USERPROFILE", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_RUNTIME_DIR", "AppData", "LocalAppData"} {
		t.Setenv(k, home)
	}
	_, file, _, _ := goruntime.Caller(0)
	repo := filepath.Join(filepath.Dir(file), "..", "..")
	root := filepath.Join(home, "Homelab")
	for _, name := range []string{"compose.yaml", ".env.example", "compose", "stacks"} {
		src := filepath.Join(repo, name)
		filepath.WalkDir(src, func(p string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			rel, _ := filepath.Rel(repo, p)
			if d.IsDir() {
				return os.MkdirAll(filepath.Join(root, rel), 0o755)
			}
			data, _ := os.ReadFile(p)
			os.MkdirAll(filepath.Dir(filepath.Join(root, rel)), 0o755)
			return os.WriteFile(filepath.Join(root, rel), data, 0o644)
		})
	}
	if goruntime.GOOS == "windows" {
		os.WriteFile(filepath.Join(root, "homelab.cmd"), []byte("@echo off\r\nif exist \"%~dp0fail\" exit /b 1\r\necho ran %*\r\n"), 0o755)
	} else {
		os.WriteFile(filepath.Join(root, "homelab"), []byte("#!/bin/sh\n[ -e \"$(dirname \"$0\")/fail\" ] && exit 1\necho \"ran $*\"\n"), 0o755)
	}
	old := core.NewClient
	t.Cleanup(func() { core.NewClient = old })
	fake := &docker.FakeRunner{Containers: ctrs}
	core.NewClient = func() (*docker.Client, error) { return &docker.Client{Runner: fake, Bin: "docker"}, nil }
	return root
}

func TestRead(t *testing.T) {
	root := homelab(t, docker.FakeContainer{Name: "homelab_security-ntfy-1", Image: "binwiederhier/ntfy", Running: true, Project: "homelab_security", Service: "ntfy"})
	r := read(context.Background(), root, false, time.Now())
	if r.Summary == "" || r.Updates == nil || r.Update != "" || r.Alert != "" || r.Failing != "" {
		t.Fatalf("%+v", r)
	}
	if !r.Attention {
		t.Error("the baseline is not running, yet nothing needs a look")
	}
	if !slices.ContainsFunc(r.Links, func(l Link) bool { return strings.Contains(l.Title, "ntfy") }) {
		t.Errorf("no link to ntfy: %+v", r.Links)
	}
	if r := read(context.Background(), root, true, time.Now()); r.Update == "" {
		t.Error("a newer app build is not offered")
	}

	// A backup that is late shows its line: the .env copy is the last run.
	copied := filepath.Join(root, "recovery-staging", "secrets", "homelab.env")
	os.MkdirAll(filepath.Dir(copied), 0o755)
	os.WriteFile(copied, []byte("TZ=UTC\n"), 0o600)
	when := time.Now().Add(-72 * time.Hour)
	os.Chtimes(copied, when, when)
	if r := read(context.Background(), root, false, time.Now()); !strings.HasPrefix(r.Backup, "Last backup 3 days ago") {
		t.Errorf("a backup three days old: %q", r.Backup)
	}

	// The runtime down: the first line says why, and the rest still reads.
	core.NewClient = func() (*docker.Client, error) { return nil, docker.ErrNoDocker }
	if r := read(context.Background(), root, false, time.Now()); r.Updates != nil || r.Summary == "" || len([]rune(r.Summary)) > 70 {
		t.Fatalf("the runtime down: %+v", r)
	}
}

type item struct{ titles []string }

func (i *item) SetTitle(s string) { i.titles = append(i.titles, s) }

func TestMenuJobs(t *testing.T) {
	root := homelab(t)
	for _, c := range []struct {
		run  func(titled, string)
		want []string
	}{
		{runBackup, []string{"Back up now  —  backing up…", "Back up now  —  done "}},
		{runUpdateAll, []string{"Update apps now  —  updating…", "Update apps now  —  done "}},
	} {
		var it item
		c.run(&it, root)
		if len(it.titles) != 2 || it.titles[0] != c.want[0] || !strings.HasPrefix(it.titles[1], c.want[1]) {
			t.Errorf("%q", it.titles)
		}
	}
	os.WriteFile(filepath.Join(root, "fail"), nil, 0o644)
	var it item
	runBackup(&it, root)
	if !strings.Contains(it.titles[1], "failed") {
		t.Errorf("a failed backup: %q", it.titles)
	}
	it = item{}
	runUpdateAll(&it, root)
	if !strings.Contains(it.titles[1], "failed") {
		t.Errorf("a failed update: %q", it.titles)
	}
}

func TestOpenURL(t *testing.T) {
	oldGOOS, oldStart := goos, start
	t.Cleanup(func() { goos, start = oldGOOS, oldStart })
	var got [][]string
	start = func(c *exec.Cmd) error { got = append(got, c.Args); return nil }
	for _, c := range []struct{ goos, want string }{{"darwin", "open"}, {"windows", "rundll32"}, {"linux", "xdg-open"}} {
		goos, got = c.goos, nil
		openURL("https://photos.example.com")
		if len(got) != 1 || got[0][0] != c.want || got[0][len(got[0])-1] != "https://photos.example.com" {
			t.Errorf("%s: %q", c.goos, got)
		}
	}
}
