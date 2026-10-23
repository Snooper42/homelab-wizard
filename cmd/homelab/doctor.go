package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/crowdsec"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/diskhealth"
	"github.com/Snooper42/homelab-wizard/internal/diskspace"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/docs"
	"github.com/Snooper42/homelab-wizard/internal/domain"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/host"
	"github.com/Snooper42/homelab-wizard/internal/ports"
	"github.com/Snooper42/homelab-wizard/internal/tailnet"
	"github.com/Snooper42/homelab-wizard/internal/upgrade"
)

// airPlayPorts are ports macOS's AirPlay Receiver holds.
func airPlayPorts(hp host.Profile) []int {
	if hp.OS == "darwin" {
		return []int{5000, 7000}
	}
	return nil
}

func (h *homelab) doctor(ctx context.Context, _ []string) error {
	u := h.ui
	problems := 0
	fail := func(format string, args ...any) { problems++; u.Fail(format, args...) }
	home, _ := os.UserHomeDir()

	hp := h.host
	u.Title("This machine")
	if hp.Supported {
		u.OK("%s (%s), with %s and %s", hp.Name, runtime.GOARCH, hp.Runtime, hp.Scheduler)
	} else {
		u.Warn("%s: this homelab supports macOS, Linux, and Windows; some checks are skipped", hp.Name)
	}
	for _, risky := range hp.RiskyDirs {
		if strings.HasPrefix(h.root, filepath.Join(home, risky)+string(filepath.Separator)) {
			why := "file syncing (OneDrive) interferes"
			if hp.OS == "darwin" {
				why = "macOS privacy controls or file syncing interfere"
			}
			u.Warn("the homelab folder is inside ~/%s; %s with containers. ~/Homelab is safer", risky, why)
		}
	}
	prober := ports.NewHostProber()
	for _, p := range airPlayPorts(hp) {
		if !prober.Free("0.0.0.0", p, "tcp") {
			u.Info("port %d is in use (usually AirPlay Receiver); no homelab app needs it", p)
		}
	}

	u.Title("Container runtime")
	var client *docker.Client
	var memTotal int64
	bin, err := docker.FindCLI()
	if err != nil {
		fail("%v", err)
	} else {
		u.OK("docker CLI: %s", bin)
		c := &docker.Client{Runner: docker.ExecRunner{}, Bin: bin}
		info, err := c.Info(ctx)
		if err != nil {
			fail("%s", hp.Unreachable(err))
		} else {
			client, memTotal = c, info.MemTotal
			u.OK("%s, engine %s, %d CPUs, %.1f GB memory", info.Runtime(), info.ServerVersion, info.NCPU, float64(info.MemTotal)/(1<<30))
			if hp.OS == "darwin" && info.Runtime() != "OrbStack" {
				u.Info("this homelab is set up for OrbStack; %s works but is untested here", info.Runtime())
			}
			if hp.OS == "linux" && info.SELinux() && selinuxEnforcing() {
				u.Warn("Docker gives containers SELinux labels and SELinux is enforcing, so the apps cannot read their folders in your home folder (Permission denied): turn Docker's SELinux option off (--selinux-enabled in /etc/sysconfig/docker, or \"selinux-enabled\" in /etc/docker/daemon.json) and restart Docker")
			}
		}
		if v, err := c.ComposeVersion(ctx); err != nil {
			fail("docker compose is missing: %v", err)
		} else if !versionAtLeast(v, 2, 20) {
			fail("docker compose %s is too old; 2.20 or newer is required (%s)", v, hp.UpdateRuntime)
		} else {
			u.OK("docker compose %s", v)
		}
	}
	if client != nil {
		if net := h.catalog.SharedNetwork(); net != "" {
			if _, err := client.Runner.Output(ctx, client.Bin, "network", "inspect", net); err != nil {
				u.Info("the %s network does not exist yet; homelab up creates it", net)
			} else {
				u.OK("shared network %s", net)
			}
		}
	}

	if client != nil {
		if used, err := containerMemory(ctx, client); err == nil && memTotal > 0 {
			share := used / float64(memTotal)
			msg := fmt.Sprintf("containers use %.1f of %.1f GB", used/(1<<30), float64(memTotal)/(1<<30))
			if share > 0.85 {
				u.Warn("%s: %s, or stop apps you do not use", msg, hp.MoreMemory)
			} else {
				u.OK("%s", msg)
			}
		}
	}

	if client != nil {
		if containers, err := client.Containers(ctx); err == nil {
			report := detect.Analyze(h.catalog, containers)
			if st, _ := report.State("open-webui"); st == detect.Running && !api.NativeUp(ctx, 11434) {
				u.Warn("Open WebUI is installed but Ollama does not answer on port 11434: %s", hp.InstallOllama)
			}
			if ms := moves(h.catalog, containers); len(ms) > 0 {
				u.Warn("%d app(s) still run in an old Compose project (%s): homelab migrate moves them into their category's, with a backup first", len(ms), ms[0].container.Project())
			}
			if ctr, ok := runningContainer(report, "tailscale"); ok {
				out, err := client.Exec(ctx, ctr.Name, "tailscale", "status", "--json")
				switch ok, msg := tailscaleVerdict(out, h.envMap()["TAILSCALE_ROUTES"]); {
				case err != nil && len(out) == 0:
					u.Info("could not read Tailscale's status: %v", err)
				case ok:
					u.OK("%s", msg)
				default:
					u.Warn("%s", msg)
				}
				if h.envMap()["HOMELAB_DOMAIN"] == "" {
					switch self, err := tailnet.ParseStatus(out); {
					case err != nil:
					case !self.HTTPS:
						u.Warn("Home mode: the tailnet gives out no certificates, so the app addresses do not open: Tailscale admin console › DNS › turn on MagicDNS and HTTPS Certificates")
					default:
						u.OK("Home mode: apps at https://%s:<port> (homelab tailnet setup refreshes them)", self.Host)
					}
				}
			} else if h.envMap()["HOMELAB_DOMAIN"] == "" {
				u.Info("Home mode (no domain): the apps get https addresses once Tailscale runs (Setup › Addresses on your tailnet)")
			}
			if checked, ok, msg := crowdsecBouncer(ctx, client, report, time.Now()); checked && ok {
				u.OK("%s", msg)
			} else if checked {
				u.Warn("%s", msg)
			}
		}
	}

	u.Title("Network")
	lan, lanErr := domain.LANAddress()
	if lanErr != nil {
		u.Warn("%v", lanErr)
	} else {
		u.OK("home-network address %s", lan)
	}
	// AdGuard Home's DNS next to systemd-resolved's stub on 127.0.0.53:53.
	if env := h.envMap(); lanErr == nil {
		dnsBind, lanBind := env["ADGUARD_DNS_BIND_IP"], env["LAN_BIND_IP"]
		switch {
		case dnsBind != "" && dnsBind != lan:
			u.Warn("AdGuard Home's DNS listens on %s (ADGUARD_DNS_BIND_IP), but this machine's address is now %s: set it to %s in Settings, then homelab install adguard-home; reserve the address in the router so it stays", dnsBind, lan, lan)
		case dnsBind == "" && (lanBind == "" || lanBind == "0.0.0.0") && domain.ResolvedStub():
			u.Warn("systemd-resolved holds 127.0.0.53:53, so AdGuard Home cannot listen on 0.0.0.0:53: set ADGUARD_DNS_BIND_IP to %s in Settings, then homelab install adguard-home", lan)
		}
	}
	if name, ok := domain.DefaultVPN(); ok {
		u.Warn("a VPN (%s) carries this machine's traffic, so phones and computers may not reach the homelab: turn the VPN off on this machine, or allow LAN connections and turn off its kill switch", name)
	}
	if dom := h.envMap()["HOMELAB_DOMAIN"]; dom != "" && lanErr == nil {
		probe := "npm." + dom
		lctx, cancel := context.WithTimeout(ctx, 3*time.Second)
		addrs, err := net.DefaultResolver.LookupHost(lctx, probe)
		cancel()
		if err == nil && slices.Contains(addrs, lan) {
			u.OK("home DNS: %s → %s", probe, lan)
		} else {
			u.Info("%s does not find its apps by name (%s does not resolve to %s): homelab domain resolver --apply (Setup › %s finds its apps by name) fixes it, also with a VPN on", h.host.Machine, probe, lan, strings.ToUpper(h.host.Machine[:1])+h.host.Machine[1:])
		}
	}

	u.Title("Settings")
	issues := h.catalog.Validate(h.declaredVars())
	errs := 0
	for _, i := range issues {
		if i.Error {
			errs++
		}
	}
	if errs > 0 {
		fail("the compose files have %d metadata error(s): run homelab validate", errs)
	} else {
		u.OK("%d apps across %d Compose projects", len(h.catalog.Apps), len(h.catalog.Files))
	}
	env, err := envfile.Load(h.envFile)
	switch {
	case err != nil:
		fail("reading .env: %v", err)
	case !env.Exists():
		u.Info(".env does not exist yet; homelab up creates it from .env.example")
	default:
		placeholders := 0
		var lookalikes []string
		for k, v := range env.Map() {
			switch {
			case v == "__REPLACE_ME__":
				placeholders++
			case envfile.Placeholder.MatchString(v):
				lookalikes = append(lookalikes, k)
			}
		}
		sort.Strings(lookalikes)
		switch {
		case placeholders > 0:
			u.Warn(".env has %d placeholder secret(s); homelab up fills them in", placeholders)
		case len(lookalikes) == 0:
			u.OK(".env is complete")
		}
		if len(lookalikes) > 0 {
			u.Warn("%s still look like placeholders (changeme); set real values in Settings", strings.Join(lookalikes, ", "))
		}
		if keys := env.BareDollars(); len(keys) > 0 {
			u.Warn("%s contain a $ outside quotes, which Compose reads as a variable: save them again in Settings (it quotes them)", strings.Join(keys, ", "))
		}
		if info, err := os.Stat(h.envFile); err == nil && info.Mode().Perm()&0o077 != 0 {
			u.Warn(".env is readable by other users; run chmod 600 .env")
		}
	}
	m := h.envMap()
	expand := func(p string) string {
		if strings.HasPrefix(p, "~/") {
			return filepath.Join(home, p[2:])
		}
		if !filepath.IsAbs(p) {
			return filepath.Join(h.root, p)
		}
		return p
	}
	// Before .env exists, MEDIA_ROOT is the template's Mac drive, which a new
	// .env off the Mac replaces with a folder in the home folder.
	_, noEnv := os.Stat(h.envFile)
	if media := m["MEDIA_ROOT"]; media != "" && (noEnv == nil || h.host.OS == "darwin") {
		if _, err := os.Stat(media); err != nil {
			u.Warn("media drive %s is not mounted; media apps wait for it", media)
		} else {
			u.OK("media drive %s", media)
		}
	}
	switch dest := m["BACKUP_DESTINATION"]; {
	case dest == "" || dest == "./backups":
		hint := "point it at your Proton Drive folder so backups leave " + h.host.Machine
		if h.host.OS != "darwin" {
			hint = "point it at a backup drive or a synced folder so backups leave " + h.host.Machine + " (Setup › Backups leave this machine offers the ones it finds)"
		}
		if home, err := os.UserHomeDir(); err == nil && len(backup.ProtonDrive(home)) == 1 {
			hint = "Proton Drive is here: homelab duplicati destination (Setup › Use Proton Drive) points it there"
		}
		u.Warn("BACKUP_DESTINATION is the local ./backups folder; %s", hint)
	default:
		if _, err := os.Stat(expand(dest)); err != nil {
			u.Warn("BACKUP_DESTINATION %s does not exist (is Proton Drive running?)", dest)
		} else {
			u.OK("backups go to %s", dest)
		}
	}
	if jf := m["JELLYFIN_DATA_DIR"]; jf != "" {
		if _, err := os.Stat(expand(jf)); err != nil {
			u.Info("Jellyfin's data folder %s was not found; set JELLYFIN_DATA_DIR so Duplicati backs it up", jf)
		} else {
			u.OK("Jellyfin data: %s", jf)
		}
	}
	if strings.EqualFold(m["VAULTWARDEN_SIGNUPS_ALLOWED"], "true") {
		u.Warn("Vaultwarden sign-ups are open; set VAULTWARDEN_SIGNUPS_ALLOWED=false once your accounts exist")
	}
	if m["TUNNEL_TOKEN"] == "" {
		u.Info("TUNNEL_TOKEN is empty: nothing is published to the internet")
	}
	if m["HEARTBEAT_URL"] == "" {
		u.Info("HEARTBEAT_URL is empty: nothing outside this machine notices if it, or its runtime, goes down")
	}
	if m["NTFY_PUBLISH_TOKEN"] != "" && m["NTFY_READ_TOKEN"] == "" {
		u.Info("NTFY_READ_TOKEN is empty: run homelab notify setup again so the app can show recent alerts (it keeps the publishers' token)")
	}
	if m["NTFY_PUBLISH_TOKEN"] == "" {
		u.Info("NTFY_PUBLISH_TOKEN is empty: alerts cannot be published (homelab notify setup)")
	}
	if m["ADGUARD_PASSWORD"] == "" {
		u.Info("ADGUARD_PASSWORD is empty: domain setup cannot add the *.domain rewrite to AdGuard")
	}

	u.Title("Disk space")
	for _, v := range diskspace.Check(diskspace.Locations(h.root, home, m)) {
		if v.Low() {
			u.Warn("%s: %s, under %s; %s", v.Label(), v.Describe(), diskspace.Size(diskspace.Threshold(v.Total)), diskspace.Advice)
		} else {
			u.OK("%s: %s", v.Label(), v.Describe())
		}
	}
	u.Title("Drive health")
	switch drives, err := checkDrives(ctx); {
	case errors.Is(err, diskhealth.ErrNoSmartctl):
		u.Info("to check each drive's own health report (SMART), install smartctl: %s", diskhealth.Install(h.host.OS))
	case err != nil:
		u.Info("could not read the drives' health: %v", err)
	default:
		for _, d := range drives {
			switch {
			case d.Failing():
				fail("%s (%s): %s", d.Label(), d.Device, d.Describe())
			case !d.Readable:
				u.Info("%s (%s): %s", d.Label(), d.Device, d.Describe())
			case len(d.Warnings) > 0:
				u.Warn("%s (%s): %s; plan to replace it and check the backups are current", d.Label(), d.Device, d.Describe())
			default:
				u.OK("%s (%s): %s", d.Label(), d.Device, d.Describe())
			}
		}
	}
	if client != nil {
		dctx, cancel := context.WithTimeout(ctx, 30*time.Second)
		if us, err := client.DiskUsage(dctx); err == nil && len(us) > 0 {
			u.Info("%s keeps %s", hp.Runtime, dockerUsage(us))
		}
		cancel()
	}

	if l, err := h.scheduler(); err == nil {
		u.Title("Scheduled jobs")
		for _, j := range jobs() {
			if l.Status(j.Label).Loaded {
				u.OK("%s (%s)", j.Label, j.When())
			} else {
				u.Warn("%s is not installed: homelab schedule install", j.Label)
			}
		}
		if hp.Scheduler == "systemd" && !lingering() {
			u.Warn("lingering is off, so jobs stop when you log out: loginctl enable-linger %s", os.Getenv("USER"))
		}
		// A sleeping machine takes every app with it.
		if mins, ok := systemSleep(ctx); ok && mins > 0 {
			switch {
			case strings.EqualFold(m["KEEP_AWAKE"], "false"):
				u.Warn("this machine sleeps after %d minutes and KEEP_AWAKE is false: the apps go away while it sleeps", mins)
			case l.Status("com.homelab.agent").Loaded:
				u.OK("set to sleep after %d minutes, but the awake job keeps it up while plugged in", mins)
			default:
				u.Warn("this machine sleeps after %d minutes, taking the apps with it: Install the jobs (homelab schedule install) keeps it awake while plugged in", mins)
			}
		}
	}

	// What the last fetch found (the nightly job's, or the app's); no network here.
	if c, err := upgrade.Inspect(ctx, h.root, false); err == nil {
		switch {
		case c.Ahead > 0 && c.Behind > 0:
			u.Warn("the homelab folder and GitHub have both moved on (%d and %d commits); homelab upgrade needs the local commits pushed or dropped first", c.Ahead, c.Behind)
		case c.Behind > 0:
			u.Info("%d homelab update(s) waiting on GitHub: homelab upgrade (or Setup › Update)", c.Behind)
		}
	}

	if problems > 0 {
		return fmt.Errorf("%d problem(s) found", problems)
	}
	u.Printf("\n  %s\n", u.Green("No blocking problems."))
	return nil
}

