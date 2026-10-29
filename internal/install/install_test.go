package install

import (
	"context"
	"github.com/Snooper42/homelab-wizard/internal/host"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/ports"
	"github.com/Snooper42/homelab-wizard/internal/selector"
)

type freeProber struct{}

func (freeProber) Free(string, int, string) bool { return true }

// copyRepo copies the compose files and .env.example into a temp root so
// plans can create folders without touching the real repository.
func copyRepo(t *testing.T) string {
	t.Helper()
	_, file, _, _ := runtime.Caller(0)
	src := filepath.Join(filepath.Dir(file), "..", "..")
	dst := t.TempDir()
	files, _ := filepath.Glob(filepath.Join(src, "stacks", "*", "compose.yaml"))
	parts, _ := filepath.Glob(filepath.Join(src, "compose", "*.yaml"))
	files = append(files, parts...)
	files = append(files, filepath.Join(src, "compose.yaml"), filepath.Join(src, ".env.example"), filepath.Join(src, "config", "crowdsec", "acquis.yaml"))
	for _, f := range files {
		rel, _ := filepath.Rel(src, f)
		data, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		if err := os.MkdirAll(filepath.Dir(filepath.Join(dst, rel)), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dst, rel), data, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return dst
}

// fixture builds Inputs over a temp copy of the repo. env lines are written
// to .env first (the rest comes from .env.example).
func fixture(t *testing.T, ctrs []docker.FakeContainer, env ...string) (Inputs, *docker.Client, *docker.FakeRunner) {
	t.Helper()
	root := copyRepo(t)
	if len(env) > 0 {
		if err := os.WriteFile(filepath.Join(root, ".env"), []byte(strings.Join(env, "\n")+"\n"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	c, err := catalog.Load(root)
	if err != nil {
		t.Fatal(err)
	}
	fake := &docker.FakeRunner{Containers: ctrs}
	client := &docker.Client{Runner: fake, Bin: "docker"}
	list, err := client.Containers(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return Inputs{
		Catalog:    c,
		EnvFile:    filepath.Join(root, ".env"),
		EnvExample: filepath.Join(root, ".env.example"),
		Containers: list,
		Prober:     freeProber{},
		Identity:   envfile.Identity{UID: 501, GID: 20, TimeZone: "America/Chicago"},
		Home:       t.TempDir(),
	}, client, fake
}

func ids(apps []*catalog.App) string {
	var out []string
	for _, a := range apps {
		out = append(out, a.ID)
	}
	return strings.Join(out, ",")
}

func TestSkipsWhatAlreadyRuns(t *testing.T) {
	media := t.TempDir()
	in, client, fake := fixture(t, []docker.FakeContainer{
		{Name: "homelab_media_automation-sonarr-1", Image: "lscr.io/linuxserver/sonarr", Running: true, Project: "homelab_media_automation", Service: "sonarr"},
		{Name: "prowlarr", Image: "lscr.io/linuxserver/prowlarr", Running: true},
	}, "MEDIA_ROOT="+media, "DOWNLOADS_ROOT="+filepath.Join(media, "downloads"))
	sel, err := selector.Resolve(in.Catalog, []string{"sonarr", "radarr", "prowlarr", "overseerr"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	plan, err := Build(in, sel)
	if err != nil {
		t.Fatal(err)
	}
	if got := ids(plan.Start); got != "radarr,seerr" {
		t.Fatalf("started %s", got)
	}
	reasons := map[string]string{}
	for _, s := range plan.Skips {
		reasons[s.App.ID] = s.Reason
	}
	if len(reasons) != 2 || reasons["sonarr"] != "already running" || !strings.Contains(reasons["prowlarr"], `"prowlarr"`) {
		t.Fatalf("skips %v", reasons)
	}
	if err := Apply(context.Background(), plan, client, in.Catalog, in.EnvFile); err != nil {
		t.Fatal(err)
	}
	if len(fake.Streamed) != 1 {
		t.Fatalf("expected one compose call, got %v", fake.Streamed)
	}
	cmd := strings.Join(fake.Streamed[0], " ")
	for _, want := range []string{"-p homelab_media_automation", "--env-file " + in.EnvFile, "--profile optional", "up --detach --no-recreate radarr seerr"} {
		if !strings.Contains(cmd, want) {
			t.Errorf("compose call %q is missing %q", cmd, want)
		}
	}
	for _, dir := range []string{filepath.Join(in.Catalog.Root, "data", "appdata", "radarr"), filepath.Join(media, "movies"), filepath.Join(media, "downloads")} {
		if _, err := os.Stat(dir); err != nil {
			t.Errorf("%s was not created", dir)
		}
	}
	if !fake.Networks["homelab"] {
		t.Error("the shared network should have been created")
	}
	env, _ := envfile.Load(in.EnvFile)
	if v, _ := env.Get("NPM_API_PASSWORD"); envfile.Placeholder.MatchString(v) || v == "" {
		t.Fatalf("secrets should be generated, got %q", v)
	}
}

func TestBaselineAcrossProjects(t *testing.T) {
	// No tunnel token and the media drive unplugged.
	in, client, fake := fixture(t, nil, "MEDIA_ROOT=/Volumes/NotMounted", "IMMICH_UPLOAD_LOCATION=/Volumes/NotMounted/photos")
	var tokens []string
	for _, a := range in.Catalog.Baseline() {
		tokens = append(tokens, a.ID)
	}
	sel, err := selector.Resolve(in.Catalog, tokens, nil)
	if err != nil {
		t.Fatal(err)
	}
	plan, err := Build(in, sel)
	if err != nil {
		t.Fatal(err)
	}
	reasons := map[string]string{}
	for _, s := range plan.Skips {
		reasons[s.App.ID] = s.Reason
	}
	if !strings.Contains(reasons["cloudflared"], "TUNNEL_TOKEN") {
		t.Errorf("cloudflared: %q", reasons["cloudflared"])
	}
	for _, id := range []string{"navidrome", "komga", "immich-server", "duplicati"} {
		if !strings.Contains(reasons[id], "not mounted") {
			t.Errorf("%s should wait for the media drive: %q", id, reasons[id])
		}
	}
	if reasons["feishin"] != "waits for navidrome" {
		t.Errorf("feishin: %q", reasons["feishin"])
	}
	// Immich's helpers wait with Immich rather than idle without it.
	if !strings.Contains(reasons["immich-database"], "not starting") {
		t.Errorf("immich-database should wait for immich-server: %q", reasons["immich-database"])
	}
	for _, id := range []string{"nginx-proxy-manager", "crowdsec", "vaultwarden", "paperless", "paperless-db", "moneymatter-frontend", "moneymatter-db"} {
		if _, skipped := reasons[id]; skipped {
			t.Errorf("%s should start: %q", id, reasons[id])
		}
	}
	if err := Apply(context.Background(), plan, client, in.Catalog, in.EnvFile); err != nil {
		t.Fatal(err)
	}
	var projects []string
	for _, s := range fake.Streamed {
		for i, a := range s {
			if a == "-p" {
				projects = append(projects, s[i+1])
			}
		}
	}
	if got := strings.Join(projects, ","); got != "homelab_network,homelab_security,homelab_system,homelab_budget_tracker,homelab_immich,homelab_paperless" {
		t.Fatalf("compose ran for %s", got)
	}
	for _, s := range fake.Streamed {
		if strings.Contains(strings.Join(s, " "), "--profile") {
			t.Errorf("baseline apps need no profile: %v", s)
		}
	}
}

func TestRequiredSettingsHoldBackDependents(t *testing.T) {
	in, _, _ := fixture(t, nil, "MEDIA_ROOT="+t.TempDir())
	sel, err := selector.Resolve(in.Catalog, []string{"qbittorrent"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	plan, err := Build(in, sel)
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Start) != 0 || len(plan.Skips) != 2 || !strings.Contains(plan.Skips[0].Reason, "PROTONVPN_WIREGUARD_PRIVATE_KEY") || plan.Skips[1].Reason != "waits for gluetun" {
		t.Fatalf("start %s, skips %+v", ids(plan.Start), plan.Skips)
	}
}

func TestNativeAppsAreNotInstalled(t *testing.T) {
	in, _, _ := fixture(t, nil)
	sel, err := selector.Resolve(in.Catalog, []string{"jellyfin"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	for goos, want := range map[string]string{"darwin": "on this Mac, so you install it yourself: brew install --cask jellyfin", "linux": "on this machine, so you install it yourself: see https://jellyfin.org", "windows": "on this PC, so you install it yourself: see https://jellyfin.org"} {
		in.Host = host.For(goos)
		plan, err := Build(in, sel)
		if err != nil {
			t.Fatal(err)
		}
		if len(plan.Start) != 0 || !strings.Contains(plan.Skips[0].Reason, want) {
			t.Fatalf("jellyfin on %s: %+v", goos, plan.Skips)
		}
	}
	// Already on this machine: no download link; running: already running.
	saved := NativeState
	t.Cleanup(func() { NativeState = saved })
	in.Host = host.For("windows")
	for _, c := range []struct {
		installed, up bool
		want          string
	}{{true, false, "is installed on this PC: open it there"}, {true, true, "already running"}} {
		NativeState = func(*compose.Native) (bool, bool) { return c.installed, c.up }
		plan, err := Build(in, sel)
		if err != nil {
			t.Fatal(err)
		}
		if len(plan.Start) != 0 || !strings.HasPrefix(plan.Skips[0].Reason, c.want) {
			t.Errorf("installed %v, up %v: %+v", c.installed, c.up, plan.Skips)
		}
	}
}

func TestAppsRunningElsewhereHoldBackDependents(t *testing.T) {
	in, _, _ := fixture(t, []docker.FakeContainer{
		{Name: "navidrome", Image: "deluan/navidrome:latest", Running: true},
	}, "MEDIA_ROOT="+t.TempDir())
	sel, err := selector.Resolve(in.Catalog, []string{"navidrome", "feishin"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	plan, err := Build(in, sel)
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Start) != 0 || len(plan.Skips) != 2 || !strings.Contains(plan.Skips[1].Reason, "uses navidrome, which runs outside the homelab") {
		t.Fatalf("feishin must not pull in a second navidrome: start %s, skips %+v", ids(plan.Start), plan.Skips)
	}
	in.Options.IncludeExisting = true
	if plan, _ = Build(in, sel); ids(plan.Start) != "navidrome,feishin" {
		t.Fatalf("--include-existing starts the homelab's own copies: %s", ids(plan.Start))
	}
}

func TestPausedUpdatesHoldBackWatchtower(t *testing.T) {
	in, _, _ := fixture(t, nil, "UPDATES_PAUSED=true")
	sel, err := selector.Resolve(in.Catalog, []string{"watchtower"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	plan, err := Build(in, sel)
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Start) != 0 || len(plan.Skips) != 1 || !strings.Contains(plan.Skips[0].Reason, "paused") {
		t.Fatalf("start %s, skips %+v", ids(plan.Start), plan.Skips)
	}
}

func TestHelpersWaitForTheAppTheyServe(t *testing.T) {
	// MoneyMatter already runs outside the homelab, so its backend,
	// database, cache, and rates service must not start a second, empty copy.
	media := t.TempDir()
	in, _, _ := fixture(t, []docker.FakeContainer{
		{Name: "moneymatter-frontend", Image: "letehaha/budget-tracker-fe:sha-f862f3d", Running: true},
		{Name: "moneymatter-db", Image: "postgres:16", Running: true},
	}, "MEDIA_ROOT="+media, "IMMICH_UPLOAD_LOCATION="+filepath.Join(media, "photos"))
	sel, err := selector.Resolve(in.Catalog, []string{"moneymatter-frontend", "immich-server"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	plan, err := Build(in, sel)
	if err != nil {
		t.Fatal(err)
	}
	started := ids(plan.Start)
	if strings.Contains(started, "moneymatter") || !strings.Contains(started, "immich-database") || !strings.Contains(started, "immich-server") {
		t.Fatalf("started %s, skips %+v", started, plan.Skips)
	}
	reasons := map[string]string{}
	for _, s := range plan.Skips {
		reasons[s.App.ID] = s.Reason
	}
	if !strings.Contains(reasons["moneymatter-db"], "not starting") || !strings.Contains(reasons["moneymatter-frontend"], "already running") {
		t.Fatalf("skips %v", reasons)
	}
}

func TestSeedsStarterFiles(t *testing.T) {
	in, client, _ := fixture(t, nil)
	seed := filepath.Join(in.Catalog.Root, "config", "home-assistant")
	os.MkdirAll(seed, 0o755)
	os.WriteFile(filepath.Join(seed, "configuration.yaml"), []byte("http: {}\n"), 0o644)
	os.WriteFile(filepath.Join(seed, "automations.yaml"), []byte("[]\n"), 0o644)
	// An existing file is never replaced.
	data := filepath.Join(in.Catalog.Root, "data", "appdata", "home-assistant")
	os.MkdirAll(data, 0o755)
	os.WriteFile(filepath.Join(data, "automations.yaml"), []byte("- mine\n"), 0o644)

	sel, err := selector.Resolve(in.Catalog, []string{"home-assistant"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	plan, err := Build(in, sel)
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Seeds) != 1 || strings.Join(plan.Seeds[0].Files, ",") != "configuration.yaml" {
		t.Fatalf("seeds %+v", plan.Seeds)
	}
	if err := Apply(context.Background(), plan, client, in.Catalog, in.EnvFile); err != nil {
		t.Fatal(err)
	}
	if got, _ := os.ReadFile(filepath.Join(data, "configuration.yaml")); string(got) != "http: {}\n" {
		t.Fatalf("configuration.yaml: %q", got)
	}
	if got, _ := os.ReadFile(filepath.Join(data, "automations.yaml")); string(got) != "- mine\n" {
		t.Fatalf("an existing file was replaced: %q", got)
	}
}

// Off the Mac the media folder is in the home folder: missing, it is made,
// not waited for as an unplugged drive.
func TestMediaFolderInTheHomeFolderIsMade(t *testing.T) {
	in, _, _ := fixture(t, nil, "MEDIA_ROOT=~/Media", "IMMICH_UPLOAD_LOCATION=~/Media/photos")
	sel, err := selector.Resolve(in.Catalog, []string{"duplicati", "navidrome"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	plan, err := Build(in, sel)
	if err != nil {
		t.Fatal(err)
	}
	for _, s := range plan.Skips {
		if strings.Contains(s.Reason, "not mounted") {
			t.Errorf("%s waits for a drive: %q", s.App.ID, s.Reason)
		}
	}
	made := false
	for _, d := range plan.Dirs {
		made = made || strings.HasPrefix(d, filepath.Join(in.Home, "Media"))
	}
	if !made {
		t.Errorf("no folder made under ~/Media: %v", plan.Dirs)
	}
}

// Jellyfin's container keeps its library in the home folder
// (JELLYFIN_DATA_DIR): the folder is made as you, not by the runtime;
// Duplicati's read-only look at the same folder makes nothing.
func TestJellyfinsDataFolderIsMade(t *testing.T) {
	in, _, _ := fixture(t, nil, "MEDIA_ROOT=~/Media")
	data := filepath.Join(in.Home, ".local", "share", "jellyfin")
	has := func(plan *Plan, dir string) bool {
		for _, d := range plan.Dirs {
			if d == dir {
				return true
			}
		}
		return false
	}
	sel, err := selector.Resolve(in.Catalog, []string{"duplicati"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	plan, err := Build(in, sel)
	if err != nil {
		t.Fatal(err)
	}
	if has(plan, data) {
		t.Errorf("Duplicati's read-only mount made %s", data)
	}
	sel, err = selector.Resolve(in.Catalog, []string{"jellyfin-container"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if plan, err = Build(in, sel); err != nil {
		t.Fatal(err)
	}
	if !has(plan, data) || !has(plan, filepath.Join(data, "cache")) {
		t.Errorf("Jellyfin's data folder is not made: %v", plan.Dirs)
	}
}

// The small baseline with every starter pick fits an 8 GB Mac; a much
// bigger pick says it would not, naming the heaviest apps.
func TestMemoryCheck(t *testing.T) {
	in, _, _ := fixture(t, nil, "MEDIA_ROOT="+t.TempDir())
	plan := func(mb int, tokens ...string) *Plan {
		t.Helper()
		sel, err := selector.Resolve(in.Catalog, tokens, nil)
		if err != nil {
			t.Fatal(err)
		}
		in.MemoryMB = mb
		p, err := Build(in, sel)
		if err != nil {
			t.Fatal(err)
		}
		return p
	}
	warned := func(p *Plan) bool {
		for _, w := range p.Warnings {
			if strings.HasPrefix(w, "Memory:") {
				return true
			}
		}
		return false
	}
	starters := []string{"watchtower", "duplicati", "ntfy", "uptime-kuma", "tailscale", "immich-server", "vaultwarden", "jellyfin", "navidrome", "feishin", "filebrowser", "syncthing"}
	p := plan(8192, starters...)
	if warned(p) || p.Memory.Room != 4096 || p.Memory.Use > 3500 {
		t.Errorf("starters on 8 GB: %+v %v", p.Memory, p.Warnings)
	}
	big := append(starters, "paperless", "open-webui", "karakeep", "dawarich", "stirling-pdf")
	if p := plan(8192, big...); !warned(p) || !strings.Contains(strings.Join(p.Warnings, " "), "leave out the heaviest") {
		t.Errorf("big pick on 8 GB: %+v %v", p.Memory, p.Warnings)
	}
	if p := plan(16384, big...); warned(p) {
		t.Errorf("big pick on 16 GB: %+v %v", p.Memory, p.Warnings)
	}
	if p := plan(0, big...); warned(p) || p.Memory.Room != 0 {
		t.Errorf("memory unknown: %+v", p.Memory)
	}
}

// An older .env has Nextcloud on the phone companion's port: the
// plan moves it off, a new .env starts it elsewhere, and Jellyfin in a
// container still takes the port it stands in for.
func TestNativeAppPortsStayFree(t *testing.T) {
	media := "MEDIA_ROOT=" + t.TempDir()
	in, _, _ := fixture(t, nil, media, "NEXTCLOUD_PORT=8099")
	moved := func(tokens ...string) map[string]ports.Change {
		t.Helper()
		sel, err := selector.Resolve(in.Catalog, tokens, nil)
		if err != nil {
			t.Fatal(err)
		}
		plan, err := Build(in, sel)
		if err != nil {
			t.Fatal(err)
		}
		out := map[string]ports.Change{}
		for _, ch := range plan.Ports.Changes {
			out[ch.Var] = ch
		}
		return out
	}
	if ch, ok := moved("nextcloud")["NEXTCLOUD_PORT"]; !ok || ch.From != 8099 || ch.To == 8099 || !strings.Contains(ch.Reason, "Phone companion") {
		t.Errorf("Nextcloud should move off the phone companion's port: %+v", ch)
	}
	in, _, _ = fixture(t, nil, media)
	if ch, ok := moved("nextcloud")["NEXTCLOUD_PORT"]; ok {
		t.Errorf("a new .env should start Nextcloud clear of the companion: %+v", ch)
	}
	if ch, ok := moved("jellyfin-container")["JELLYFIN_PORT"]; ok {
		t.Errorf("Jellyfin in a container should keep 8096, the port it stands in for: %+v", ch)
	}
}
