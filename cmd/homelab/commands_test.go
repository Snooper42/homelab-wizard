package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/appicon"
	"github.com/Snooper42/homelab-wizard/internal/board"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/kit"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// gitRepo makes root a git checkout of origin (a bare repository) with one
// commit, and returns a clone to push newer commits from.
func gitRepo(t *testing.T, root string) (git func(dir string, args ...string), dev string) {
	t.Helper()
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed")
	}
	git = func(dir string, args ...string) {
		t.Helper()
		cmd := exec.Command("git", append([]string{"-C", dir, "-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false"}, args...)...)
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
	}
	origin, dev := filepath.Join(t.TempDir(), "origin.git"), filepath.Join(t.TempDir(), "dev")
	git(root, "init", "--bare", "-b", "main", origin)
	git(root, "init", "-q", "-b", "main")
	git(root, "add", "compose.yaml", "VERSION")
	git(root, "commit", "-q", "-m", "First")
	git(root, "remote", "add", "origin", origin)
	git(root, "push", "-q", "-u", "origin", "main")
	git(root, "clone", "-q", origin, dev)
	return git, dev
}

// An upgrade with --apply takes the new commit and runs the new version's
// migrate and up; --back returns to where it was.
func TestUpgradeAppliesThenGoesBack(t *testing.T) {
	calls := fakeDocker(t, nil)
	t.Setenv(asCLI, "1")
	root, _ := repoCopy(t)
	git, dev := gitRepo(t, root)
	os.MkdirAll(filepath.Join(dev, "docs"), 0o755)
	os.WriteFile(filepath.Join(dev, "docs", "New.md"), []byte("# New\n"), 0o644)
	git(dev, "add", ".")
	git(dev, "commit", "-q", "-m", "Docs: a new page (#12)")
	git(dev, "push", "-q", "origin", "main")

	out, code := homelabCmd(t, root, "", "upgrade", "--apply")
	if code != 0 || !strings.Contains(out, "now at origin/main") {
		t.Fatalf("upgrade --apply (exit %d):\n%s", code, out)
	}
	if _, err := os.Stat(filepath.Join(root, "docs", "New.md")); err != nil {
		t.Fatal("the new commit's file is not there")
	}
	if log := readCalls(t, calls); !strings.Contains(log, "up --detach") {
		t.Fatalf("the new version's up did not run:\n%s", log)
	}
	out, code = homelabCmd(t, root, "", "upgrade")
	if code != 0 || !strings.Contains(out, "up to date with origin/main") {
		t.Fatalf("after the upgrade (exit %d):\n%s", code, out)
	}

	out, code = homelabCmd(t, root, "", "upgrade", "--back", "--apply")
	if code != 0 || !strings.Contains(out, "back at") {
		t.Fatalf("upgrade --back (exit %d):\n%s", code, out)
	}
	if _, err := os.Stat(filepath.Join(root, "docs", "New.md")); err == nil {
		t.Fatal("still on the new commit after going back")
	}
}

func TestUpgradeBackWithNothingToGoBackTo(t *testing.T) {
	root, _ := repoCopy(t)
	if out, code := homelabCmd(t, root, "", "upgrade", "--back"); code == 0 || !strings.Contains(out, "no earlier version") {
		t.Fatalf("exit %d:\n%s", code, out)
	}
}

