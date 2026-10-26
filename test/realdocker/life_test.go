//go:build realdocker

package realdocker

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

// realApp is an app the run installs: the page that must answer, and the
// data it puts in through the app's own API and reads back after the
// homelab is wiped and moved in again.
type realApp struct {
	id string
	// page is the path, under the app's address on this machine, that
	// answers once it is up (2xx, 3xx, or 401).
	page string
	// seed puts some data in; check reads it back. Either may be nil.
	seed  func(l *lab) error
	check func(l *lab) error
}

// apps are the run's apps, in the order they are checked. New catalog
// apps join here as they land, so each is shown to start and answer.
var apps = []realApp{
	// The small baseline a new household starts with (HOMELAB_BASELINE=small).
	{id: "ntfy", page: "/v1/health", seed: seedNtfy, check: checkNtfy},
	{id: "uptime-kuma", page: "/"},
	{id: "duplicati", page: "/"},
	// Then the apps the run installs.
	{id: "vaultwarden", page: "/alive", seed: seedVault, check: checkVault},
	{id: "paperless", page: "/api/", seed: seedPaperless, check: checkPaperless},
	{id: "nginx-proxy-manager", page: "/api/", seed: seedProxyHost, check: checkProxyHost},
	{id: "actual-budget", page: "/health", seed: seedActual, check: checkActual},
	{id: "beszel", page: "/api/health", seed: seedBeszel, check: checkBeszel},
	{id: "tandoor", page: "/", seed: seedTandoor, check: checkTandoor},
	{id: "linkwarden", page: "/", seed: seedLinkwarden, check: checkLinkwarden},
}

// chosen are the apps this run installs: all of them, or those named in
// REALDOCKER_APPS (comma-separated), for a machine that cannot reach
// every registry.
func chosen() []realApp {
	only := os.Getenv("REALDOCKER_APPS")
	if only == "" {
		return apps
	}
	var out []realApp
	for _, a := range apps {
		if slices.Contains(strings.Split(only, ","), a.id) {
			out = append(out, a)
		}
	}
	return out
}

// lab is the homelab folder the run works in, and the CLI built for it.
type lab struct {
	t    *testing.T
	root string
	bin  string
	// facts the seeds leave for the checks
	facts map[string]string
}

// newLab builds the CLI and makes a homelab folder from this checkout:
// the catalog, its files, and .env.example, as a clone has them.
func newLab(t *testing.T) *lab {
	repo, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	dir := os.Getenv("REALDOCKER_DIR")
	if dir == "" {
		dir = t.TempDir()
	}
	root := filepath.Join(dir, "Homelab")
	bin := filepath.Join(dir, "homelab")
	if runtime.GOOS == "windows" {
		bin += ".exe"
	}
	build := exec.Command("go", "build", "-o", bin, "./cmd/homelab")
	build.Dir = repo
	if out, err := build.CombinedOutput(); err != nil {
		t.Fatalf("building the CLI: %v\n%s", err, out)
	}
	for _, p := range []string{"compose.yaml", ".env.example", "VERSION", "CHANGELOG.md", "compose", "stacks", "config", "dockerfiles", "services", "docs"} {
		if err := copyTree(filepath.Join(repo, p), filepath.Join(root, p)); err != nil {
			t.Fatal(err)
		}
	}
	return &lab{t: t, root: root, bin: bin, facts: map[string]string{}}
}

func copyTree(from, to string) error {
	return filepath.Walk(from, func(p string, fi os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(from, p)
		dst := filepath.Join(to, rel)
		if fi.IsDir() {
			return os.MkdirAll(dst, 0o755)
		}
		data, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
			return err
		}
		return os.WriteFile(dst, data, fi.Mode().Perm())
	})
}

// try runs the CLI on the homelab, and returns what it printed.
func (l *lab) try(args ...string) (string, error) {
	l.t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
	defer cancel()
	c := exec.CommandContext(ctx, l.bin, append([]string{"--root", l.root, "--no-color"}, args...)...)
	c.Dir = l.root
	c.Env = append(os.Environ(), "HOMELAB_NO_BROWSER=1")
	out, err := c.CombinedOutput()
	l.t.Logf("$ homelab %s\n%s", strings.Join(args, " "), tail(string(out), 60))
	return string(out), err
}

