package docker

import (
	"context"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// scripted answers each command by its first words, and records them.
type scripted struct {
	out   map[string]string
	err   map[string]error
	calls []string
}

func (s *scripted) answer(args []string) (string, error) {
	all := strings.Join(args, " ")
	s.calls = append(s.calls, all)
	for prefix, err := range s.err {
		if strings.HasPrefix(all, prefix) {
			return "", err
		}
	}
	for prefix, out := range s.out {
		if strings.HasPrefix(all, prefix) {
			return out, nil
		}
	}
	return "", nil
}

func (s *scripted) Output(_ context.Context, _ string, args ...string) ([]byte, error) {
	out, err := s.answer(args)
	return []byte(out), err
}

func (s *scripted) Stream(_ context.Context, _, _ string, args ...string) error {
	_, err := s.answer(args)
	return err
}

func (s *scripted) Pipe(_ context.Context, w io.Writer, _ string, args ...string) error {
	out, err := s.answer(args)
	_, _ = w.Write([]byte(out))
	return err
}

func TestInfoAndRuntime(t *testing.T) {
	ctx := context.Background()
	c := &Client{Runner: &FakeRunner{}, Bin: "docker"}
	info, err := c.Info(ctx)
	if err != nil || info.ServerVersion != "27.0.0" || info.Runtime() != "OrbStack" {
		t.Fatalf("%+v %v", info, err)
	}
	if _, err := (&Client{Runner: &FakeRunner{InfoErr: errors.New("Cannot connect")}, Bin: "docker"}).Info(ctx); err == nil {
		t.Error("an engine that is not running")
	}
	if _, err := (&Client{Runner: &FakeRunner{InfoJSON: "not json"}, Bin: "docker"}).Info(ctx); err == nil || !strings.Contains(err.Error(), "docker info") {
		t.Errorf("unreadable info: %v", err)
	}
	if got := (Info{OperatingSystem: "Docker Desktop"}).Runtime(); got != "Docker Desktop" {
		t.Errorf("Docker Desktop: %q", got)
	}
	if got := (Info{}).Runtime(); runtime.GOOS != "linux" && got != "unknown" {
		t.Errorf("nothing said: %q", got)
	}
	if got := (Info{Name: "colima", OperatingSystem: "Ubuntu 24.04"}).Runtime(); got != "Colima" {
		t.Errorf("colima: %q", got)
	}
	if got := (Info{OperatingSystem: "Ubuntu 24.04.5 LTS"}).Runtime(); runtime.GOOS == "linux" && got != "Docker Engine" {
		t.Errorf("Docker Engine on Linux names the host's system, not itself: %q", got)
	}
}

func TestClientCommands(t *testing.T) {
	ctx := context.Background()
	s := &scripted{out: map[string]string{
		"system df":       `{"Type":"Images","Size":"2GB","Reclaimable":"1GB (50%)"}` + "\n",
		"compose version": "2.40.3\n",
		"stats":           `{"Name":"a","CPUPerc":"12.5%","MemUsage":"100MiB / 2GiB"}` + "\n",
		"compose --project-directory /h -f /h/compose.yaml -p homelab_core --profile * config --hash *": "ntfy abc\nvaultwarden def\n",
	}, err: map[string]error{"compose --progress json ls": errors.New("unknown flag --progress")}}
	c := &Client{Runner: s, Bin: "docker"}
	if u, err := c.DiskUsage(ctx); err != nil || len(u) != 1 || u[0].Unused() != "1GB" {
		t.Errorf("DiskUsage %v %v", u, err)
	}
	if v, err := c.ComposeVersion(ctx); v != "2.40.3" || err != nil {
		t.Errorf("ComposeVersion %q %v", v, err)
	}
	if st, err := c.Stats(ctx); err != nil || len(st) != 1 {
		t.Errorf("Stats %v %v", st, err)
	}
	if c.JSONProgress(ctx) {
		t.Error("a Compose that refuses --progress json")
	}
	p := Project{Dir: "/h", ComposeFile: "/h/compose.yaml", EnvFile: filepath.Join(t.TempDir(), "none"), Name: "homelab_core"}
	if h, err := c.ConfigHashes(ctx, p); err != nil || h["ntfy"] != "abc" || h["vaultwarden"] != "def" {
		t.Errorf("ConfigHashes %v %v", h, err)
	}
	_ = c.Tag(ctx, "sha256:1", "ntfy:before")
	_ = c.RemoveImage(ctx, "ntfy:before")
	_ = c.PruneDangling(ctx)
	_, _ = c.Exec(ctx, "ntfy", "ntfy", "user", "list")
	_, _ = c.ExecEnv(ctx, "db", []string{"PGPASSWORD"}, "psql")
	_ = c.ExecTo(ctx, &strings.Builder{}, "db", "pg_dumpall")
	_ = c.RunTo(ctx, &strings.Builder{}, "-v", "x:/data:ro", "alpine:3", "tar", "czf", "-")
	c.Progress = "json"
	_ = c.Compose(ctx, p, []string{"optional"}, "up", "--detach", "ntfy")
	got := strings.Join(s.calls, "\n")
	for _, want := range []string{
		"image tag sha256:1 ntfy:before", "image rm ntfy:before", "image prune --force",
		"exec ntfy ntfy user list", "exec -e PGPASSWORD db psql", "exec db pg_dumpall",
		"run --rm --cpu-shares 256 -v x:/data:ro alpine:3 tar czf -",
		"compose --progress json --project-directory /h -f /h/compose.yaml -p homelab_core --profile optional up --detach ntfy",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("no %q among:\n%s", want, got)
		}
	}
	if strings.Contains(got, "--env-file") {
		t.Error("an env file that is not there is not passed")
	}
	env := filepath.Join(t.TempDir(), ".env")
	_ = os.WriteFile(env, nil, 0o600)
	p.EnvFile = env
	if args := strings.Join(p.ComposeArgs(nil), " "); !strings.Contains(args, "--env-file "+env) {
		t.Errorf("ComposeArgs %s", args)
	}
	s.err = map[string]error{"system df": errors.New("down"), "stats": errors.New("down"), "compose --project-directory": errors.New("down")}
	if _, err := c.DiskUsage(ctx); err == nil {
		t.Error("DiskUsage with the engine down")
	}
	if _, err := c.Stats(ctx); err == nil {
		t.Error("Stats with the engine down")
	}
	if _, err := c.ConfigHashes(ctx, p); err == nil {
		t.Error("ConfigHashes with the engine down")
	}
}