func TestKitCommand(t *testing.T) {
	root, _ := repoCopy(t)
	git, _ := gitRepo(t, root)
	if out, code := homelabCmd(t, root, "", "kit"); code != 0 || !strings.Contains(out, "is a git checkout") {
		t.Fatalf("kit in a checkout (exit %d):\n%s", code, out)
	}
	v1 := filepath.Join(t.TempDir(), kit.FileName)
	if out, code := homelabCmd(t, root, "", "kit", "pack", "-o", v1, "--commit", "aaaaaaaaaa1"); code != 0 || !strings.Contains(out, "from aaaaaaa") {
		t.Fatalf("kit pack (exit %d):\n%s", code, out)
	}
	if out, code := homelabCmd(t, root, "", "kit", "update", v1); code == 0 || !strings.Contains(out, "homelab upgrade") {
		t.Fatalf("kit update in a checkout (exit %d):\n%s", code, out)
	}

	made := filepath.Join(t.TempDir(), "Homelab")
	if _, err := kit.Extract(v1, made); err != nil {
		t.Fatal(err)
	}
	os.WriteFile(filepath.Join(made, ".env.example"), []byte("TZ=UTC\n"), 0o644)
	if out, code := homelabCmd(t, made, "", "kit"); code != 0 || !strings.Contains(out, "made by the desktop app from kit aaaaaaa") {
		t.Fatalf("kit in a made folder (exit %d):\n%s", code, out)
	}
	if out, code := homelabCmd(t, made, "", "kit", "update", v1); code != 0 || !strings.Contains(out, "already at kit aaaaaaa") {
		t.Fatalf("the same kit (exit %d):\n%s", code, out)
	}

	os.WriteFile(filepath.Join(root, "VERSION"), []byte("9.9.9\n"), 0o644)
	git(root, "commit", "-q", "-am", "A new version")
	v2 := filepath.Join(t.TempDir(), kit.FileName)
	if out, code := homelabCmd(t, root, "", "kit", "pack", "-o", v2, "--commit", "bbbbbbbbbb2"); code != 0 {
		t.Fatalf("kit pack (exit %d):\n%s", code, out)
	}
	if out, code := homelabCmd(t, made, "", "kit", "update", v2); code != 0 || !strings.Contains(out, "Preview only") {
		t.Fatalf("kit update without --apply (exit %d):\n%s", code, out)
	}
	out, code := homelabCmd(t, made, "", "kit", "update", v2, "--apply")
	if code != 0 || !strings.Contains(out, "updated to kit bbbbbbb") || !strings.Contains(out, "VERSION: updated") {
		t.Fatalf("kit update --apply (exit %d):\n%s", code, out)
	}
	for _, args := range [][]string{{"kit", "update"}, {"kit", "melt"}} {
		if _, code := homelabCmd(t, made, "", args...); code == 0 {
			t.Errorf("%q succeeded", args)
		}
	}
	if out, code := homelabCmd(t, t.TempDir(), "", "kit", "pack", "-o", v2); code == 0 && !strings.Contains(out, "git checkout") {
		t.Errorf("kit pack outside a checkout (exit %d):\n%s", code, out)
	}
}

func TestWire(t *testing.T) {
	fakeDocker(t, nil)
	root, _ := repoCopy(t)
	if out, code := homelabCmd(t, root, "", "wire"); code != 0 || !strings.Contains(out, "Nothing to connect") {
		t.Fatalf("nothing running (exit %d):\n%s", code, out)
	}
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_media_automation-sonarr-1", Image: "lscr.io/linuxserver/sonarr", Running: true, Project: "homelab_media_automation", Service: "sonarr"},
		{Name: "homelab_media_automation-prowlarr-1", Image: "lscr.io/linuxserver/prowlarr", Running: true, Project: "homelab_media_automation", Service: "prowlarr"},
	})
	out, code := homelabCmd(t, root, "", "wire")
	if code != 0 || !strings.Contains(out, "Connect apps") || !strings.Contains(out, "Preview only") {
		t.Fatalf("a preview (exit %d):\n%s", code, out)
	}
	// The apps' own APIs are not there, so each link says why it failed.
	var buf strings.Builder
	h, err := newHomelab(&ui.UI{Out: &buf}, root)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := h.wire(ctx, []string{"--apply"}); err == nil || !strings.Contains(err.Error(), "link(s) failed") {
		t.Fatalf("--apply without the apps' APIs: %v\n%s", err, buf.String())
	}
	out, _ = homelabCmd(t, root, "", "--json", "wire")
	if !strings.Contains(out, `"type":"wiring"`) {
		t.Fatalf("--json:\n%s", out)
	}
}

