//go:build realdocker

package realdocker

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/setup"
)

// headscaleImage runs the fake tailnet: Headscale, an open-source server
// Tailscale's own client signs in to as it does to Tailscale's, so the
// homelab's Tailscale container runs unchanged, on a tailnet of this run's
// own, with no account and nothing reachable from outside.
const headscaleImage = "headscale/headscale:0.29.6"

// headscaleConfig is the fake tailnet's: its devices named
// <name>.fake-tailnet.test (RFC 2606's .test, which no one owns), and its
// own relay, as no device here reaches Tailscale's. It gives out no
// certificates, so the https addresses do not open; what Setup does with
// them is still all there.
const headscaleConfig = `server_url: http://headscale:8080
listen_addr: 0.0.0.0:8080
metrics_listen_addr: 127.0.0.1:9090
grpc_listen_addr: 127.0.0.1:50443
noise:
  private_key_path: /var/lib/headscale/noise_private.key
prefixes:
  v4: 100.64.0.0/10
  v6: fd7a:115c:a1e0::/48
derp:
  server:
    enabled: true
    region_id: 999
    region_code: fake
    region_name: Fake tailnet
    stun_listen_addr: 0.0.0.0:3478
    private_key_path: /var/lib/headscale/derp_server_private.key
    automatically_add_embedded_derp_region: true
  urls: []
  auto_update_enabled: false
disable_check_updates: true
database:
  type: sqlite
  sqlite:
    path: /var/lib/headscale/db.sqlite
policy:
  mode: file
  path: ""
dns:
  magic_dns: true
  base_domain: fake-tailnet.test
  override_local_dns: false
  nameservers:
    global: []
unix_socket: /var/run/headscale/headscale.sock
unix_socket_permission: "0770"
`

// TestHomeModeSetupWalked is a new household's first run in Home mode (no
// domain), with Tailscale's sign-in played by a fake tailnet: Setup's
// checklist walked from top to bottom by the CLI, as the Setup screen's
// Do the steps I can walks it. Every step the CLI can do must end done,
// and each one left must name the person's part (a box to tick, a setting,
// a choice, or a page to open). Then the test does the person's part and
// walks again, and every step must end done. REALDOCKER_HOME=1 runs it
// (the nightly workflow's home job); it installs the scheduled jobs on
// this machine, which systemd's user manager runs.
func TestHomeModeSetupWalked(t *testing.T) {
	if os.Getenv("REALDOCKER_HOME") == "" {
		t.Skip("REALDOCKER_HOME is not set")
	}
	l := newLab(t)
	ran := map[string]bool{}
	t.Cleanup(func() {
		if t.Failed() {
			l.keepReport()
		}
		_, _ = l.try("schedule", "remove", "--apply")
		if ran["awake"] {
			_, _ = l.try("awake", "allow", "--undo", "--apply")
		}
		_, _ = l.try("uninstall", "--data", "--apply")
	})
	key := fakeTailnet(t)

	// What a new household's folder starts with: the desktop app's small
	// baseline (HOMELAB_BASELINE=small), a folder for the media, and, in
	// place of signing in to Tailscale in the browser, a key from the
	// tailnet's own server.
	media := filepath.Join(filepath.Dir(l.root), "Media")
	if err := os.MkdirAll(media, 0o755); err != nil {
		t.Fatal(err)
	}
	env := strings.Join([]string{
		"HOMELAB_BASELINE=small",
		"MEDIA_ROOT=" + media,
		"TAILSCALE_AUTHKEY=" + key,
		"TAILSCALE_EXTRA_ARGS=--login-server=http://headscale:8080",
	}, "\n") + "\n"
	if err := os.WriteFile(filepath.Join(l.root, ".env"), []byte(env), 0o600); err != nil {
		t.Fatal(err)
	}

	steps := l.setupSteps()
	if s := find(steps, "started"); s.State != "todo" {
		t.Fatalf("a new folder's first step is %+v, not The homelab is started to do", s)
	}
	l.doTheSteps(ran)
	// The password manager, picked in Choose stacks (the small baseline
	// leaves it out), brings its own steps.
	l.run("install", "vaultwarden", "--apply")
	l.doTheSteps(ran)

	steps = l.setupSteps()
	for _, id := range []string{"started", "tailnet", "jobs"} {
		if s := find(steps, id); s.State != "done" {
			t.Errorf("%s is %s after Do the steps I can, not done: %s", id, s.State, s.Detail)
		}
	}
	if !strings.HasSuffix(l.env("TAILSCALE_HOST"), ".fake-tailnet.test") {
		t.Errorf("TAILSCALE_HOST=%q, not this machine's name on the fake tailnet", l.env("TAILSCALE_HOST"))
	}
	for _, s := range steps {
		if s.State == "done" {
			continue
		}
		if ran[s.ID] && !s.Manual {
			t.Errorf("%s ran, but is %s: %s", s.ID, s.State, s.Detail)
		}
		if s.State == "todo" && (s.Detail == "" || !s.Manual && len(s.Settings) == 0 && len(s.Choices) == 0 && s.Open == "") {
			t.Errorf("%s is left to do, but names nothing for the person to do: %+v", s.ID, s)
		}
	}
	t.Logf("after Do the steps I can: %s", summary(steps))
	if t.Failed() {
		return
	}

	// The person's part: the boxes only they can tick, the backup folder
	// they choose, and the outside check's address they paste in.
	backups := filepath.Join(filepath.Dir(l.root), "Backup drive")
	if err := os.MkdirAll(backups, 0o755); err != nil {
		t.Fatal(err)
	}
	for range 6 {
		did := false
		for _, s := range l.setupSteps() {
			if s.State != "todo" {
				continue
			}
			switch {
			case s.Manual:
				if err := setup.MarkDone(l.root, s.ID, true); err != nil {
					t.Fatal(err)
				}
			case s.ID == "backups":
				l.run("duplicati", "destination", backups, "--apply")
			case s.ID == "heartbeat":
				// Nothing answers there; the step needs the address only.
				l.setEnv("HEARTBEAT_URL", "http://127.0.0.1:9/ping/homelab")
			default:
				continue
			}
			did = true
		}
		l.doTheSteps(ran)
		if !did {
			break
		}
	}
	// Duplicati's jobs count once each has run; their first runs take a
	// while.
	waitFor(t, "every step of Setup done", 10*time.Minute, func() error {
		var left []string
		for _, s := range l.setupSteps() {
			if s.State != "done" {
				left = append(left, fmt.Sprintf("%s (%s: %s)", s.ID, s.State, s.Detail))
			}
		}
		if len(left) > 0 {
			return fmt.Errorf("left: %s", strings.Join(left, "; "))
		}
		return nil
	})
	t.Logf("after the person's part: %s", summary(l.setupSteps()))
}