func TestContainersNetworksAndEvents(t *testing.T) {
	ctx := context.Background()
	f := &FakeRunner{Containers: []FakeContainer{{Name: "homelab_security-ntfy-1", Image: "binwiederhier/ntfy", Running: true, Health: "healthy", Project: "homelab_security", Service: "ntfy"}},
		Events:    []string{`{"Action":"start","Actor":{"ID":"1","Attributes":{"com.docker.compose.service":"ntfy"}}}`, `{"Action":"exec_start: sh","Actor":{"ID":"1"}}`, `not json`, `{"Action":"die","Actor":{"ID":"2","Attributes":{"name":"loose"}}}`},
		EventsErr: errors.New("engine stopped")}
	c := &Client{Runner: f, Bin: "docker"}
	cs, err := c.Containers(ctx)
	if err != nil || len(cs) != 1 || cs[0].Service() != "ntfy" || cs[0].Project() != "homelab_security" || cs[0].Health != "healthy" {
		t.Fatalf("Containers %+v %v", cs, err)
	}
	if none, err := (&Client{Runner: &FakeRunner{}, Bin: "docker"}).Containers(ctx); none != nil || err != nil {
		t.Errorf("no containers: %v %v", none, err)
	}
	if made, err := c.EnsureNetwork(ctx, "homelab"); !made || err != nil {
		t.Errorf("the first time it is made: %v %v", made, err)
	}
	if made, err := c.EnsureNetwork(ctx, "homelab"); made || err != nil {
		t.Errorf("the second time it is there: %v %v", made, err)
	}
	var seen []string
	err = c.Events(ctx, func(e Event) { seen = append(seen, e.Action+" "+e.Service()) })
	if err == nil || strings.Join(seen, ",") != "start ntfy,die loose" {
		t.Errorf("events %v (health check execs and unreadable lines left out), end %v", seen, err)
	}
	if !strings.Contains(strings.Join(f.Calls, "\n"), "events --format {{json .}} --filter type=container --filter event=create") {
		t.Errorf("events asked for: %v", f.Calls)
	}
}

