package core

import (
	"context"
	"errors"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/host"
	"github.com/Snooper42/homelab-wizard/internal/kit"
)

// away points every per-user folder (config, cache, the agent's socket)
// at a fresh one, so nothing here reads or writes this machine's own.
func away(t *testing.T) string {
	t.Helper()
	home := t.TempDir()
	for _, k := range []string{"HOME", "USERPROFILE", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_RUNTIME_DIR", "AppData", "LocalAppData"} {
		t.Setenv(k, home)
	}
	t.Setenv("HOMELAB_ROOT", "")
	return home
}

// homelab is a homelab folder with this repository's catalog and env.
func homelab(t *testing.T, env string) string {
	t.Helper()
	_, file, _, _ := runtime.Caller(0)
	repo := filepath.Join(filepath.Dir(file), "..", "..")
	root := t.TempDir()
	for _, name := range []string{"compose.yaml", ".env.example", "compose", "stacks", "dockerfiles"} {
		src := filepath.Join(repo, name)
		filepath.WalkDir(src, func(p string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			rel, _ := filepath.Rel(repo, p)
			dst := filepath.Join(root, rel)
			if d.IsDir() {
				return os.MkdirAll(dst, 0o755)
			}
			data, err := os.ReadFile(p)
			if err != nil {
				return err
			}
			return os.WriteFile(dst, data, 0o644)
		})
	}
	if env != "" {
		os.WriteFile(filepath.Join(root, ".env"), []byte(env), 0o600)
	}
	return root
}

// runner is the docker package's fake, plus `docker stats`.
type runner struct {
	*docker.FakeRunner
	stats string
	down  error
}

func (r *runner) Output(ctx context.Context, bin string, args ...string) ([]byte, error) {
	if r.down != nil {
		return nil, r.down
	}
	if len(args) > 0 && args[0] == "stats" {
		return []byte(r.stats), nil
	}
	return r.FakeRunner.Output(ctx, bin, args...)
}

func withDocker(t *testing.T, r *runner) {
	t.Helper()
	old := NewClient
	NewClient = func() (*docker.Client, error) { return &docker.Client{Runner: r, Bin: "docker"}, nil }
	t.Cleanup(func() { NewClient = old })
}

func running(project, service string) docker.FakeContainer {
	return docker.FakeContainer{Name: project + "-" + service + "-1", Image: "img/" + service, Running: true, Project: project, Service: service}
}

func TestRoot(t *testing.T) {
	home := away(t)
	if Root() != "" {
		t.Fatal("a homelab where there is none")
	}
	if IsRoot("") || IsRoot(home) {
		t.Fatal("IsRoot")
	}
	// ~/Homelab is found without being chosen.
	mine := filepath.Join(home, "Homelab")
	os.MkdirAll(mine, 0o755)
	for _, f := range []string{"compose.yaml", ".env.example"} {
		os.WriteFile(filepath.Join(mine, f), nil, 0o644)
	}
	if Root() != mine {
		t.Fatalf("~/Homelab: %q", Root())
	}
	// The folder chosen in Setup comes first, and is remembered.
	chosen := homelab(t, "")
	if err := SaveRoot(chosen); err != nil {
		t.Fatal(err)
	}
	if Root() != chosen {
		t.Fatalf("the chosen folder: %q", Root())
	}
	if _, err := os.Stat(configPath()); err != nil || !strings.HasPrefix(configPath(), home) {
		t.Fatalf("the config at %s: %v", configPath(), err)
	}
	// One that has gone falls back to the next.
	os.RemoveAll(chosen)
	t.Setenv("HOMELAB_ROOT", mine)
	if Root() != mine {
		t.Fatalf("after the chosen folder went: %q", Root())
	}
}

func TestCatalogAndEnv(t *testing.T) {
	if _, err := Catalog(t.TempDir()); err == nil || !strings.Contains(err.Error(), "choose the homelab folder") {
		t.Fatalf("not a homelab: %v", err)
	}
	root := homelab(t, "TZ=Europe/Berlin\nNTFY_PORT=9300\n")
	c, err := Catalog(root)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := c.Get("ntfy"); !ok {
		t.Fatal("no ntfy in the catalog")
	}
	if env := Env(root); env["TZ"] != "Europe/Berlin" || env["NTFY_PORT"] != "9300" {
		t.Fatalf("%v", env)
	}
	if env := Env(t.TempDir()); env == nil || len(env) != 0 {
		t.Fatalf("no .env: %v", env)
	}
}