// fakeTailnet starts the fake tailnet's server on the homelab's network,
// where the Tailscale container finds it as headscale, and returns a key
// that signs a device in to it.
func fakeTailnet(t *testing.T) string {
	t.Helper()
	if out, err := exec.Command("docker", "network", "create", "homelab").CombinedOutput(); err != nil && !strings.Contains(string(out), "already exists") {
		t.Fatalf("docker network create homelab: %v\n%s", err, out)
	}
	conf := filepath.Join(t.TempDir(), "config.yaml")
	if err := os.WriteFile(conf, []byte(headscaleConfig), 0o644); err != nil {
		t.Fatal(err)
	}
	name := "realdocker-headscale"
	_ = exec.Command("docker", "rm", "-f", name).Run()
	docker(t, "run", "-d", "--name", name, "--network", "homelab", "--network-alias", "headscale",
		"-v", conf+":/etc/headscale/config.yaml:ro", headscaleImage, "serve")
	t.Cleanup(func() { _ = exec.Command("docker", "rm", "-f", name).Run() })
	waitFor(t, "the fake tailnet's user", 2*time.Minute, func() error {
		out, err := exec.Command("docker", "exec", name, "headscale", "users", "create", "home").CombinedOutput()
		if err != nil && !strings.Contains(string(out), "already exists") {
			return fmt.Errorf("%v: %s", err, out)
		}
		return nil
	})
	out := docker(t, "exec", name, "headscale", "preauthkeys", "create", "--user", "1", "--reusable", "--expiration", "2h", "-o", "json")
	var k struct {
		Key string `json:"key"`
	}
	if err := json.Unmarshal([]byte(out), &k); err != nil || k.Key == "" {
		t.Fatalf("the fake tailnet's key: %v\n%s", err, out)
	}
	return k.Key
}

// setupSteps is Setup's checklist, as the Setup screen reads it; it is
// read often, so it stays out of the run's log.
func (l *lab) setupSteps() []setup.Step {
	l.t.Helper()
	c := exec.Command(l.bin, "--root", l.root, "--no-color", "--json", "setup")
	c.Dir = l.root
	c.Env = append(os.Environ(), "HOMELAB_NO_BROWSER=1")
	raw, err := c.CombinedOutput()
	out := string(raw)
	if err != nil {
		l.t.Fatalf("homelab setup: %v\n%s", err, out)
	}
	var line struct {
		Type string       `json:"type"`
		Data []setup.Step `json:"data"`
	}
	for _, s := range strings.Split(out, "\n") {
		if strings.HasPrefix(s, "{") && json.Unmarshal([]byte(s), &line) == nil && line.Type == "setup" {
			return line.Data
		}
	}
	l.t.Fatalf("setup --json gave no checklist:\n%s", out)
	return nil
}

// doTheSteps is the Setup screen's Do the steps I can: each step whose
// button can run now (to do, with commands to run), one at a time, with
// the checklist read again after each, until none is left; a command that
// fails fails the test, as it stops the button. ran keeps the steps run,
// so none runs twice.
func (l *lab) doTheSteps(ran map[string]bool) {
	l.t.Helper()
	for {
		steps := l.setupSteps()
		i := slices.IndexFunc(steps, func(s setup.Step) bool { return s.State == "todo" && len(s.Run) > 0 && !ran[s.ID] })
		if i < 0 {
			return
		}
		s := steps[i]
		ran[s.ID] = true
		l.t.Logf("— %s", s.Title)
		for _, args := range s.Run {
			l.run(args...)
		}
	}
}

// find is the step with an id, or one that says it is missing.
func find(steps []setup.Step, id string) setup.Step {
	for _, s := range steps {
		if s.ID == id {
			return s
		}
	}
	return setup.Step{ID: id, State: "missing"}
}

// summary is each step's id and state, for the run's log.
func summary(steps []setup.Step) string {
	var out []string
	for _, s := range steps {
		out = append(out, s.ID+" "+s.State)
	}
	return strings.Join(out, ", ")
}