func TestSplittersAndErrors(t *testing.T) {
	var lines []string
	l := &lineSplitter{line: func(b []byte) { lines = append(lines, string(b)) }}
	_, _ = l.Write([]byte("one\ntw"))
	_, _ = l.Write([]byte("o\n\n  \nthree"))
	if strings.Join(lines, ",") != "one,two" {
		t.Errorf("lines %v (an unfinished one waits)", lines)
	}
	tb := &tailBuffer{max: 5}
	_, _ = tb.Write([]byte("abc"))
	_, _ = tb.Write([]byte("defg"))
	if tb.String() != "cdefg" {
		t.Errorf("tail %q", tb.String())
	}
	e := Explained{Msg: "Docker Desktop is not running", Err: errors.New("permission denied while trying to connect to the docker API")}
	if e.Error() != "Docker Desktop is not running" || !NoAccess(e) {
		t.Error("Explained keeps the engine's own error underneath")
	}
}

func TestExecRunnerAndFindCLI(t *testing.T) {
	ctx := context.Background()
	goBin, err := exec.LookPath("go")
	if err != nil {
		t.Skip("go is not on PATH")
	}
	r := ExecRunner{}
	if out, err := r.Output(ctx, goBin, "env", "GOOS"); err != nil || strings.TrimSpace(string(out)) != runtime.GOOS {
		t.Errorf("Output %q %v", out, err)
	}
	if _, err := r.Output(ctx, goBin, "no-such-command"); err == nil || !strings.Contains(err.Error(), "go no-such-command") {
		t.Errorf("a failed command names itself: %v", err)
	}
	var out strings.Builder
	if err := (ExecRunner{Stdout: &out, Stderr: &out}).Stream(ctx, t.TempDir(), goBin, "env", "GOARCH"); err != nil || strings.TrimSpace(out.String()) != runtime.GOARCH {
		t.Errorf("Stream %q %v", out.String(), err)
	}
	if err := (ExecRunner{Stdout: &out, Stderr: &out}).Stream(ctx, t.TempDir(), goBin, "no-such-command"); err == nil {
		t.Error("Stream of a failing command")
	}

	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv("PATH", "")
	t.Setenv("ProgramFiles", filepath.Join(home, "none"))
	// With none in the home folder, only the system's own places are left.
	if p, err := FindCLI(); err == nil && strings.HasPrefix(p, home) {
		t.Errorf("found %s in an empty home folder", p)
	} else if err != nil && !errors.Is(err, ErrNoDocker) {
		t.Errorf("no docker anywhere: %v", err)
	}
	orb := filepath.Join(home, ".orbstack", "bin", "docker")
	_ = os.MkdirAll(filepath.Dir(orb), 0o755)
	_ = os.WriteFile(orb, []byte("#!/bin/sh\n"), 0o755)
	if p, err := FindCLI(); err != nil || p != orb {
		t.Errorf("OrbStack's docker, missing from PATH when opened from Finder: %q %v", p, err)
	}
	if c, err := New(); err != nil || c.Bin != orb {
		t.Errorf("New: %+v %v", c, err)
	}
}