// Docker in the home folder is set up only on Linux, as the user; where
// Docker already answers there is nothing to do.
func TestRuntimeInstall(t *testing.T) {
	fakeDocker(t, nil)
	var out strings.Builder
	u := &ui.UI{Out: &out}
	if err := runtimeCmd(context.Background(), u, nil); err == nil || !strings.Contains(err.Error(), "usage") {
		t.Fatalf("no subcommand: %v", err)
	}
	err := runtimeCmd(context.Background(), u, []string{"install"})
	me, _ := user.Current()
	switch {
	case runtime.GOOS != "linux":
		if err == nil || !strings.Contains(err.Error(), "only on Linux") {
			t.Fatalf("%s: %v", runtime.GOOS, err)
		}
	case me != nil && me.Uid == "0":
		if err == nil || !strings.Contains(err.Error(), "not as root") {
			t.Fatalf("as root: %v", err)
		}
	default:
		if err != nil || !strings.Contains(out.String(), "Docker is already running here") {
			t.Fatalf("with Docker answering: %v\n%s", err, out.String())
		}
	}
}

// The phone's methods, each as a paired phone calls it.
func TestPhoneMethods(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-ntfy-1", Image: "binwiederhier/ntfy", Running: true, Project: "homelab_security", Service: "ntfy"},
	})
	t.Setenv(asCLI, "1")
	root, _ := repoCopy(t, "NTFY_PORT=1")
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	methods := h.phoneMethods()
	ctx := context.Background()
	call := func(name string, args ...any) (any, []string, error) {
		t.Helper()
		var raw []json.RawMessage
		for _, a := range args {
			b, _ := json.Marshal(a)
			raw = append(raw, b)
		}
		m, ok := methods[name]
		if !ok {
			t.Fatalf("no method %s", name)
		}
		return m.Call(ctx, raw)
	}
	for _, name := range []string{"Host", "Screen", "Catalog", "Status", "Backups", "Watchdog", "SavingsHistory"} {
		if v, _, err := call(name); err != nil || v == nil {
			t.Errorf("%s: %v %v", name, v, err)
		}
	}
	// Status with its cards in one answer: the result, then each card, the
	// ones the phone does not show saying so.
	var got []string
	var st any
	methods["StatusBoard"].Stream(ctx, []json.RawMessage{json.RawMessage(`4`), json.RawMessage(`["watchdog","savings","storage"]`)},
		func(v any, err error) { st = v; got = append(got, fmt.Sprint("result ", err)) },
		func(name string, data any) {
			c := data.(board.Card)
			got = append(got, fmt.Sprint(name, " ", c.Board, " ", c.Name, " ", c.Error))
		})
	sort.Strings(got[1:])
	if st == nil || strings.Join(got, "; ") != "result <nil>; status:card 4 savings ; status:card 4 storage not read here; status:card 4 watchdog " {
		t.Errorf("StatusBoard: %q", got)
	}
	// No agent serves this homelab: no last reading, and no error either.
	if v, _, err := call("LastStatus"); err != nil || v != nil {
		t.Errorf("LastStatus without an agent: %v %v", v, err)
	}
	// An app's icon: only the one the app on this machine kept.
	if v, _, err := call("AppIcon", "vikunja"); err != nil || v != "" {
		t.Errorf("AppIcon with none kept: %v %v", v, err)
	}
	_ = os.MkdirAll(filepath.Dir(appicon.Path(root, "vikunja")), 0o755)
	if err := os.WriteFile(appicon.Path(root, "vikunja"), []byte("GIF89a......"), 0o644); err != nil {
		t.Fatal(err)
	}
	if v, _, err := call("AppIcon", "vikunja"); err != nil || !strings.HasPrefix(v.(string), "data:image/gif;base64,") {
		t.Errorf("AppIcon kept: %v %v", v, err)
	}
	if v, _, _ := call("Host"); !v.(phoneHost).RuntimeOK {
		t.Error("Host: the runtime answers, but not OK")
	}
	for _, name := range []string{"DuplicatiJobs", "Alerts", "Protection"} {
		if _, _, err := call(name); err == nil {
			t.Errorf("%s: no error with nothing to read", name)
		}
	}
	for _, c := range []struct {
		name string
		args []any
		want string
	}{
		{"Logs", []any{"nothing-like-it"}, "unknown app"},
		{"SetUpdatesPaused", nil, "true or false"},
		{"AppAction", []any{"ntfy"}, "an app and an action"},
		{"AppAction", []any{"ntfy", "delete"}, "unknown action"},
		{"AppAction", []any{"nothing-like-it", "start"}, "unknown app"},
		{"Homelab", []any{"uninstall"}, "not on the phone"},
		{"Homelab", []any{"remove", "ntfy", true}, "not on the phone"},
		{"SetAppSetting", []any{"ntfy"}, "an app, a setting"},
		{"SetAppSetting", []any{"ntfy", "colour", true}, "unknown setting"},
		{"SetAppSetting", []any{"nothing-like-it", "alerts", true}, "unknown app"},
	} {
		if _, _, err := call(c.name, c.args...); err == nil || !strings.Contains(err.Error(), c.want) {
			t.Errorf("%s %v: %v, want %q", c.name, c.args, err, c.want)
		}
	}
	// What a phone that may make changes runs: the CLI, as a separate run.
	_, log, err := call("AppAction", "ntfy", "restart")
	if err != nil || len(log) == 0 || log[0] != "$ homelab restart ntfy" {
		t.Fatalf("restart: %v %q", err, log)
	}
	if v, _, err := call("Logs", "ntfy", 50); err != nil || v == nil {
		t.Fatalf("logs: %v %v", v, err)
	}
	if _, log, _ := call("Homelab", "fix"); len(log) == 0 || log[0] != "$ homelab fix" {
		t.Fatalf("fix: %q", log)
	}
	if _, log, _ := call("SetAppSetting", "ntfy", "alerts", false); len(log) == 0 || log[0] != "$ homelab notify off ntfy" {
		t.Fatalf("alerts off: %q", log)
	}
	if _, log, _ := call("SetAppSetting", "ntfy", "updates", true); len(log) == 0 || log[0] != "$ homelab updates release ntfy" {
		t.Fatalf("updates on: %q", log)
	}
}

