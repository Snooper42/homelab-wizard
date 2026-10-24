// Package setup is the first-time bring-up as a checklist: each step has a
// live check (is AdGuard answering, is the certificate valid, are the jobs
// installed), what to fill in on the Settings screen, and the homelab
// commands that do it. Steps only a person can do (a router reservation)
// are marked done by hand. The app's Setup screen and `homelab setup`
// both show it.
package setup

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/domain"
	"github.com/Snooper42/homelab-wizard/internal/duplicati"
	"github.com/Snooper42/homelab-wizard/internal/host"
)

// Step is one item of the checklist.
type Step struct {
	ID       string     `json:"id"`
	Title    string     `json:"title"`
	Why      string     `json:"why"`
	State    string     `json:"state"` // done, todo, or waiting
	Detail   string     `json:"detail,omitempty"`
	Manual   bool       `json:"manual"`             // marked done by hand
	Settings []string   `json:"settings,omitempty"` // keys to fill in on the Settings screen
	Run      [][]string `json:"run,omitempty"`      // homelab commands the step's button runs
	RunLabel string     `json:"runLabel,omitempty"`
	Open     string     `json:"open,omitempty"` // a page to open
	// Choices are alternatives to Run, one button each (where the
	// backups go: each cloud drive and external drive found).
	Choices []Choice `json:"choices,omitempty"`
	// Later: it can wait through the first week (Grace), so it is not
	// counted as left to do until then.
	Later bool `json:"later,omitempty"`
}

// Grace is how long after the homelab's first Setup the steps that can
// wait (backups, the outside check) stay out of what is left to do. After
// it they count again, which is the nudge.
const Grace = 7 * 24 * time.Hour

// Choice is one button of a step with alternatives.
type Choice struct {
	Label string     `json:"label"`
	Run   [][]string `json:"run"`
}

// MacFinds is ThisMac on macOS: the resolver file homelab domain resolver
// writes, or a lookup through the system's own resolver that answers ip.
func MacFinds(dom, ip string) bool {
	if domain.ResolverSet(dom, ip) {
		return true
	}
	out, err := exec.Command("dscacheutil", "-q", "host", "-a", "name", "npm."+dom).Output()
	return err == nil && strings.Contains(string(out), "ip_address: "+ip)
}

