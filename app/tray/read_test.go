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

// The job's title follows its output: the step, with the app's name, then
// what Compose is doing for it.
func TestFollower(t *testing.T) {
	root := homelab(t)
	var it item
	f := newFollower(&it, root, "Update apps now")
	for _, l := range []string{
		`{"schema":1,"type":"step","data":{"n":2,"total":5,"text":"Updating navidrome"}}`,
		`{"id":"Image deluan/navidrome:latest","status":"Working","text":"Pulling"}`,
		`{"id":"39c2ddfd6010","parent_id":"Image deluan/navidrome:latest","status":"Working","text":"Downloading","details":"8.389MB","current":8388608,"total":15522356,"percent":54}`,
		`{"schema":1,"type":"step","data":{"n":3,"total":5,"text":"Downloading Docker","percent":40}}`,
		"some line Compose prints",
	} {
		f.Write([]byte(l + "\n"))
	}
	f.Write([]byte(`{"schema":1,"type":"step","data":{"n":4,"total":5,"tex`))
	f.Write([]byte(`t":"Updating ntfy"}}` + "\r\n"))
	got := strings.Join(it.titles, "\n")
	for _, want := range []string{
		"Update apps now  —  Updating Navidrome · 2 of 5",
		"Update apps now  —  Updating Navidrome · 2 of 5: Navidrome downloading",
		"Update apps now  —  Downloading Docker · 40% · 3 of 5",
		"Update apps now  —  Updating ntfy · 4 of 5",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("no %q in\n%s", want, got)
		}
	}
	for i := 1; i < len(it.titles); i++ {
		if it.titles[i] == it.titles[i-1] {
			t.Errorf("the same title twice: %q", it.titles[i])
		}
	}
}