func TestServe(t *testing.T) {
	root, _ := repoCopy(t, "PHONE_COMPANION=false")
	if out, code := homelabCmd(t, root, "", "serve"); code != 0 || !strings.Contains(out, "phone companion is off") {
		t.Fatalf("off (exit %d):\n%s", code, out)
	}
	root, _ = repoCopy(t, "LAN_BIND_IP=127.0.0.1")
	var out strings.Builder
	h, err := newHomelab(&ui.UI{Out: &out}, root)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()
	if err := h.serve(ctx, []string{"--port", "0"}); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out.String(), "phone companion on port 0") {
		t.Fatalf("%s", out.String())
	}
}

// homelabTTY is homelabCmd as typed in a terminal: it asks, and reads the
// answers from input.
func homelabTTY(t *testing.T, root, input string, args ...string) (string, int) {
	t.Helper()
	var out strings.Builder
	u := &ui.UI{Out: &out, In: bufio.NewReader(strings.NewReader(input)), Interactive: true}
	code := run(context.Background(), u, append([]string{"--root", root}, args...))
	return out.String(), code
}

// The everyday commands, each run once against the fake docker.
func TestCommandTour(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-ntfy-1", Image: "binwiederhier/ntfy", Running: true, Project: "homelab_security", Service: "ntfy"},
		{Name: "old-pihole", Image: "pihole/pihole", Running: true, Ports: []docker.PublishedPort{{HostPort: 8053, Port: 80, Protocol: "tcp"}}},
	})
	root, _ := repoCopy(t, "HOMELAB_DOMAIN=example.com", "LAN_BIND_IP=127.0.0.1")
	for _, c := range []struct {
		args []string
		want string
		ok   bool
	}{
		{[]string{"bundles"}, "@arr", true},
		{[]string{"detect"}, "homelab_security-ntfy-1", true},
		{[]string{"detect"}, "Other running containers", true},
		{[]string{"plan"}, "Start the homelab", true},
		{[]string{"plan", "jellyfin"}, "Install plan", true},
		{[]string{"compose", "ntfy", "ps"}, "", true},
		{[]string{"compose", "paperless", "ps"}, "", true},
		{[]string{"compose", "nothing-like-it", "ps"}, "no app or stack named", false},
		{[]string{"compose", "ntfy"}, "usage", false},
		{[]string{"domain"}, "usage", false},
		{[]string{"domain", "melt"}, "unknown domain command", false},
		{[]string{"domain", "status"}, "domain: example.com", true},
		{[]string{"domain", "resolver", "--ip", "10.0.0.5"}, "Preview only", true},
		{[]string{"install"}, "name the apps to install", false},
	} {
		out, code := homelabCmd(t, root, "", c.args...)
		if (code == 0) != c.ok || !strings.Contains(out, c.want) {
			t.Errorf("%q (exit %d), want %q:\n%s", c.args, code, c.want, out)
		}
	}
	if log := readCalls(t, calls); !strings.Contains(log, "-p homelab_security") || !strings.Contains(log, " ps") {
		t.Errorf("compose was not run in the app's project:\n%s", log)
	}
	if out, code := homelabCmd(t, repoCopyNoDomain(t), "", "domain", "status"); code != 0 || !strings.Contains(out, "No domain set") {
		t.Errorf("no domain (exit %d):\n%s", code, out)
	}
	if out, code := homelabCmd(t, repoCopyNoDomain(t), "", "domain", "resolver"); code == 0 || !strings.Contains(out, "no domain yet") {
		t.Errorf("a resolver with no domain (exit %d):\n%s", code, out)
	}
	// The undo reads this machine's own files: nothing there, or a
	// preview of taking it back (internal/domain tests both ways).
	for _, args := range [][]string{{"domain", "resolver", "--undo"}, {"domain", "resolver", "--undo", "old.example.org"}} {
		if out, code := homelabCmd(t, root, "", args...); code != 0 || !strings.Contains(out, "nothing of homelab's") && !strings.Contains(out, "Preview only") {
			t.Errorf("%q (exit %d):\n%s", args, code, out)
		}
	}

	// In a terminal: install with no apps named shows the picker; the
	// menu takes a number.
	out, code := homelabTTY(t, root, "jellyfin\nn\n", "install")
	if !strings.Contains(out, "Pick apps to install") || !strings.Contains(out, "Bundles:") {
		t.Errorf("the picker (exit %d):\n%s", code, out)
	}
	out, code = homelabTTY(t, root, "99\n2\n0\n", "menu")
	if code != 0 || !strings.Contains(out, "pick a number from the list") || !strings.Contains(out, "Quit") {
		t.Errorf("the menu (exit %d):\n%s", code, out)
	}
}