// upperFirst starts s with a capital, for "this Mac" at a sentence's start.
func upperFirst(s string) string {
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

// Probe checks the network; tests replace it.
type Probe interface {
	LANAddress() (string, error)
	DNS(ctx context.Context, server string) error
	AdGuard(ctx context.Context, env map[string]string) error
	Cloudflare(ctx context.Context, token, zone string) error
	Certificate(ctx context.Context, ip, hostname string) error
}

// Inputs are what the checks read.
type Inputs struct {
	Env    map[string]string
	Host   host.Profile
	Status *api.Status // nil when the container runtime is not running
	// RuntimeErr is why Status is nil, when known: the runtime refusing
	// this account calls for a different step from starting it.
	RuntimeErr error
	// RuntimeUp is that the runtime answers although Status could not be
	// read: there is no homelab folder yet.
	RuntimeUp bool
	// NoFolder is that the homelab folder is not made yet, which starting
	// the homelab needs first.
	NoFolder bool
	Jobs     func() (installed, total int)
	Done     map[string]bool // manual steps marked done
	Probe    Probe
	// ThisMac reports whether this Mac finds the domain's names at ip (its
	// resolver file, or its DNS); nil skips the step (not a Mac).
	ThisMac func(domain, ip string) bool
	// Backups lists Duplicati's jobs (DuplicatiJobs); nil skips the check.
	Backups func() ([]duplicati.Job, error)
	// Home is the user's home folder; empty means os.UserHomeDir.
	Home string
	// Volumes is where external drives appear; empty means the OS's own.
	Volumes string
	// Power reports whether this machine runs on battery (battery.Power);
	// known is false without a battery. nil skips the laptop step.
	Power func() (onBattery, known bool)
	// Since is when Setup was first opened (FirstSeen); zero keeps every
	// step counted.
	Since time.Time
}

func (in Inputs) home() string {
	if in.Home != "" {
		return in.Home
	}
	home, _ := os.UserHomeDir()
	return home
}

// cloudApps are the cloud drives whose folders Setup offers for backups
// (backup.Destinations), by system.
var cloudApps = map[string]string{
	"darwin":  "Proton Drive, iCloud Drive, Google Drive, OneDrive, or Dropbox",
	"windows": "OneDrive, iCloud Drive, or Dropbox",
	"linux":   "Dropbox, or a OneDrive client that syncs ~/OneDrive",
}

// coreJobs are the backup jobs the Duplicati step waits for: settings,
// databases, and the apps' folders, each run at least once.
var coreJobs = []string{"Homelab Secrets", "Homelab Databases", "Homelab AppData"}

// DuplicatiJobs lists the jobs of the Duplicati on this machine, signing
// in with DUPLICATI_PASSWORD.
func DuplicatiJobs(ctx context.Context, env map[string]string) func() ([]duplicati.Job, error) {
	return func() ([]duplicati.Job, error) {
		ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()
		return duplicati.Jobs(ctx, "http://127.0.0.1:"+or(env["DUPLICATI_PORT"], "8200"), env["DUPLICATI_PASSWORD"], time.Now())
	}
}

// Steps checks every step, in order.
func Steps(ctx context.Context, in Inputs) []Step {
	env, st := in.Env, in.Status
	ip, ipErr := in.Probe.LANAddress()
	dom := env["HOMELAB_DOMAIN"]
	var steps []Step
	done := map[string]bool{}
	add := func(s Step, ok bool, after ...string) {
		for _, a := range after {
			if !done[a] && !ok {
				s.State, s.Detail = "waiting", "after “"+title(steps, a)+"”"
				break
			}
		}
		switch {
		case s.State == "waiting":
		case ok:
			s.State = "done"
		default:
			s.State = "todo"
		}
		done[s.ID] = s.State == "done"
		steps = append(steps, s)
	}
	manual := func(s Step, after ...string) {
		s.Manual = true
		add(s, in.Done[s.ID], after...)
	}

	runtimeDetail := in.Host.StartRuntime
	if docker.NoAccess(in.RuntimeErr) {
		runtimeDetail = upperFirst(in.Host.Unreachable(in.RuntimeErr)) + "."
	}
	add(Step{ID: "runtime", Title: in.Host.Runtime + " is running", Why: "Every app runs inside it, so nothing else works until it does.",
		Detail: runtimeDetail}, st != nil || in.RuntimeUp)
	missing := 0
	if st != nil {
		for _, a := range st.Apps {
			if a.State == "missing" && a.ID != "cloudflared" {
				missing++
			}
		}
	}
	started := Step{ID: "started", Title: "The homelab is started", Why: "Your homelab's own apps start (updates, backups, alerts), each with a strong password made for it.",
		Detail: plural(missing, "baseline app is", "baseline apps are") + " not running", Run: [][]string{{"up", "--apply"}}, RunLabel: "Start the homelab"}
	if in.NoFolder && done["runtime"] {
		started.State, started.Detail = "waiting", "after the homelab folder is set up (Homelab folder, above)"
	}
	add(started, st != nil && missing == 0, "runtime")

	if in.Power != nil {
		if onBattery, laptop := in.Power(); laptop {
			awake := !strings.EqualFold(env["KEEP_AWAKE"], "false")
			lap := Step{ID: "laptop", Title: "This laptop stays plugged in and open", Why: "The apps are there only while it is awake. Plugged in, the homelab keeps it awake; on battery, or with the lid closed, it sleeps and the apps go away.",
				Detail: "Keep it plugged in, with the lid open (closed, a MacBook sleeps unless a display is connected)."}
			switch {
			case !awake:
				lap.Detail = "KEEP_AWAKE is off in Settings, so it sleeps when the system says, even plugged in: turn it on. " + lap.Detail
				lap.Settings = []string{"KEEP_AWAKE"}
			case onBattery:
				lap.Detail = "It is on battery now: plug it in. " + lap.Detail
			}
			add(lap, awake && !onBattery)
		}
	}

	addr := Step{ID: "address", Title: "This machine keeps its address", Why: "Your phones find the apps at this address; if the router hands out a new one, the apps seem to vanish.",
		Detail: "Reserve " + ip + " for " + in.Host.Machine + " in the router (a DHCP reservation)."}
	if ipErr != nil {
		addr.Detail = "Could not detect this machine's address: " + ipErr.Error()
	}
	// Only a domain points names at the home address (AdGuard Home on the
	// home network). In Home mode phones use the tailnet's address, which
	// never changes, so the router needs nothing.
	if dom != "" {
		manual(addr)
	}

	vwOpen := "https://passwords." + dom
	if dom == "" {
		// Home mode: no domain, so Tailscale gives every app an https
		// address on the tailnet instead of AdGuard, Cloudflare and NPM.
		tsUp := false
		if st != nil {
			for _, a := range st.Apps {
				tsUp = tsUp || a.ID == "tailscale" && a.State == "running"
			}
		}
		ts := Step{ID: "tailnet", Title: "Addresses on your tailnet (Tailscale)", Why: "Gives every app an https address that works on your own phones and computers, at home and away, with nothing published to the internet.",
			Detail: "Sign in to Tailscale when its page opens in the browser (make a free account there if you have none). In the Tailscale admin console › DNS, turn on HTTPS Certificates.",
			Run:    [][]string{{"install", "tailscale", "--apply"}, {"tailnet", "setup"}}, RunLabel: "Set up the addresses", Open: "https://login.tailscale.com/admin/dns"}
		add(ts, tsUp && env["TAILSCALE_HOST"] != "", "started")
		vwOpen = ""
		if h := env["TAILSCALE_HOST"]; h != "" {
			vwOpen = "https://" + h + ":" + or(env["VAULTWARDEN_PORT"], "8087")
		}
	} else {
		dnsErr := errString(ip != "", func() error { return in.Probe.DNS(ctx, ip) })
		adgErr := ""
		if dnsErr == "" {
			adgErr = errString(env["ADGUARD_PASSWORD"] != "", func() error { return in.Probe.AdGuard(ctx, env) })
		}
		adg := Step{ID: "adguard", Title: "Home DNS answers (AdGuard Home)", Why: "Makes the example.com names point at this machine at home, and blocks ads.",
			Settings: []string{"ADGUARD_USER", "ADGUARD_PASSWORD"}, Open: "http://localhost:" + or(env["ADGUARD_SETUP_PORT"], "3002"),
			Run: [][]string{{"adguard", "setup"}}, RunLabel: "Set up AdGuard"}
		switch {
		case dnsErr != "":
			adg.Detail = "AdGuard does not answer on " + ip + ":53 yet: Set up AdGuard answers its first-run wizard with a new login (or, if you made one there, put it in Settings)."
		case adgErr != "":
			adg.Detail, adg.Open = "AdGuard answers, but the login in Settings does not work: "+adgErr, ""
		}
		add(adg, dnsErr == "" && adgErr == "", "started")

		cfErr := errString(env["CLOUDFLARE_API_TOKEN"] != "", func() error { return in.Probe.Cloudflare(ctx, env["CLOUDFLARE_API_TOKEN"], dom) })
		cf := Step{ID: "cloudflare", Title: "Cloudflare API token", Why: "Lets the homelab get the certificate and publish the tunnel's addresses.",
			Settings: []string{"CLOUDFLARE_API_TOKEN"}, Open: "https://dash.cloudflare.com/profile/api-tokens",
			Detail: "Create a custom token with Zone › Zone › Read, Zone › DNS › Edit, and Account › Cloudflare Tunnel › Edit for " + dom + "."}
		if cfErr != "" && env["CLOUDFLARE_API_TOKEN"] != "" {
			cf.Detail = "The token does not work for " + dom + ": " + cfErr
		}
		add(cf, cfErr == "")

		probeHost := "npm." + dom
		if st != nil {
			for _, a := range st.Apps {
				if a.State == "running" && a.Address != "" {
					probeHost = a.Address
					break
				}
			}
		}
		certErr := errString(ip != "" && dom != "", func() error { return in.Probe.Certificate(ctx, ip, probeHost) })
		add(Step{ID: "domain", Title: "Addresses and certificate", Why: "Gives every app an https://…" + dom + " address with a trusted certificate.",
			Detail: "https://" + probeHost + " is not served with a valid certificate yet.", Run: [][]string{{"domain", "setup", "--ssl", "--apply"}}, RunLabel: "Set up the domain"},
			certErr == "", "adguard", "cloudflare")
		if in.ThisMac != nil && ip != "" {
			machine := in.Host.Machine
			if machine == "" {
				machine = "this machine"
			}
			add(Step{ID: "thismac", Title: upperFirst(machine) + " finds its apps by name", Why: "So the " + dom + " addresses open on " + machine + " too, also with a VPN on, and for apps added later.",
				Detail: upperFirst(machine) + " looks names up elsewhere (its network or VPN DNS). The button points every " + dom + " name at AdGuard Home; it asks for the administrator's password once.",
				Run:    [][]string{{"domain", "resolver", "--apply"}}, RunLabel: "Find the apps on " + machine},
				in.ThisMac(dom, ip), "adguard")
		}
	}

	vw := Step{ID: "vaultwarden", Title: "Password manager account", Why: "One place for every password in the household, on every phone and computer, instead of a cloud password manager.",
		Detail: "Open sign-ups, create the accounts, and they close by themselves after 10 minutes; this comes before the tunnel so they are never open to the internet.",
		Run:    [][]string{{"signups", "open", "--apply"}}, RunLabel: "Open sign-ups for 10 minutes", Open: vwOpen}
	if open, _ := strconv.ParseBool(env["VAULTWARDEN_SIGNUPS_ALLOWED"]); open {
		vw.Detail = "Sign-ups are open now: create the accounts, then close them (homelab signups close)."
	}
	addresses := "domain"
	if dom == "" {
		addresses = "tailnet"
	}
	// With the small baseline, the password manager is a pick of its own;
	// its steps wait until it is installed.
	if has(st, "vaultwarden") {
		manual(vw, addresses)
	}
	if has(st, "vaultwarden") || has(st, "nginx-proxy-manager") {
		manual(Step{ID: "twofactor", Title: "Two-step sign-in", Why: "A stolen password alone then opens neither your password vault nor the homelab's settings.",
			Detail: "In each Vaultwarden account: Settings › Security › Two-step login, with an authenticator app; keep the recovery code with the recovery kit. In Nginx Proxy Manager, add a personal administrator under Users and turn on Two-Factor Auth in its avatar menu. Leave it off for the account in NPM_API_EMAIL: the homelab signs in with that one.",
			Open:   vwOpen}, "vaultwarden")
	}

	tunnelUp := false
	if st != nil {
		for _, a := range st.Apps {
			tunnelUp = tunnelUp || a.ID == "cloudflared" && a.State == "running"
		}
	}
	if dom != "" {
		add(Step{ID: "tunnel", Title: "Access away from home (Cloudflare Tunnel)", Why: "Publishes the public apps without opening ports on the router.",
			Detail:   "Create a tunnel in Cloudflare Zero Trust › Networks › Tunnels, put its token in TUNNEL_TOKEN, then start it.",
			Settings: []string{"TUNNEL_TOKEN"}, Run: [][]string{{"up", "--apply"}, {"domain", "setup", "--apply"}}, RunLabel: "Start the tunnel",
			Open: "https://one.dash.cloudflare.com/"}, env["TUNNEL_TOKEN"] != "" && tunnelUp, "vaultwarden")
	}

	dest := env["BACKUP_DESTINATION"]
	bk := Step{ID: "backups", Title: "Backups leave this machine", Why: "Every night Duplicati encrypts the settings, databases, and photos into this folder. A cloud drive keeps them safe from fire and theft; an external drive is quicker to restore from.",
		Detail: "Install a cloud drive's app (" + or(cloudApps[in.Host.OS], cloudApps["linux"]) + ") or plug in an external drive, then Check again; or choose any folder in Settings.", Settings: []string{"BACKUP_DESTINATION"}}
	drives := backup.Drives(in.Host.OS, in.home())
	if in.Volumes != "" {
		drives = backup.DrivesIn(in.Volumes, nil)
	}
	if dests := backup.Destinations(in.Host.OS, in.home(), drives, env["MEDIA_ROOT"]); len(dests) > 0 {
		bk.Detail = "Pick one: each makes a “" + backup.FolderName + "” folder there. Or choose any folder in Settings."
		for _, d := range dests {
			bk.Choices = append(bk.Choices, Choice{Label: "Use " + d.Label, Run: [][]string{{"duplicati", "destination", d.Path, "--apply"}}})
		}
	}
	// Backups and the outside check can wait through the first week, so a
	// newcomer gets the apps going first; then they count again.
	later := !in.Since.IsZero() && time.Since(in.Since) < Grace
	bk.Later = later
	add(bk, dest != "" && dest != "./backups" && isDir(dest))
	dup := Step{ID: "duplicati", Title: "Backup jobs in Duplicati", Why: "Every night your settings, databases, and photos are encrypted into the backup folder, so a dead disk loses nothing.",
		Detail: "Creates the jobs from docs/Automation.md with generated passphrases (kept in .env) and runs the small ones once. Then copy DUPLICATI_SECRETS_PASSPHRASE (Settings › Copy) into Vaultwarden and onto the recovery kit.",
		Run:    [][]string{{"duplicati", "setup", "--apply"}}, RunLabel: "Create the backup jobs", Open: "http://localhost:" + or(env["DUPLICATI_PORT"], "8200")}
	dupOK := false
	if in.Backups != nil {
		if jobs, err := in.Backups(); err != nil {
			dup.Detail = "Duplicati: " + err.Error()
		} else {
			ran := map[string]bool{}
			have := map[string]bool{}
			for _, j := range jobs {
				have[strings.ToLower(j.Name)] = true
				ran[strings.ToLower(j.Name)] = !j.LastFinished.IsZero()
			}
			var missing, waiting []string
			for _, name := range coreJobs {
				switch {
				case !have[strings.ToLower(name)]:
					missing = append(missing, name)
				case !ran[strings.ToLower(name)]:
					waiting = append(waiting, name)
				}
			}
			dupOK = len(missing) == 0 && len(waiting) == 0
			if len(missing) == 0 && len(waiting) > 0 {
				dup.Detail = "Waiting for a first successful run of " + strings.Join(waiting, ", ") + " (Backups › Off-site jobs shows it; run it from Duplicati if it does not start)."
				dup.Run, dup.RunLabel = nil, ""
			}
		}
	}
	dup.Later = later
	add(dup, dupOK, "backups")
	manual(Step{ID: "alerts", Title: "Alerts on the phone", Why: "Your phone hears about it when an app, a backup, or the connection from outside fails, instead of you finding out later.",
		Detail: "Gives the alert sources their token (Duplicati included) and makes the phone's login. Then, if you use Uptime Kuma, add it there; in the phone's ntfy app sign in as phone with Settings › ntfy phone password › Copy and subscribe to the topics (docs/Monitoring.md).", Run: [][]string{{"notify", "setup", "--apply"}}, RunLabel: "Set up the alert token"}, "started")

	installed, total := 0, 0
	if in.Jobs != nil {
		installed, total = in.Jobs()
	}
	add(Step{ID: "jobs", Title: "Scheduled jobs", Why: "The homelab looks after itself: it starts again after a restart, backs up every night, and checks every app every 15 minutes.",
		Detail: plural(total-installed, "job is", "jobs are") + " not installed", Run: [][]string{{"schedule", "install", "--apply"}}, RunLabel: "Install the jobs"},
		total > 0 && installed == total, "started")
	add(Step{ID: "heartbeat", Title: "Alerts when this machine is down", Why: "If this machine loses power or crashes, an outside service notices the silence and tells you (the alerts above run here, so they cannot).",
		Detail:   "Create a check at healthchecks.io (period 15 minutes, grace 15 minutes) and put its ping URL in HEARTBEAT_URL.",
		Settings: []string{"HEARTBEAT_URL"}, Open: "https://healthchecks.io/", Later: later}, env["HEARTBEAT_URL"] != "", "jobs")
	if dom == "" {
		manual(Step{ID: "devices", Title: "Tailscale on phones and computers", Why: "Install Tailscale on each phone and computer, and the apps open on them at home and away.",
			Detail: "Install the Tailscale app on each phone and computer and sign in with the same account."}, "tailnet")
		// Ad blocking is a pick of its own in Home mode (Choose stacks ›
		// Ad blocking): no address depends on AdGuard here.
		if has(st, "tailnet-dns") {
			manual(Step{ID: "adblock", Title: "Ad blocking on every device", Why: "AdGuard Home answers the lookups of every phone and computer signed in to Tailscale and drops ads and trackers, at home and away, with no router change.",
				Detail: "Set up ad blocking, then do what it shows: in the Tailscale admin console › DNS, add this machine's tailnet address as a custom nameserver and turn on Override DNS servers.",
				Run:    [][]string{{"adguard", "setup"}}, RunLabel: "Set up ad blocking", Open: "https://login.tailscale.com/admin/dns"}, "tailnet")
		}
	} else {
		manual(Step{ID: "devices", Title: "Phones and computers use the home DNS", Why: "So the " + dom + " names work at home.",
			Detail: "On each device, set the Wi-Fi DNS server to " + ip + " (the router cannot hand it out)."}, "adguard")
	}
	return steps
}

// has reports whether the homelab has the app: status lists every baseline
// app and every installed one. Without a status, it assumes so.
func has(st *api.Status, id string) bool {
	if st == nil {
		return true
	}
	for _, a := range st.Apps {
		if a.ID == id {
			return true
		}
	}
	return false
}

func title(steps []Step, id string) string {
	for _, s := range steps {
		if s.ID == id {
			return s.Title
		}
	}
	return id
}

func errString(ready bool, check func() error) string {
	if !ready {
		return "not set"
	}
	if err := check(); err != nil {
		return err.Error()
	}
	return ""
}

func or(v, def string) string {
	if v != "" {
		return v
	}
	return def
}

func plural(n int, one, many string) string {
	if n == 1 {
		return "1 " + one
	}
	return strconv.Itoa(n) + " " + many
}

func isDir(p string) bool {
	if strings.HasPrefix(p, "~/") {
		home, _ := os.UserHomeDir()
		p = filepath.Join(home, p[2:])
	}
	st, err := os.Stat(p)
	return err == nil && st.IsDir()
}

// NetProbe checks the real network.
type NetProbe struct{}

// LANAddress is this machine's address on the home network.
func (NetProbe) LANAddress() (string, error) { return domain.LANAddress() }

// DNS asks server for a well-known name.
func (NetProbe) DNS(ctx context.Context, server string) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	r := &net.Resolver{PreferGo: true, Dial: func(ctx context.Context, network, _ string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, network, net.JoinHostPort(server, "53"))
	}}
	_, err := r.LookupHost(ctx, "apple.com")
	return err
}

