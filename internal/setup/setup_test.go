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
	"github.com/Snooper42/homelab-wizard/internal/backup"
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

	// Immich's share links wait for the tunnel, then say what to paste where.
	if s["photo-links"] != "waiting" {
		t.Errorf("photo-links before the tunnel: %s", s["photo-links"])
	}
	st.Apps[1].State, env["TUNNEL_TOKEN"] = "running", "t"
	for _, step := range Steps(context.Background(), Inputs{Env: env, Host: host.For("darwin"), Status: st, Probe: fakeProbe{cert: down}}) {
		if step.ID == "photo-links" && (step.State != "todo" || !strings.Contains(step.Detail, "External domain: https://photos.example.com,") || step.Open != "https://photos.example.com/admin/system-settings?isOpen=server") {
			t.Errorf("photo-links step %+v", step)
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
	for _, id := range []string{"address", "adguard", "cloudflare", "domain", "tunnel"} {
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
	if _, ok := s["tailnet-here"]; ok {
		t.Errorf("no tailnet check given, yet the step shows: %v", s)
	}
	on := false
	in := Inputs{Env: env, Host: host.For("windows"), Status: st, Probe: fakeProbe{}, OnTailnet: func(h string) bool { return on && h == "homelab.tail1234.ts.net" }}
	if s := states(Steps(context.Background(), in)); s["tailnet-here"] != "todo" {
		t.Errorf("this PC without the Tailscale app: %v", s["tailnet-here"])
	}
	on = true
	if s := states(Steps(context.Background(), in)); s["tailnet-here"] != "done" {
		t.Errorf("this PC on the tailnet: %v", s["tailnet-here"])
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

// Before the homelab folder exists, a running OrbStack is ticked, and
// starting the homelab waits for the folder rather than offering a button.
func TestBeforeTheFolderExists(t *testing.T) {
	steps := Steps(context.Background(), Inputs{Env: map[string]string{}, Host: host.For("darwin"), Probe: fakeProbe{}, Home: t.TempDir(), RuntimeUp: true, NoFolder: true})
	got := states(steps)
	if got["runtime"] != "done" || got["started"] != "waiting" {
		t.Fatalf("states: %v", got)
	}
	for _, s := range steps {
		if s.ID == "started" && !strings.Contains(s.Detail, "homelab folder") {
			t.Errorf("started: %q", s.Detail)
		}
	}
	// OrbStack not running: the first step says to start it, as before.
	if got := states(Steps(context.Background(), Inputs{Env: map[string]string{}, Host: host.For("darwin"), Probe: fakeProbe{}, Home: t.TempDir(), NoFolder: true})); got["runtime"] != "todo" || got["started"] != "waiting" {
		t.Errorf("runtime down: %v", got)
	}
}

// A laptop is asked to stay plugged in, and the step follows the power.
func TestLaptopStep(t *testing.T) {
	env := map[string]string{"BACKUP_DESTINATION": "./backups"}
	step := func(onBattery, known bool) (Step, bool) {
		in := Inputs{Env: env, Host: host.For("darwin"), Status: &api.Status{}, Probe: fakeProbe{},
			Power: func() (bool, bool) { return onBattery, known }}
		for _, s := range Steps(context.Background(), in) {
			if s.ID == "laptop" {
				return s, true
			}
		}
		return Step{}, false
	}
	if _, ok := step(false, false); ok {
		t.Error("a machine without a battery has the laptop step")
	}
	if s, _ := step(false, true); !strings.Contains(s.Detail, "Keep this Mac awake while plugged in, in the menu bar item's menu") || !strings.HasSuffix(s.Detail, "turns it off.") {
		t.Errorf("plugged in, it does not say where keeping awake is turned off: %+v", s)
	}
	if s, _ := step(true, true); s.State != "todo" || !strings.Contains(s.Detail, "plug it in") {
		t.Errorf("on battery: %+v", s)
	}
	if s, _ := step(false, true); s.State != "done" {
		t.Errorf("plugged in: %+v", s)
	}
	env["KEEP_AWAKE"] = "false"
	if s, _ := step(false, true); s.State != "todo" || len(s.Settings) != 1 || s.Settings[0] != "KEEP_AWAKE" || !strings.Contains(s.Detail, "turns it on") {
		t.Errorf("plugged in, KEEP_AWAKE off: %+v", s)
	}
}

// A desktop says it is kept awake, and where that is turned off, in each
// system's own words: the reason a PC stays on all day is never a surprise.
func TestKeptAwakeStep(t *testing.T) {
	step := func(goos string, env map[string]string) Step {
		in := Inputs{Env: env, Host: host.For(goos), Status: &api.Status{}, Probe: fakeProbe{},
			Power: func() (bool, bool) { return false, false }}
		for _, s := range Steps(context.Background(), in) {
			if s.ID == "laptop" {
				t.Errorf("%s: a desktop has the laptop step", goos)
			}
			if s.ID == "kept-awake" {
				return s
			}
		}
		t.Fatalf("%s: no kept-awake step", goos)
		return Step{}
	}
	for goos, want := range map[string][2]string{
		"windows": {"This PC stays awake", "Keep this PC awake while plugged in, in the tray icon's menu"},
		"linux":   {"This machine stays awake", "Keep this computer awake while plugged in, in the tray icon's menu"},
		"darwin":  {"This Mac stays awake", "Keep this Mac awake while plugged in, in the menu bar item's menu"},
	} {
		s := step(goos, map[string]string{})
		if s.State != "done" || s.Title != want[0] || !strings.Contains(s.Detail, want[1]) || !strings.HasPrefix(s.Detail, "On: ") {
			t.Errorf("%s, on: %+v", goos, s)
		}
		s = step(goos, map[string]string{"KEEP_AWAKE": "false"})
		if s.State != "todo" || !strings.HasPrefix(s.Detail, "Off: ") || len(s.Settings) != 1 || s.Settings[0] != "KEEP_AWAKE" {
			t.Errorf("%s, off: %+v", goos, s)
		}
	}
	// Linux refusing the hold: only the step that asks for the permission.
	in := Inputs{Env: map[string]string{}, Host: host.For("linux"), Status: &api.Status{}, Probe: fakeProbe{},
		Power: func() (bool, bool) { return false, false }, AwakeRefused: func() bool { return true }}
	ids := map[string]bool{}
	for _, s := range Steps(context.Background(), in) {
		ids[s.ID] = true
	}
	if ids["kept-awake"] || !ids["awake"] {
		t.Errorf("refused on Linux: steps %v", ids)
	}
}

// Ollama's step shows once an app that uses it is installed, in each
// system's own words.
func TestOllamaStep(t *testing.T) {
	step := func(goos string, apps []api.AppStatus, up bool) (Step, bool) {
		in := Inputs{Env: map[string]string{}, Host: host.For(goos), Status: &api.Status{Apps: apps}, Probe: fakeProbe{},
			Ollama: func() bool { return up }}
		for _, s := range Steps(context.Background(), in) {
			if s.ID == "ollama" {
				return s, true
			}
		}
		return Step{}, false
	}
	if _, ok := step("darwin", []api.AppStatus{{ID: "paperless", Name: "Paperless-ngx", State: "running"}}, false); ok {
		t.Error("the Ollama step without an app that uses it")
	}
	ai := []api.AppStatus{{ID: "open-webui", Name: "Open WebUI", State: "running"}, {ID: "paperless-ai", Name: "Paperless-AI", State: "running"}}
	for goos, words := range map[string]string{"darwin": "brew install ollama", "windows": "winget install Ollama.Ollama", "linux": "OLLAMA_HOST=0.0.0.0"} {
		s, ok := step(goos, ai, false)
		if !ok || s.State != "todo" || !strings.Contains(s.Detail, words) || !strings.HasPrefix(s.Why, "Open WebUI and Paperless-AI use") {
			t.Errorf("%s, Ollama missing: %+v", goos, s)
		}
	}
	if s, _ := step("darwin", ai[1:], true); s.State != "done" || !strings.HasPrefix(s.Why, "Paperless-AI uses") {
		t.Errorf("Ollama answering: %+v", s)
	}
}

// The awake step shows on Linux only while the awake job is refused, and
// not with KEEP_AWAKE off; its button writes the rule.
func TestAwakeStep(t *testing.T) {
	step := func(env map[string]string, refused bool) (Step, bool) {
		in := Inputs{Env: env, Host: host.For("linux"), Probe: fakeProbe{}, AwakeRefused: func() bool { return refused }}
		for _, s := range Steps(context.Background(), in) {
			if s.ID == "awake" {
				return s, true
			}
		}
		return Step{}, false
	}
	s, ok := step(map[string]string{}, true)
	if !ok || len(s.Run) != 1 || strings.Join(s.Run[0], " ") != "awake allow --apply" || s.RunLabel != "Allow it" || !strings.Contains(s.Why, "your permission") {
		t.Errorf("refused: %+v", s)
	}
	if _, ok := step(map[string]string{}, false); ok {
		t.Error("the awake step while the job holds sleep off")
	}
	if _, ok := step(map[string]string{"KEEP_AWAKE": "false"}, true); ok {
		t.Error("the awake step with KEEP_AWAKE off")
	}
}

// Backups and the outside check can wait through the first week.
func TestBackupsCanWaitAWeek(t *testing.T) {
	env := map[string]string{"BACKUP_DESTINATION": "./backups"}
	later := func(since time.Time) map[string]bool {
		out := map[string]bool{}
		for _, s := range Steps(context.Background(), Inputs{Env: env, Host: host.For("darwin"), Status: &api.Status{}, Probe: fakeProbe{}, Since: since}) {
			out[s.ID] = s.Later
		}
		return out
	}
	if l := later(time.Now().Add(-time.Hour)); !l["backups"] || !l["duplicati"] || !l["heartbeat"] || l["jobs"] || l["started"] {
		t.Errorf("first day: %v", l)
	}
	if l := later(time.Now().Add(-Grace - time.Hour)); l["backups"] || l["duplicati"] || l["heartbeat"] {
		t.Errorf("after a week: %v", l)
	}
	if l := later(time.Time{}); l["backups"] {
		t.Errorf("no first-seen time: %v", l)
	}

	root := t.TempDir()
	first := FirstSeen(root)
	if first.IsZero() || !FirstSeen(root).Equal(first) {
		t.Fatalf("first seen %v, then %v", first, FirstSeen(root))
	}
	_ = MarkDone(root, "devices", true)
	if !FirstSeen(root).Equal(first) || !LoadDone(root)["devices"] {
		t.Error("marking a step done lost the first-seen time")
	}
}

func TestRuntimeStepSetsUpDocker(t *testing.T) {
	env := map[string]string{}
	runtimeStep := func(p host.Profile, err error) Step {
		for _, s := range Steps(context.Background(), Inputs{Env: env, Host: p, RuntimeErr: err, Probe: fakeProbe{}}) {
			if s.ID == "runtime" {
				return s
			}
		}
		return Step{}
	}
	if s := runtimeStep(host.SteamOS(host.For("linux")), errors.New("not running")); s.RunLabel != "Set up Docker for me" || s.Run[0][0] != "runtime" {
		t.Errorf("SteamOS: %+v", s)
	}
	if s := runtimeStep(host.For("linux"), docker.ErrNoDocker); s.RunLabel != "Set up Docker for me" {
		t.Errorf("Linux without Docker: %+v", s)
	}
	if s := runtimeStep(host.For("linux"), errors.New("not running")); len(s.Run) != 0 {
		t.Errorf("Linux with a stopped Docker starts it, not sets one up: %+v", s)
	}
	if s := runtimeStep(host.For("darwin"), docker.ErrNoDocker); len(s.Run) != 0 {
		t.Errorf("the Mac installs OrbStack: %+v", s)
	}
}

func TestKopiaStepOffersASecondDrive(t *testing.T) {
	home, vols := t.TempDir(), t.TempDir()
	dup := filepath.Join(vols, "Backup", "Homelab Backups")
	env := map[string]string{"HOMELAB_DOMAIN": "example.com", "BACKUP_DESTINATION": dup, "MEDIA_ROOT": filepath.Join(vols, "Media"), "KOPIA_REPOSITORY": "./backups-kopia"}
	st := &api.Status{}
	step := func() (Step, bool) {
		for _, s := range Steps(context.Background(), Inputs{Env: env, Host: host.For("darwin"), Status: st, Probe: fakeProbe{}, Home: home, Volumes: vols}) {
			if s.ID == "kopia" {
				return s, true
			}
		}
		return Step{}, false
	}
	if _, ok := step(); ok {
		t.Fatal("Kopia is not installed, yet its step shows")
	}
	st.Apps = []api.AppStatus{{ID: "kopia", State: "running"}}
	for _, d := range []string{"Media", "Backup/Homelab Backups", "Spare"} {
		_ = os.MkdirAll(filepath.Join(vols, d), 0o755)
	}
	s, ok := step()
	if !ok || s.State != "todo" {
		t.Fatalf("installed, in the homelab folder: %+v", s)
	}
	// Only the Spare drive: not the media's, not Duplicati's.
	if len(s.Choices) != 1 || s.Choices[0].Label != "Use the Spare drive" {
		t.Fatalf("choices: %+v", s.Choices)
	}
	if r := s.Choices[0].Run[0]; r[0] != "kopia" || r[1] != "repository" || r[2] != filepath.Join(vols, "Spare", "Homelab Kopia") || r[3] != "--apply" {
		t.Errorf("run: %v", r)
	}
	env["KOPIA_REPOSITORY"] = filepath.Join(dup, "kopia")
	_ = os.MkdirAll(env["KOPIA_REPOSITORY"], 0o755)
	if s, _ := step(); s.State != "todo" || !strings.Contains(s.Detail, "no second copy") {
		t.Errorf("inside Duplicati's folder: %+v", s)
	}
	env["KOPIA_REPOSITORY"] = filepath.Join(vols, "Spare", "Homelab Kopia")
	_ = os.MkdirAll(env["KOPIA_REPOSITORY"], 0o755)
	if s, _ := step(); s.State != "done" || s.Choices != nil || !strings.Contains(s.Detail, env["KOPIA_REPOSITORY"]) {
		t.Errorf("on the Spare drive: %+v", s)
	}
}

func TestKopiaStepSaysHowItsRestoreTestWent(t *testing.T) {
	vols := t.TempDir()
	repo := filepath.Join(vols, "Spare", "Homelab Kopia")
	_ = os.MkdirAll(repo, 0o755)
	env := map[string]string{"HOMELAB_DOMAIN": "example.com", "KOPIA_REPOSITORY": repo}
	st := &api.Status{Apps: []api.AppStatus{{ID: "kopia", State: "running"}}}
	detail := func(l *backup.RestoreLog) string {
		for _, s := range Steps(context.Background(), Inputs{Env: env, Host: host.For("linux"), Status: st, Probe: fakeProbe{}, Home: t.TempDir(), Volumes: vols, Restore: l}) {
			if s.ID == "kopia" {
				return s.Detail
			}
		}
		t.Fatal("no Kopia step")
		return ""
	}
	if d := detail(nil); d != "Kopia's copies go to "+repo+"." {
		t.Errorf("without the log: %q", d)
	}
	l := &backup.RestoreLog{}
	// Duplicati's tests are not Kopia's.
	l.Record(backup.RestoreRun{When: time.Date(2026, 10, 1, 3, 0, 0, 0, time.Local), Passed: true, Summary: "12 of 12 files match"})
	if d := detail(l); !strings.Contains(d, "No restore test from them yet: homelab restore-test --auto --engine kopia") {
		t.Errorf("none yet: %q", d)
	}
	l.Record(backup.RestoreRun{When: time.Date(2026, 10, 2, 3, 0, 0, 0, time.Local), Passed: true, Summary: "12 of 12 files identical", Engine: "kopia"})
	if d := detail(l); !strings.HasSuffix(d, "The last restore test from them passed, on 2 October.") {
		t.Errorf("passed: %q", d)
	}
	l.Record(backup.RestoreRun{When: time.Date(2026, 10, 9, 3, 0, 0, 0, time.Local), Summary: "Kopia's restore failed: no snapshot of /source/appdata", Engine: "kopia"})
	if d := detail(l); !strings.Contains(d, "on 9 October, did not pass: Kopia's restore failed: no snapshot of /source/appdata. Try again: homelab restore-test --auto --engine kopia.") {
		t.Errorf("failed: %q", d)
	}
}