func repoCopyNoDomain(t *testing.T) string {
	root, _ := repoCopy(t)
	return root
}

func TestDocsCheck(t *testing.T) {
	_, file, _, _ := runtime.Caller(0)
	repo := filepath.Join(filepath.Dir(file), "..", "..")
	if out, code := homelabCmd(t, repo, "", "docs", "--check"); code != 0 {
		t.Fatalf("the docs are not up to date (exit %d): run go run ./cmd/homelab --root . docs\n%s", code, out)
	}
}

// Sign-ups, nightly updates, and the weekly summary, as the CLI shows them.
func TestUpdatesSignupsAndDigest(t *testing.T) {
	var published []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		published = append(published, r.URL.Path+" "+r.Header.Get("Title"))
	}))
	defer srv.Close()
	u, _ := url.Parse(srv.URL)
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-ntfy-1", Image: "binwiederhier/ntfy", Running: true, Project: "homelab_security", Service: "ntfy"},
		{Name: "homelab_security-watchtower-1", Image: "nickfedor/watchtower", Running: true, Project: "homelab_security", Service: "watchtower"},
	})
	root, _ := repoCopy(t, "NTFY_PORT="+u.Port(), "NTFY_PUBLISH_TOKEN=tk_pub")
	for _, c := range []struct {
		args []string
		want string
		ok   bool
	}{
		{[]string{"signups"}, "sign-ups are closed", true},
		{[]string{"updates"}, "Nightly updates run", true},
		{[]string{"--json", "updates"}, `"type":"updates"`, true},
		{[]string{"updates", "pause"}, "Preview only", true},
		{[]string{"updates", "pause", "--apply"}, "Nightly updates are paused", true},
		{[]string{"updates", "resume", "--apply"}, "Nightly updates run", true},
		{[]string{"updates", "notes"}, "usage", false},
		{[]string{"updates", "hold"}, "usage", false},
		{[]string{"updates", "hold", "nothing-like-it"}, "unknown container app", false},
		{[]string{"updates", "hold", "vaultwarden"}, "Vaultwarden is left out of nightly updates", true},
		{[]string{"updates", "release", "vaultwarden"}, "Vaultwarden is updated nightly again", true},
		{[]string{"updates", "melt"}, "unknown updates command", false},
		{[]string{"digest"}, "Homelab this week", true},
		{[]string{"--json", "digest"}, `"type":"digest"`, true},
		{[]string{"digest", "--send"}, "sent to tunnel-watchdog", true},
		{[]string{"duplicati"}, "usage", false},
		{[]string{"duplicati", "melt"}, "unknown duplicati command", false},
	} {
		out, code := homelabCmd(t, root, "", c.args...)
		if (code == 0) != c.ok || !strings.Contains(out, c.want) {
			t.Errorf("%q (exit %d), want %q:\n%s", c.args, code, c.want, out)
		}
	}
	// Status asks ntfy's page too; the summary is the one published.
	sent := 0
	for _, p := range published {
		if strings.HasPrefix(p, "/tunnel-watchdog Homelab this week") {
			sent++
		}
	}
	if sent != 1 {
		t.Errorf("published %q", published)
	}
}