// AdGuard logs in with the .env credentials.
func (NetProbe) AdGuard(ctx context.Context, env map[string]string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	return domain.NewAdGuard("http://127.0.0.1:"+or(env["ADGUARD_PORT"], "3003"), or(env["ADGUARD_USER"], "admin"), env["ADGUARD_PASSWORD"]).Check(ctx)
}

// Cloudflare reads the zone with the token.
func (NetProbe) Cloudflare(ctx context.Context, token, zone string) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	_, err := domain.NewCloudflare(token).ZoneID(ctx, zone)
	return err
}

// Certificate connects to the proxy as hostname and verifies its certificate.
func (NetProbe) Certificate(ctx context.Context, ip, hostname string) error {
	d := &tls.Dialer{NetDialer: &net.Dialer{Timeout: 5 * time.Second}, Config: &tls.Config{ServerName: hostname}}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	c, err := d.DialContext(ctx, "tcp", net.JoinHostPort(ip, "443"))
	if err != nil {
		return err
	}
	return c.Close()
}

// donePath keeps the manual steps marked done, next to the homelab's data.
func donePath(root string) string { return filepath.Join(root, "data", "setup.json") }

// saved is data/setup.json: the manual steps marked done, and when Setup
// was first opened.
type saved struct {
	Done  map[string]bool `json:"done"`
	Since time.Time       `json:"since,omitzero"`
}

func load(root string) saved {
	var f saved
	if data, err := os.ReadFile(donePath(root)); err == nil {
		_ = json.Unmarshal(data, &f)
	}
	if f.Done == nil {
		f.Done = map[string]bool{}
	}
	return f
}

func (f saved) save(root string) error {
	if err := os.MkdirAll(filepath.Dir(donePath(root)), 0o755); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(f, "", "  ")
	return os.WriteFile(donePath(root), data, 0o644)
}

// LoadDone reads the manual steps marked done.
func LoadDone(root string) map[string]bool { return load(root).Done }

// MarkDone records a manual step as done (or not).
func MarkDone(root, id string, done bool) error {
	f := load(root)
	if done {
		f.Done[id] = true
	} else {
		delete(f.Done, id)
	}
	return f.save(root)
}

// FirstSeen is when Setup was first opened for the homelab at root,
// noted now if it never was.
func FirstSeen(root string) time.Time {
	f := load(root)
	if f.Since.IsZero() {
		f.Since = time.Now().UTC().Truncate(time.Second)
		_ = f.save(root)
	}
	return f.Since
}