// run is try, failing the test when the command fails.
func (l *lab) run(args ...string) string {
	l.t.Helper()
	out, err := l.try(args...)
	if err != nil {
		l.t.Fatalf("homelab %s: %v", strings.Join(args, " "), err)
	}
	return out
}

func tail(s string, n int) string {
	lines := strings.Split(strings.TrimRight(s, "\n"), "\n")
	if len(lines) > n {
		lines = append([]string{fmt.Sprintf("… (%d lines before)", len(lines)-n)}, lines[len(lines)-n:]...)
	}
	return strings.Join(lines, "\n")
}

// setEnv changes a setting in the homelab's .env.
func (l *lab) setEnv(key, value string) {
	l.t.Helper()
	f, err := envfile.Load(filepath.Join(l.root, ".env"))
	if err == nil {
		f.Set(key, value)
		err = f.Save()
	}
	if err != nil {
		l.t.Fatal(err)
	}
}

// env reads a setting from the homelab's .env.
func (l *lab) env(key string) string {
	f, err := os.Open(filepath.Join(l.root, ".env"))
	if err != nil {
		return ""
	}
	defer f.Close()
	s := bufio.NewScanner(f)
	for s.Scan() {
		if k, v, ok := strings.Cut(s.Text(), "="); ok && k == key {
			return strings.Trim(v, `"'`)
		}
	}
	return ""
}

// statusApp is one app in `homelab status --json`.
type statusApp struct {
	ID           string `json:"id"`
	State        string `json:"state"`
	Health       string `json:"health"`
	URL          string `json:"url"`
	NotAnswering string `json:"notAnswering"`
	Container    string `json:"container"`
}

func (l *lab) status() map[string]statusApp {
	l.t.Helper()
	out, err := l.try("status", "--json")
	if err != nil {
		l.t.Fatalf("status: %v", err)
	}
	var line struct {
		Data struct {
			Apps []statusApp `json:"apps"`
		} `json:"data"`
	}
	for _, s := range strings.Split(out, "\n") {
		if strings.HasPrefix(s, "{") && json.Unmarshal([]byte(s), &line) == nil && len(line.Data.Apps) > 0 {
			break
		}
	}
	m := map[string]statusApp{}
	for _, a := range line.Data.Apps {
		m[a.ID] = a
	}
	return m
}

// waitFor tries fn every few seconds until it succeeds or the time is up.
func waitFor(t *testing.T, what string, limit time.Duration, fn func() error) {
	t.Helper()
	deadline := time.Now().Add(limit)
	for {
		err := fn()
		if err == nil {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("%s: still not after %s: %v", what, limit, err)
		}
		time.Sleep(3 * time.Second)
	}
}

var web = &http.Client{Timeout: 10 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}

// answers asks a page and accepts any answer an app that is up gives.
func answers(url string) error {
	resp, err := web.Get(url)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode >= 500 {
		return fmt.Errorf("%s answered %s", url, resp.Status)
	}
	return nil
}

// up waits until each app runs, is not starting, and its page answers.
func (l *lab) up(as []realApp) {
	l.t.Helper()
	for _, a := range as {
		waitFor(l.t, a.id+" up and answering", 10*time.Minute, func() error {
			s, ok := l.status()[a.id]
			switch {
			case !ok:
				return errors.New("not in status")
			case s.State != "running":
				return fmt.Errorf("state %q", s.State)
			case s.Health == "starting" || s.Health == "unhealthy":
				return fmt.Errorf("health %q", s.Health)
			case s.URL == "":
				return nil
			}
			return answers(strings.TrimRight(s.URL, "/") + a.page)
		})
	}
}

// url is an app's address on this machine.
func (l *lab) url(id string) string {
	return strings.TrimRight(l.status()[id].URL, "/")
}