func (h *homelab) docsGenerator() (docs.Generator, error) {
	ex, err := envfile.Load(filepath.Join(h.root, ".env.example"))
	if err != nil {
		return docs.Generator{}, err
	}
	return docs.Generator{Catalog: h.catalog, Env: ex.Map(), Version: h.repoVersion()}, nil
}

// docs refreshes the generated facts in docs/ and services/ and creates a
// note for any app that has none yet.
func (h *homelab) docs(_ context.Context, args []string) error {
	fs := newFlags("docs")
	check := fs.Bool("check", false, "")
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	g, err := h.docsGenerator()
	if err != nil {
		return err
	}
	changed, issues, err := g.Sync(!*check)
	if err != nil {
		return err
	}
	for _, c := range changed {
		h.ui.OK("updated %s", c)
	}
	for _, i := range issues {
		h.ui.Fail("%s: %s", i.Path, i.Message)
	}
	if len(issues) > 0 {
		return fmt.Errorf("%d doc problem(s)", len(issues))
	}
	if len(changed) == 0 {
		h.ui.OK("docs are up to date")
	}
	return nil
}

// validate checks compose metadata and the knowledge base (CI runs this).
func (h *homelab) validate(_ context.Context, _ []string) error {
	issues := h.catalog.Validate(h.declaredVars())
	errs, warnings := 0, 0
	for _, i := range issues {
		if i.Error {
			errs++
			h.ui.Fail("%s", i.Message)
		} else {
			warnings++
			h.ui.Warn("%s", i.Message)
		}
	}
	version := h.repoVersion()
	if version == "" {
		errs++
		h.ui.Fail("VERSION is missing")
	}
	g, err := h.docsGenerator()
	if err != nil {
		return err
	}
	_, docIssues, err := g.Sync(false)
	if err != nil {
		return err
	}
	docIssues = append(docIssues, docs.CheckVersions(h.root, version, "docs", "services")...)
	docIssues = append(docIssues, docs.CheckLinks(h.root, "README.md", "CHANGELOG.md", "CONTRIBUTING.md", "app/README.md", "docs", "services")...)
	for _, i := range docIssues {
		errs++
		h.ui.Fail("%s: %s", i.Path, i.Message)
	}
	if errs > 0 {
		return fmt.Errorf("%d error(s)", errs)
	}
	h.ui.OK("%d apps in %d Compose projects, docs at %s (%d warning(s))", len(h.catalog.Apps), len(h.catalog.Files), version, warnings)
	return nil
}