func TestContainers(t *testing.T) {
	away(t)
	old := NewClient
	t.Cleanup(func() { NewClient = old })
	NewClient = func() (*docker.Client, error) { return nil, docker.ErrNoDocker }
	if _, _, err := Containers(context.Background()); !errors.Is(err, docker.ErrNoDocker) || !strings.Contains(err.Error(), host.Current().InstallRuntime) {
		t.Fatalf("no runtime: %v", err)
	}
	r := &runner{FakeRunner: &docker.FakeRunner{}, down: errors.New("Cannot connect to the Docker daemon")}
	withDocker(t, r)
	_, _, err := Containers(context.Background())
	var ex docker.Explained
	if !errors.As(err, &ex) || ex.Msg == "" {
		t.Fatalf("the runtime down: %v", err)
	}
	r.down = nil
	r.Containers = []docker.FakeContainer{running("homelab_security", "ntfy")}
	if _, list, err := Containers(context.Background()); err != nil || len(list) != 1 {
		t.Fatalf("%v %v", list, err)
	}
}

func TestStatusAndBackups(t *testing.T) {
	away(t)
	root := homelab(t, "")
	withDocker(t, &runner{FakeRunner: &docker.FakeRunner{Containers: []docker.FakeContainer{running("homelab_security", "ntfy"), running("homelab_security", "vaultwarden")}}})
	os.MkdirAll(filepath.Join(root, "data"), 0o755)
	os.WriteFile(filepath.Join(root, "data", "battery.json"), []byte(`{"paused":["sonarr"]}`), 0o644)
	ctx := context.Background()
	for name, read := range map[string]func(context.Context, string) (api.Status, error){"Status": Status, "StatusHere": StatusHere, "StatusNow": StatusNow} {
		st, err := read(ctx, root)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		state := map[string]string{}
		for _, a := range st.Apps {
			state[a.ID] = a.State
		}
		if state["ntfy"] != "running" || state["vaultwarden"] != "running" || !slices.Equal(st.BatteryPaused, []string{"sonarr"}) {
			t.Errorf("%s: %v, paused %v", name, state, st.BatteryPaused)
		}
	}
	if _, err := Status(ctx, t.TempDir()); err == nil {
		t.Error("status without a homelab")
	}
	b, err := Backups(ctx, root)
	if err != nil {
		t.Fatal(err)
	}
	apps := map[string]bool{}
	for _, c := range b.Copies {
		apps[c.ID] = true
	}
	if !apps["vaultwarden"] {
		t.Errorf("Vaultwarden, running, has no backup row: %+v", b.Copies)
	}
	if _, err := Backups(ctx, t.TempDir()); err == nil {
		t.Error("backups without a homelab")
	}
}

func TestUsage(t *testing.T) {
	away(t)
	withDocker(t, &runner{
		FakeRunner: &docker.FakeRunner{Containers: []docker.FakeContainer{running("homelab_photos", "immich-machine-learning")}},
		stats:      `{"Name":"homelab_photos-immich-machine-learning-1","CPUPerc":"85.00%","MemUsage":"1.2GiB / 16GiB"}` + "\n" + `{"Name":"stranger","CPUPerc":"1.00%","MemUsage":"10MiB / 16GiB"}`,
	})
	stats, err := Usage(context.Background())
	if err != nil || len(stats) != 2 {
		t.Fatalf("%v %v", stats, err)
	}
	names := []string{stats[0].Name, stats[1].Name}
	if !slices.Contains(names, "immich-machine-learning") || !slices.Contains(names, "stranger") {
		t.Fatalf("names %v", names)
	}
}

func TestProtectionAndReleaseNotes(t *testing.T) {
	away(t)
	root := homelab(t, "")
	withDocker(t, &runner{FakeRunner: &docker.FakeRunner{Containers: []docker.FakeContainer{running("homelab_security", "ntfy")}}})
	ctx := context.Background()
	if _, err := Protection(ctx, root); !errors.Is(err, ErrNoCrowdSec) {
		t.Fatalf("no CrowdSec: %v", err)
	}
	if _, err := ReleaseNotes(ctx, root, "nothing-like-it"); err == nil || !strings.Contains(err.Error(), "unknown") {
		t.Fatalf("an unknown app: %v", err)
	}
	if _, err := ReleaseNotes(ctx, root, "vaultwarden"); err == nil || !strings.Contains(err.Error(), "is not running") {
		t.Fatalf("an app not running: %v", err)
	}
	for _, f := range []func() error{
		func() error { _, err := Protection(ctx, t.TempDir()); return err },
		func() error { _, err := ReleaseNotes(ctx, t.TempDir(), "ntfy"); return err },
		func() error { _, err := SetUpdatesPaused(ctx, t.TempDir(), true); return err },
	} {
		if f() == nil {
			t.Error("without a homelab")
		}
	}
}