// request sends a JSON request and decodes the answer into out.
func request(method, url string, body any, out any, header ...string) error {
	var r io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		r = bytes.NewReader(data)
	}
	req, err := http.NewRequest(method, url, r)
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for i := 0; i+1 < len(header); i += 2 {
		req.Header.Set(header[i], header[i+1])
	}
	resp, err := web.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return fmt.Errorf("%s %s: %s %s", method, url, resp.Status, tail(string(data), 5))
	}
	if out != nil {
		return json.Unmarshal(data, out)
	}
	return nil
}

// requestText is request for an answer that is plain text.
func requestText(method, url string, body any, out *string) error {
	data, _ := json.Marshal(body)
	resp, err := web.Post(url, "application/json", bytes.NewReader(data))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	text, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return fmt.Errorf("%s %s: %s %s", method, url, resp.Status, tail(string(text), 5))
	}
	*out = string(text)
	return nil
}

// docker runs the docker CLI.
func docker(t *testing.T, args ...string) string {
	t.Helper()
	out, err := exec.Command("docker", args...).CombinedOutput()
	if err != nil {
		t.Fatalf("docker %s: %v\n%s", strings.Join(args, " "), err, out)
	}
	return strings.TrimSpace(string(out))
}

// container is an app's running container's name.
func (l *lab) container(id string) string {
	l.t.Helper()
	out := docker(l.t, "ps", "--filter", "label=com.docker.compose.service="+id, "--format", "{{.Names}}")
	name, _, _ := strings.Cut(out, "\n")
	if name == "" {
		l.t.Fatalf("no running container for %s", id)
	}
	return name
}

// TestAHomelabsLife is the nightly run: each step needs the ones before
// it, so the first failure ends the run, and the diagnostics report is
// kept for the artifact.
func TestAHomelabsLife(t *testing.T) {
	if _, err := exec.LookPath("docker"); err != nil {
		t.Fatal("docker is not installed")
	}
	l := newLab(t)
	as := chosen()
	ids := make([]string, len(as))
	for i, a := range as {
		ids[i] = a.id
	}
	t.Cleanup(func() {
		if t.Failed() {
			l.keepReport()
		}
		if os.Getenv("REALDOCKER_KEEP") == "" {
			_, _ = l.try("uninstall", "--data", "--apply")
		}
	})

	step := func(name string, fn func(t *testing.T)) {
		if !t.Run(name, func(t *testing.T) { l.t = t; fn(t) }) {
			t.FailNow()
		}
		l.t = t
	}

	// An older ntfy first, so the update below has a newer one to move to.
	step("an older ntfy to update from", func(t *testing.T) {
		if !slices.Contains(ids, "ntfy") {
			t.Skip("ntfy is not in this run")
		}
		docker(t, "pull", "binwiederhier/ntfy:"+ntfyOld)
		docker(t, "tag", "binwiederhier/ntfy:"+ntfyOld, "binwiederhier/ntfy:latest")
	})

	step("install", func(t *testing.T) {
		l.run(append([]string{"install"}, append(ids, "--apply")...)...)
		// A new household's homelab: up starts the small baseline, as in a
		// folder the desktop app made, not the full one a clone has.
		l.setEnv("HOMELAB_BASELINE", "small")
		// The media drive's folders, as a machine with its drive has
		// them: Duplicati waits for them, and move in checks they are
		// there before it unpacks onto them.
		for _, key := range []string{"MEDIA_ROOT", "DOWNLOADS_ROOT", "IMMICH_UPLOAD_LOCATION"} {
			if dir := l.env(key); dir != "" {
				if err := os.MkdirAll(dir, 0o755); err != nil {
					t.Fatal(err)
				}
			}
		}
		l.run("up", "--apply")
		l.up(as)
	})

	step("doctor", func(t *testing.T) {
		out := l.run("doctor")
		for _, line := range strings.Split(out, "\n") {
			if strings.Contains(line, "✗") && !doctorExpected(line) {
				t.Errorf("doctor: %s", strings.TrimSpace(line))
			}
		}
	})

	step("alerts set up", func(t *testing.T) {
		if !slices.Contains(ids, "ntfy") {
			t.Skip("ntfy is not in this run")
		}
		l.run("notify", "setup", "--apply")
		if l.env("NTFY_PUBLISH_TOKEN") == "" || l.env("NTFY_READ_TOKEN") == "" {
			t.Fatal("notify setup left no tokens in .env")
		}
		l.run("notify", "test")
		waitFor(t, "the test alert in ntfy", time.Minute, func() error { return l.alerted("") })
	})

	step("data in each app", func(t *testing.T) {
		for _, a := range as {
			if a.seed != nil {
				if err := a.seed(l); err != nil {
					t.Fatalf("%s: %v", a.id, err)
				}
			}
		}
	})

	step("the nightly backup", func(t *testing.T) {
		l.run("backup", "--apply")
		if slices.Contains(ids, "paperless") {
			dumps, _ := filepath.Glob(filepath.Join(l.root, "recovery-staging", "databases", "*paperless*"))
			if len(dumps) == 0 {
				t.Error("no Paperless dump in recovery-staging/databases")
			}
		}
	})

	step("the watchdog brings back what broke", func(t *testing.T) { l.watchdogCases(t, ids) })

	step("an update, then its rollback", func(t *testing.T) {
		if !slices.Contains(ids, "ntfy") {
			t.Skip("ntfy is not in this run")
		}
		before := l.image("ntfy")
		l.run("update", "ntfy", "--apply")
		l.up(as[:1])
		after := l.image("ntfy")
		if after == before {
			t.Fatalf("the update left ntfy on %s", before)
		}
		l.run("rollback", "ntfy", "--apply")
		l.up(as[:1])
		if back := l.image("ntfy"); back != before {
			t.Fatalf("the rollback put ntfy on %s, not %s", back, before)
		}
		l.run("updates", "release", "ntfy")
	})

	pack := filepath.Join(filepath.Dir(l.root), "homelab-move.tar")
	step("moved out", func(t *testing.T) {
		l.run("move", "out", "--to", pack, "--apply")
		if _, err := os.Stat(pack); err != nil {
			t.Fatal(err)
		}
	})

	step("wiped", func(t *testing.T) {
		l.run("uninstall", "--data", "--apply")
		for id, s := range l.status() {
			if slices.Contains(ids, id) && s.State != "missing" {
				t.Errorf("%s is %s after uninstall --data", id, s.State)
			}
		}
	})

	step("moved in, and the data is back", func(t *testing.T) {
		l.run("move", "in", pack, "--apply")
		l.up(as)
		for _, a := range as {
			if a.check != nil {
				if err := a.check(l); err != nil {
					t.Errorf("%s: %v", a.id, err)
				}
			}
		}
	})
}