func (h *homelab) declaredVars() map[string]bool {
	ex, err := envfile.Load(filepath.Join(h.root, ".env.example"))
	if err != nil {
		return nil
	}
	out := map[string]bool{}
	for _, k := range ex.Keys() {
		out[k] = true
	}
	return out
}

func versionAtLeast(v string, major, minor int) bool {
	v = strings.TrimPrefix(strings.TrimSpace(v), "v")
	parts := strings.SplitN(v, ".", 3)
	if len(parts) < 2 {
		return false
	}
	ma, _ := strconv.Atoi(parts[0])
	mi, _ := strconv.Atoi(strings.TrimRightFunc(parts[1], func(r rune) bool { return r < '0' || r > '9' }))
	return ma > major || ma == major && mi >= minor
}

func (h *homelab) menu(ctx context.Context) error {
	u := h.ui
	items := []struct {
		label string
		run   func() error
	}{
		{"Start everything (homelab up)", func() error { return h.up(ctx, nil) }},
		{"Status and addresses", func() error { return h.status(ctx, nil) }},
		{"Add an optional app", func() error { return h.install(ctx, nil) }},
		{"Set up the domain (proxy, DNS, tunnel)", func() error { return h.domainSetup(ctx, nil) }},
		{"Back up now", func() error { return h.backup(ctx, nil) }},
		{"Run the watchdog", func() error { return h.watchdog(ctx, nil) }},
		{"Scheduled jobs", func() error { return h.schedule(ctx, []string{"status"}) }},
		{"Check " + h.host.Machine + " (doctor)", func() error { return h.doctor(ctx, nil) }},
	}
	for {
		u.Printf("\n%s  %s\n\n", u.Bold("Homelab "+h.repoVersion()), u.Dim(h.root))
		for i, it := range items {
			u.Printf("  %s  %s\n", u.Cyan(strconv.Itoa(i+1)), it.label)
		}
		u.Printf("  %s  Quit\n", u.Cyan("0"))
		choice, err := u.Ask("\nChoose:")
		if err != nil || choice == "0" || strings.EqualFold(choice, "q") {
			return nil
		}
		n, err := strconv.Atoi(choice)
		if err != nil || n < 1 || n > len(items) {
			u.Fail("pick a number from the list")
			continue
		}
		if err := items[n-1].run(); err != nil && err != errCancelled {
			u.Fail("%v", err)
		}
		if _, err := u.Ask(u.Dim("\nPress Return to continue")); err != nil {
			return nil
		}
	}
}