func TestRecentAlerts(t *testing.T) {
	ctx := context.Background()
	if _, err := RecentAlerts(ctx, homelab(t, "")); !errors.Is(err, ErrNoReadToken) {
		t.Fatalf("no token: %v", err)
	}
	var auth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth = r.Header.Get("Authorization")
		w.Write([]byte(`{"id":"a","time":1760000000,"event":"message","topic":"watchtower","message":"vikunja updated"}` + "\n"))
	}))
	defer srv.Close()
	u, _ := url.Parse(srv.URL)
	root := homelab(t, "NTFY_READ_TOKEN=tk_read\nNTFY_PORT="+u.Port()+"\n")
	events, err := RecentAlerts(ctx, root)
	if err != nil || len(events) != 1 || events[0].Message != "vikunja updated" || auth != "Bearer tk_read" {
		t.Fatalf("%v %v %q", events, err, auth)
	}
}

func TestDuplicatiJobsWithDuplicatiDown(t *testing.T) {
	root := homelab(t, "DUPLICATI_PORT=1\n")
	if _, err := DuplicatiJobs(context.Background(), root); err == nil {
		t.Fatal("jobs from a Duplicati that is not there")
	}
}

func TestOpenAndReveal(t *testing.T) {
	oldGOOS, oldStart := goos, start
	t.Cleanup(func() { goos, start = oldGOOS, oldStart })
	var got [][]string
	start = func(c *exec.Cmd) error { got = append(got, c.Args); return nil }
	path := filepath.Join("home", "me", "Homelab", "report.html")
	for _, c := range []struct {
		goos         string
		open, reveal []string
	}{
		{"darwin", []string{"open", path}, []string{"open", "-R", path}},
		{"windows", []string{"rundll32", "url.dll,FileProtocolHandler", path}, []string{"explorer", "/select," + path}},
		{"linux", []string{"xdg-open", path}, []string{"xdg-open", filepath.Dir(path)}},
	} {
		goos, got = c.goos, nil
		if OpenFile(path) != nil || Reveal(path) != nil {
			t.Fatal("start failed")
		}
		if !slices.Equal(got[0], c.open) || !slices.Equal(got[1], c.reveal) {
			t.Errorf("%s: %q", c.goos, got)
		}
	}
}

func TestCLI(t *testing.T) {
	oldExe := executable
	t.Cleanup(func() { executable = oldExe })
	app := t.TempDir()
	name := "homelab"
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	bundled := filepath.Join(app, name)
	os.WriteFile(bundled, nil, 0o755)
	executable = func() (string, error) { return filepath.Join(app, "homelab-wizard"), nil }
	if bundledCLI() != bundled {
		t.Fatalf("bundled CLI %q", bundledCLI())
	}

	// A folder the app made runs the CLI the app ships.
	root := t.TempDir()
	os.WriteFile(filepath.Join(root, kit.ManifestName), []byte(`{"version":"0.9","commit":"abc"}`), 0o644)
	c := CLI(root, "status", "--json")
	if c.Args[0] != bundled || !slices.Equal(c.Args[1:], []string{"--root", root, "status", "--json", "--no-color"}) || c.Dir != root {
		t.Fatalf("a made folder: %q in %s", c.Args, c.Dir)
	}

	// A checkout with Go builds its own through its launcher.
	checkout := t.TempDir()
	launcher := filepath.Join(checkout, "homelab")
	if runtime.GOOS == "windows" {
		launcher += ".cmd"
	}
	os.WriteFile(launcher, nil, 0o755)
	c = CLI(checkout, "status")
	if _, err := exec.LookPath("go"); err == nil && c.Args[0] != launcher {
		t.Fatalf("a checkout: %q", c.Args)
	}

	// No bundled CLI (a source build): the launcher, whatever the folder.
	executable = func() (string, error) { return "", errors.New("no") }
	if bundledCLI() != "" {
		t.Fatal("a bundled CLI without a program")
	}
}