// In a terminal, a question answered no changes nothing; and the homelab
// folder is found from where the command runs.
func TestAskedInATerminal(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-watchtower-1", Image: "nickfedor/watchtower", Running: true, Project: "homelab_security", Service: "watchtower"},
	})
	root, _ := repoCopy(t)
	out, code := homelabTTY(t, root, "n\n", "updates", "pause")
	if code == 0 || strings.Contains(readCalls(t, calls), "stop") {
		t.Fatalf("a no still paused (exit %d):\n%s\n%s", code, out, readCalls(t, calls))
	}
	if out, code := homelabTTY(t, root, "\n", "updates", "pause"); code != 0 || !strings.Contains(out, "paused") {
		t.Fatalf("Enter takes the default, yes (exit %d):\n%s", code, out)
	}

	sub := filepath.Join(root, "services", "media")
	os.MkdirAll(sub, 0o755)
	t.Chdir(sub)
	t.Setenv("HOMELAB_ROOT", "")
	var buf strings.Builder
	if code := run(context.Background(), &ui.UI{Out: &buf}, []string{"apps"}); code != 0 || !strings.Contains(buf.String(), "jellyfin") {
		t.Fatalf("apps from a folder inside the homelab (exit %d):\n%s", code, buf.String())
	}
	if got := findRoot(); mustReal(t, got) != mustReal(t, root) {
		t.Fatalf("found %q, want %q", got, root)
	}
}

func mustReal(t *testing.T, p string) string {
	t.Helper()
	r, err := filepath.EvalSymlinks(p)
	if err != nil {
		t.Fatal(err)
	}
	return r
}