// containerMemory adds up the memory the running containers use, in bytes.
func containerMemory(ctx context.Context, client *docker.Client) (float64, error) {
	out, err := client.Runner.Output(ctx, client.Bin, "stats", "--no-stream", "--format", "{{.MemUsage}}")
	if err != nil {
		return 0, err
	}
	total := 0.0
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		used, _, _ := strings.Cut(line, "/")
		total += parseSize(used)
	}
	return total, nil
}

// parseSize reads docker's sizes: "512KiB", "1.5GiB", "300MB".
func parseSize(s string) float64 {
	s = strings.TrimSpace(s)
	units := []struct {
		suffix string
		mult   float64
	}{{"KiB", 1 << 10}, {"MiB", 1 << 20}, {"GiB", 1 << 30}, {"TiB", 1 << 40}, {"kB", 1e3}, {"MB", 1e6}, {"GB", 1e9}, {"TB", 1e12}, {"B", 1}}
	for _, u := range units {
		if strings.HasSuffix(s, u.suffix) {
			v, err := strconv.ParseFloat(strings.TrimSuffix(s, u.suffix), 64)
			if err != nil {
				return 0
			}
			return v * u.mult
		}
	}
	return 0
}

// crowdsecBouncer asks CrowdSec whether the proxy's bouncer pulls its ban
// decisions. checked is false unless CrowdSec and the proxy both run.
func crowdsecBouncer(ctx context.Context, client *docker.Client, report *detect.Report, now time.Time) (checked, ok bool, msg string) {
	ctr, running := runningContainer(report, crowdsec.App)
	if _, proxy := runningContainer(report, crowdsec.Proxy); !running || !proxy {
		return false, false, ""
	}
	out, err := client.Exec(ctx, ctr.Name, crowdsec.ListCommand...)
	if err != nil && len(out) == 0 {
		return true, false, fmt.Sprintf("could not ask CrowdSec for its bouncers: %v", err)
	}
	ok, msg = crowdsec.Verdict(out, now)
	return true, ok, msg
}