// After the app replaced itself (an AppImage's update), the jobs' copy of
// the CLI in the folder is the previous release's; schedule install copies
// the new one again.
func TestJobsCLIBehind(t *testing.T) {
	oldExe := executable
	t.Cleanup(func() { executable = oldExe })
	app := t.TempDir()
	name := "homelab"
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	os.WriteFile(filepath.Join(app, name), []byte("new build"), 0o755)
	executable = func() (string, error) { return filepath.Join(app, "homelab-wizard"), nil }

	root := t.TempDir()
	copied := filepath.Join(root, "bin", name)
	os.MkdirAll(filepath.Dir(copied), 0o755)
	os.WriteFile(copied, []byte("old build"), 0o755)
	if JobsCLIBehind(root) {
		t.Error("a folder the app did not make (a checkout) is behind")
	}
	os.WriteFile(filepath.Join(root, kit.ManifestName), []byte(`{"version":"0.9","commit":"abc"}`), 0o644)
	if !JobsCLIBehind(root) {
		t.Error("the jobs' copy of the previous release is not behind")
	}
	os.WriteFile(copied, []byte("new build"), 0o755)
	if JobsCLIBehind(root) {
		t.Error("the same CLI is behind")
	}
	os.Remove(copied)
	if JobsCLIBehind(root) {
		t.Error("no copy (the jobs run the app's own CLI) is behind")
	}
}

func TestFixPath(t *testing.T) {
	away(t)
	t.Setenv("PATH", filepath.Join(t.TempDir(), "bin"))
	FixPath()
	first := os.Getenv("PATH")
	FixPath()
	if os.Getenv("PATH") != first {
		t.Fatalf("a second FixPath added again:\n%s\n%s", first, os.Getenv("PATH"))
	}
	dirs := filepath.SplitList(first)
	seen := map[string]bool{}
	for _, d := range dirs {
		if seen[d] {
			t.Errorf("%s twice", d)
		}
		seen[d] = true
	}
}

func TestLastCrash(t *testing.T) {
	root := t.TempDir()
	if LastCrash(root) != nil || CrashSeen(root) != nil {
		t.Fatal("a crash where there is none")
	}
	logs := filepath.Join(root, "scripts", "logs")
	os.MkdirAll(logs, 0o755)
	when := time.Now().Add(-time.Hour).UTC().Truncate(time.Second)
	log := "== the app 0.9.7-beta, started " + when.Add(-time.Minute).Format(time.RFC3339) + ", process 1\nstopped unexpectedly " + when.Format(time.RFC3339) + "\n\npanic: oops\n"
	os.WriteFile(filepath.Join(logs, "crash-"+when.Format("2006-01-02")+".log"), []byte(log), 0o644)
	c := LastCrash(root)
	if c == nil || c.Who != "the app" || !c.When.Equal(when) {
		t.Fatalf("%+v", c)
	}
	if err := CrashSeen(root); err != nil {
		t.Fatal(err)
	}
	if LastCrash(root) != nil {
		t.Fatal("a crash waved away is shown again")
	}

	old := filepath.Join(t.TempDir(), "scripts", "logs")
	os.MkdirAll(old, 0o755)
	long := time.Now().AddDate(0, 0, -20).UTC().Truncate(time.Second)
	os.WriteFile(filepath.Join(old, "crash-"+long.Format("2006-01-02")+".log"), []byte(strings.ReplaceAll(log, when.Format(time.RFC3339), long.Format(time.RFC3339))), 0o644)
	if LastCrash(filepath.Dir(filepath.Dir(old))) != nil {
		t.Fatal("a crash three weeks old is shown")
	}
}

// Setup's checklist for a machine with no homelab folder yet, and for one
// with the baseline running.
func TestSetup(t *testing.T) {
	away(t)
	withDocker(t, &runner{FakeRunner: &docker.FakeRunner{}})
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if steps := Setup(ctx, filepath.Join(t.TempDir(), "Homelab")); len(steps) == 0 {
		t.Fatal("no steps before the folder exists")
	}
	if steps := Setup(ctx, homelab(t, "")); len(steps) == 0 {
		t.Fatal("no steps for a new homelab")
	}
}
