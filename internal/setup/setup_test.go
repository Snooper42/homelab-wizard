package setup

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/duplicati"
	"github.com/Snooper42/homelab-wizard/internal/host"
)

type fakeProbe struct{ dns, adguard, cf, cert error }

func (fakeProbe) LANAddress() (string, error)                        { return "192.168.1.10", nil }
func (f fakeProbe) DNS(context.Context, string) error                { return f.dns }
func (f fakeProbe) AdGuard(context.Context, map[string]string) error { return f.adguard }
func (f fakeProbe) Cloudflare(context.Context, string, string) error { return f.cf }
func (f fakeProbe) Certificate(context.Context, string, string) error {
	return f.cert
}

func states(steps []Step) map[string]string {
	out := map[string]string{}
	for _, s := range steps {
		out[s.ID] = s.State
	}
	return out
}

func TestSteps(t *testing.T) {
	down := errors.New("refused")
	env := map[string]string{"HOMELAB_DOMAIN": "example.com", "BACKUP_DESTINATION": "./backups"}

	// Nothing running yet: the runtime is the first thing to do.
	s := states(Steps(context.Background(), Inputs{Env: env, Host: host.For("darwin"), Probe: fakeProbe{down, down, down, down}}))
	if s["runtime"] != "todo" || s["started"] != "waiting" || s["domain"] != "waiting" || s["tunnel"] != "waiting" {
		t.Fatalf("fresh: %v", s)
	}

	// Started, AdGuard answering with its login, token valid, no certificate yet.
	st := &api.Status{Apps: []api.AppStatus{{ID: "immich-server", State: "running", Address: "photos.example.com"}, {ID: "cloudflared", State: "missing"}, {ID: "vaultwarden", State: "running"}}}
	env["ADGUARD_PASSWORD"], env["CLOUDFLARE_API_TOKEN"] = "pw", "token"
	steps := Steps(context.Background(), Inputs{Env: env, Host: host.For("darwin"), Status: st, Probe: fakeProbe{cert: down},
		Jobs: func() (int, int) { return 3, 3 }, Done: map[string]bool{"address": true}})
	s = states(steps)
	want := map[string]string{"runtime": "done", "started": "done", "address": "done", "adguard": "done", "cloudflare": "done",
		"domain": "todo", "vaultwarden": "waiting", "twofactor": "waiting", "tunnel": "waiting", "backups": "todo", "jobs": "done"}
	for id, w := range want {
		if s[id] != w {
			t.Errorf("%s is %s, want %s", id, s[id], w)
		}
	}
	for _, step := range steps {
		if step.ID == "domain" && (step.Detail != "https://photos.example.com is not served with a valid certificate yet." || len(step.Run) != 1) {
			t.Errorf("domain step %+v", step)
		}
	}
}

func TestMarkDone(t *testing.T) {
	root := t.TempDir()
	if err := MarkDone(root, "address", true); err != nil {
		t.Fatal(err)
	}
	if !LoadDone(root)["address"] {
		t.Fatal("not saved")
	}
	_ = MarkDone(root, "address", false)
	if LoadDone(root)["address"] {
		t.Fatal("not cleared")
	}
}

func TestDuplicatiStep(t *testing.T) {
	dest := t.TempDir()
	env := map[string]string{"HOMELAB_DOMAIN": "example.com", "BACKUP_DESTINATION": dest}
	st := &api.Status{}
	step := func(jobs []duplicati.Job, err error) Step {
		in := Inputs{Env: env, Host: host.For("darwin"), Status: st, Probe: fakeProbe{},
			Backups: func() ([]duplicati.Job, error) { return jobs, err }}
		for _, s := range Steps(context.Background(), in) {
			if s.ID == "duplicati" {
				return s
			}
		}
		t.Fatal("no duplicati step")
		return Step{}
	}
	if s := step(nil, nil); s.State != "todo" || len(s.Run) != 1 || s.Run[0][0] != "duplicati" {
		t.Errorf("no jobs: %+v", s)
	}
	ran := time.Now().Add(-time.Hour)
	created := []duplicati.Job{{Name: "Homelab Secrets", LastFinished: ran}, {Name: "Homelab Databases"}, {Name: "Homelab AppData", LastFinished: ran}}
	if s := step(created, nil); s.State != "todo" || s.Run != nil || !strings.Contains(s.Detail, "Homelab Databases") {
		t.Errorf("waiting for a first run: %+v", s)
	}
	created[1].LastFinished = ran
	if s := step(created, nil); s.State != "done" {
		t.Errorf("all ran: %+v", s)
	}
	if s := step(nil, duplicati.ErrNoPassword); s.State != "todo" || !strings.Contains(s.Detail, "DUPLICATI_PASSWORD") {
		t.Errorf("no password: %+v", s)
	}
}