// tailscaleVerdict reads `tailscale status --json`: whether the node is
// logged in, and whether the tailnet approved the home-network route it
// advertises (approved routes show up as the node's primary routes).
func tailscaleVerdict(status []byte, routes string) (bool, string) {
	var st struct {
		BackendState string
		Self         struct{ PrimaryRoutes []string }
	}
	if err := json.Unmarshal(status, &st); err != nil {
		return false, "Tailscale's status could not be read"
	}
	if st.BackendState != "Running" {
		return false, fmt.Sprintf("Tailscale is %s, not connected: homelab tailnet login opens its sign-in page", strings.ToLower(st.BackendState))
	}
	if routes == "" {
		routes = "192.168.1.0/24"
	}
	var missing []string
	for _, r := range splitList(routes) {
		if r = strings.TrimSpace(r); r != "" && !slices.Contains(st.Self.PrimaryRoutes, r) {
			missing = append(missing, r)
		}
	}
	if len(missing) > 0 {
		return false, fmt.Sprintf("Tailscale is connected, but the route %s is not approved yet: Tailscale admin console › Machines › homelab › Edit route settings", strings.Join(missing, ", "))
	}
	return true, "Tailscale is connected and the home-network route " + routes + " is approved"
}

// selinuxEnforcing reports whether SELinux is on and enforcing. Tests
// replace it.
var selinuxEnforcing = func() bool {
	b, err := os.ReadFile("/sys/fs/selinux/enforce")
	return err == nil && strings.TrimSpace(string(b)) == "1"
}