// doctorExpected are the ✗ lines a fresh homelab on a CI runner has for
// reasons of its own (no domain, no jobs installed, no media drive).
func doctorExpected(line string) bool {
	for _, s := range []string{"MEDIA_ROOT", "media drive", "BACKUP_DESTINATION", "backup destination", "HEARTBEAT_URL"} {
		if strings.Contains(line, s) {
			return true
		}
	}
	return false
}

// image is the image ID ntfy's container runs.
func (l *lab) image(id string) string {
	return docker(l.t, "inspect", "--format", "{{.Image}}", l.container(id))
}

// keepReport makes the diagnostics report and copies it where the
// workflow uploads it from (REALDOCKER_ARTIFACTS).
func (l *lab) keepReport() {
	_, _ = l.try("report")
	dir := os.Getenv("REALDOCKER_ARTIFACTS")
	if dir == "" {
		return
	}
	_ = os.MkdirAll(dir, 0o755)
	reports, _ := filepath.Glob(filepath.Join(l.root, "scripts", "logs", "report-*.txt"))
	for _, r := range reports {
		if data, err := os.ReadFile(r); err == nil {
			_ = os.WriteFile(filepath.Join(dir, filepath.Base(r)), data, 0o644)
		}
	}
	logs, _ := filepath.Glob(filepath.Join(l.root, "scripts", "logs", "*.log"))
	for _, p := range logs {
		if data, err := os.ReadFile(p); err == nil {
			_ = os.WriteFile(filepath.Join(dir, filepath.Base(p)), data, 0o644)
		}
	}
}