func TestBackupsStepOffersProtonDrive(t *testing.T) {
	home, vols := t.TempDir(), t.TempDir()
	env := map[string]string{"HOMELAB_DOMAIN": "example.com", "BACKUP_DESTINATION": "./backups", "MEDIA_ROOT": filepath.Join(vols, "Media")}
	step := func() Step {
		for _, s := range Steps(context.Background(), Inputs{Env: env, Host: host.For("darwin"), Status: &api.Status{}, Probe: fakeProbe{}, Home: home, Volumes: vols}) {
			if s.ID == "backups" {
				return s
			}
		}
		t.Fatal("no backups step")
		return Step{}
	}
	if s := step(); s.Run != nil || s.Choices != nil {
		t.Errorf("nowhere to go, no button: %+v", s)
	}
	_ = os.MkdirAll(filepath.Join(home, "Library", "CloudStorage", "ProtonDrive-you@proton.me-folder"), 0o755)
	_ = os.MkdirAll(filepath.Join(vols, "Media"), 0o755) // the media drive: never offered
	_ = os.MkdirAll(filepath.Join(vols, "Backup"), 0o755)
	s := step()
	if s.State != "todo" || len(s.Choices) != 2 || s.Choices[0].Label != "Use Proton Drive" || s.Choices[1].Label != "Use the Backup drive" {
		t.Fatalf("choices: %+v", s)
	}
	if r := s.Choices[1].Run[0]; r[1] != "destination" || r[2] != filepath.Join(vols, "Backup", "Homelab Backups") || r[3] != "--apply" {
		t.Errorf("run: %v", r)
	}
}

func TestHomeMode(t *testing.T) {
	env := map[string]string{"HOMELAB_DOMAIN": "", "BACKUP_DESTINATION": "./backups"}
	st := &api.Status{}
	steps := Steps(context.Background(), Inputs{Env: env, Host: host.For("darwin"), Status: st, Probe: fakeProbe{}})
	s := states(steps)
	if _, ok := s["vaultwarden"]; ok {
		t.Errorf("no password manager installed, yet its step shows: %v", s)
	}
	st.Apps = []api.AppStatus{{ID: "vaultwarden", State: "running"}}
	s = states(Steps(context.Background(), Inputs{Env: env, Host: host.For("darwin"), Status: st, Probe: fakeProbe{}}))
	for _, id := range []string{"adguard", "cloudflare", "domain", "tunnel"} {
		if _, ok := s[id]; ok {
			t.Errorf("home mode has the %s step", id)
		}
	}
	if s["tailnet"] != "todo" || s["vaultwarden"] != "waiting" {
		t.Fatalf("home mode: %v", s)
	}

	st.Apps, env["TAILSCALE_HOST"] = []api.AppStatus{{ID: "tailscale", State: "running"}, {ID: "vaultwarden", State: "running"}}, "homelab.tail1234.ts.net"
	steps = Steps(context.Background(), Inputs{Env: env, Host: host.For("darwin"), Status: st, Probe: fakeProbe{}})
	if s = states(steps); s["tailnet"] != "done" || s["vaultwarden"] != "todo" {
		t.Fatalf("tailnet up: %v", s)
	}
	for _, step := range steps {
		if step.ID == "vaultwarden" && step.Open != "https://homelab.tail1234.ts.net:8087" {
			t.Errorf("vaultwarden opens %q", step.Open)
		}
	}
	if _, ok := s["adblock"]; ok {
		t.Errorf("ad blocking is not installed, yet its step shows: %v", s)
	}
	st.Apps = append(st.Apps, api.AppStatus{ID: "tailnet-dns", State: "running"})
	if s = states(Steps(context.Background(), Inputs{Env: env, Host: host.For("darwin"), Status: st, Probe: fakeProbe{}})); s["adblock"] != "todo" {
		t.Errorf("ad blocking installed: %v", s)
	}
}

func TestThisMacStep(t *testing.T) {
	env := map[string]string{"HOMELAB_DOMAIN": "example.com", "ADGUARD_PASSWORD": "pw", "BACKUP_DESTINATION": "./backups"}
	st := &api.Status{Apps: []api.AppStatus{{ID: "vaultwarden", State: "running"}}}
	finds := false
	var asked [2]string
	in := Inputs{Env: env, Host: host.For("darwin"), Status: st, Probe: fakeProbe{}, ThisMac: func(dom, ip string) bool { asked = [2]string{dom, ip}; return finds }}
	var step Step
	for _, s := range Steps(context.Background(), in) {
		if s.ID == "thismac" {
			step = s
		}
	}
	if step.State != "todo" || len(step.Run) != 1 || strings.Join(step.Run[0], " ") != "domain resolver --apply" || asked != [2]string{"example.com", "192.168.1.10"} {
		t.Fatalf("%+v asked %v", step, asked)
	}
	finds = true
	if s := states(Steps(context.Background(), in)); s["thismac"] != "done" {
		t.Errorf("found: %v", s["thismac"])
	}
	in.ThisMac = nil
	if s := states(Steps(context.Background(), in)); s["thismac"] != "" {
		t.Errorf("not a Mac, yet the step shows: %v", s["thismac"])
	}
}

func TestRuntimeStepWhenRefused(t *testing.T) {
	detail := func(err error) string {
		for _, s := range Steps(context.Background(), Inputs{Env: map[string]string{}, Host: host.For("linux"), Probe: fakeProbe{}, Home: t.TempDir(), RuntimeErr: err}) {
			if s.ID == "runtime" {
				return s.Detail
			}
		}
		t.Fatal("no runtime step")
		return ""
	}
	refused := docker.Explained{Msg: "this account may not use Docker Engine yet", Err: errors.New("docker ps: permission denied while trying to connect to the Docker daemon socket")}
	if d := detail(refused); !strings.Contains(d, "docker group") {
		t.Errorf("refused: %s", d)
	}
	if d := detail(errors.New("docker ps: Cannot connect to the Docker daemon")); d != host.For("linux").StartRuntime {
		t.Errorf("stopped: %s", d)
	}
}
