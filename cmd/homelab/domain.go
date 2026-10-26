package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/domain"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/install"
	"github.com/Snooper42/homelab-wizard/internal/npm"
	"github.com/Snooper42/homelab-wizard/internal/selector"
)

const (
	npmID     = "nginx-proxy-manager"
	adguardID = "adguard-home"
	tunnelID  = "cloudflared"
	// tunnelService is where the tunnel sends public traffic: the proxy, so
	// CrowdSec sees and blocks it like LAN traffic.
	tunnelService = "http://" + npmID + ":80"
)

// cloudflareAPI is the Cloudflare API base URL (tests point it at a fake).
var cloudflareAPI = "https://api.cloudflare.com/client/v4"

func (h *homelab) domain(ctx context.Context, args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: homelab domain setup [domain] | homelab domain status")
	}
	switch args[0] {
	case "setup":
		return h.domainSetup(ctx, args[1:])
	case "status":
		return h.domainStatus(ctx)
	case "resolver":
		return h.domainResolver(args[1:])
	}
	return fmt.Errorf("unknown domain command %q (setup, status, resolver)", args[0])
}

// domainResolver makes this Mac look up every name under the domain in
// AdGuard Home on this machine (/etc/resolver/<domain>), whatever DNS the
// network or a VPN sets, and for apps added later too.
func (h *homelab) domainResolver(args []string) error {
	fs := newFlags("domain resolver")
	apply := applyFlag(fs)
	ip := fs.String("ip", "", "")
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	dom := h.envMap()["HOMELAB_DOMAIN"]
	if dom == "" {
		return fmt.Errorf("no domain yet (HOMELAB_DOMAIN): in Home mode the tailnet's own names work already")
	}
	lan := *ip
	if lan == "" {
		var err error
		if lan, err = domain.LANAddress(); err != nil {
			return fmt.Errorf("could not detect %s's address on the home network; pass --ip: %w", h.host.Machine, err)
		}
	}
	u := h.ui
	machine := h.host.Machine
	if domain.FindsByName(dom, lan) {
		u.OK("%s already looks up every %s name in AdGuard Home (%s)", machine, dom, domain.ResolverWhere(dom))
		return nil
	}
	u.Title(strings.ToUpper(machine[:1]) + machine[1:] + " finds its apps by name")
	u.Info("set %s: every %s name is looked up in AdGuard Home at %s", domain.ResolverWhere(dom), dom, lan)
	u.Info("%s", u.Dim("it works with a VPN on, and for apps added later; it asks for the administrator's password once"))
	if err := h.goAhead(*apply, "\nSet it?"); err != nil {
		return err
	}
	if err := domain.SetResolver(dom, lan); err != nil {
		return err
	}
	u.OK("%s looks up every %s name in AdGuard Home", machine, dom)
	return nil
}

type domainOptions struct {
	apps, dns, cfToken, ip      string
	ssl, noTunnel, dryRun, auto bool
	apply                       *bool
}

func (h *homelab) domainSetup(ctx context.Context, args []string) error {
	env0 := h.envMap()
	fs := newFlags("domain setup")
	o := domainOptions{apply: applyFlag(fs)}
	fs.StringVar(&o.apps, "apps", "", "")
	fs.StringVar(&o.dns, "dns", "", "")
	fs.BoolVar(&o.ssl, "ssl", false, "")
	fs.StringVar(&o.cfToken, "cloudflare-token", env0["CLOUDFLARE_API_TOKEN"], "")
	fs.StringVar(&o.ip, "ip", "", "")
	fs.BoolVar(&o.noTunnel, "no-tunnel", false, "")
	fs.BoolVar(&o.dryRun, "dry-run", false, "")
	// --auto: after an install, give the new apps their hostnames without
	// asking, once the domain has been set up (the certificate exists).
	fs.BoolVar(&o.auto, "auto", false, "")
	pos, err := parseFlags(fs, args)
	if err != nil {
		return err
	}
	raw := env0["HOMELAB_DOMAIN"]
	if len(pos) > 0 {
		raw = pos[0]
	}
	if o.auto && strings.EqualFold(env0["AUTO_DOMAIN"], "false") {
		return nil // switched off
	}
	if o.auto && raw == "" {
		return h.tailnetSetup(ctx, true) // Home mode: addresses on the tailnet
	}
	if o.auto && (env0["NPM_API_EMAIL"] == "" || env0["NPM_API_PASSWORD"] == "") {
		return nil
	}
	if raw == "" {
		return fmt.Errorf("usage: homelab domain setup <domain>   (for example example.com)")
	}
	dom, err := domain.Normalize(raw)
	if err != nil {
		return err
	}
	// With a Cloudflare token the certificate comes along unless --ssl=false:
	// HTTP-only hostnames would fail on every device pointed at the proxy.
	sslSet := false
	fs.Visit(func(f *flag.Flag) { sslSet = sslSet || f.Name == "ssl" })
	if !sslSet && o.cfToken != "" {
		o.ssl = true
	}
	if o.ssl && o.cfToken == "" {
		return fmt.Errorf("--ssl issues a wildcard Let's Encrypt certificate through Cloudflare DNS; set CLOUDFLARE_API_TOKEN in .env (%s) or pass --cloudflare-token", cloudflarePermissions)
	}

	client, err := h.docker(ctx)
	if err != nil {
		return err
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return err
	}
	report := detect.Analyze(h.catalog, containers)
	env, envChanges, err := envfile.Prepare(h.envFile, filepath.Join(h.root, ".env.example"), domain.HostIdentity())
	if err != nil {
		return err
	}
	if cur, _ := env.Get("HOMELAB_DOMAIN"); cur != dom {
		env.Set("HOMELAB_DOMAIN", dom)
	}
	envMap := env.Map()
	lookup := compose.MapLookup(envMap)
	running := func(id string) bool { st, _ := report.State(id); return st == detect.Running }
	if o.auto {
		// Only where Set up the domain has run: the proxy is up with its
		// certificate. DNS needs nothing (AdGuard's *.domain rewrite covers
		// new names; /etc/hosts would ask for a password).
		if !running(npmID) || !h.hasWildcard(ctx, envMap, dom) {
			h.ui.Info("new apps get their %s addresses once Setup › Set up the domain has run", dom)
			return nil
		}
		// LAN only: new apps get their proxy hosts; publishing to the
		// internet stays a deliberate Set up the domain with a tunnel.
		o.dns, o.noTunnel, *o.apply = "none", true, true
	}

	// Which apps get a hostname: everything running with a web UI (plus the
	// proxy itself and native apps), or the --apps selection.
	var targets []*catalog.App
	if o.apps != "" {
		sel, err := selector.Resolve(h.catalog, splitList(o.apps), nil)
		if err != nil {
			return err
		}
		for _, a := range sel.Apps {
			if sel.Requested[a.ID] {
				targets = append(targets, a)
			}
		}
	} else {
		for _, a := range h.catalog.Apps {
			if a.ID == npmID || a.Native() != nil || running(a.ID) {
				targets = append(targets, a)
			}
		}
	}
	routes := domain.Routes(targets, dom, lookup)

	// LAN DNS: AdGuard when it runs and the CLI can sign in, otherwise /etc/hosts.
	if o.dns == "" {
		o.dns = "hosts"
		if running(adguardID) && envMap["ADGUARD_PASSWORD"] != "" {
			o.dns = "adguard"
		}
	}
	switch o.dns {
	case "adguard", "hosts", "none":
	default:
		return fmt.Errorf("--dns must be adguard, hosts, or none")
	}
	lanIP := o.ip
	if o.dns == "adguard" && lanIP == "" {
		if lanIP, err = domain.LANAddress(); err != nil {
			return fmt.Errorf("could not detect %s's LAN address; pass --ip: %w", h.host.Machine, err)
		}
	}

	// Public hostnames through the tunnel.
	var public []domain.Route
	var tunnel domain.Tunnel
	tunnelNote := ""
	switch {
	case o.noTunnel:
	case envMap["TUNNEL_TOKEN"] == "":
		tunnelNote = "TUNNEL_TOKEN is empty, so no app is published to the internet"
	case o.cfToken == "":
		tunnelNote = "CLOUDFLARE_API_TOKEN is empty, so the tunnel's public hostnames are left as they are"
	default:
		if tunnel, err = domain.ParseTunnelToken(envMap["TUNNEL_TOKEN"]); err != nil {
			return err
		}
		for _, r := range routes {
			if publishable(r.App.ID, r.App.Public(), envMap) {
				public = append(public, r)
			} else if r.App.Public() {
				tunnelNote = r.App.Name() + " stays off the internet until homelab notify setup has run (it needs the publishers' token)"
			}
		}
	}

	// Show the plan.
	u := h.ui
	u.Title("Domain plan: " + dom)
	if running(npmID) {
		u.Info("use the running Nginx Proxy Manager")
	} else {
		u.Info("start Nginx Proxy Manager (and CrowdSec)")
	}
	for _, c := range envChanges {
		if c.Key == ".env" {
			u.Info("create .env from .env.example")
		}
	}
	if o.ssl {
		u.Info("wildcard certificate for *.%s from Let's Encrypt (Cloudflare DNS challenge)", dom)
	}
	switch o.dns {
	case "adguard":
		u.Info("AdGuard Home: *.%s → %s (%s)", dom, lanIP, h.host.Machine)
	case "hosts":
		u.Info("add %d hostname(s) to the hosts file on %s (%s) %s", len(routes), h.host.Machine, domain.HostsPath(), u.Dim("(asks for an administrator; other devices need AdGuard)"))
	case "none":
		u.Info("DNS: not changed; point *.%s at %s yourself", dom, h.host.Machine)
	}
	if len(public) > 0 {
		u.Info("Cloudflare Tunnel: publish %d app(s) through the proxy", len(public))
	}
	if tunnelNote != "" {
		u.Info("%s", tunnelNote)
	}
	scheme := "http"
	if o.ssl || h.hasWildcard(ctx, envMap, dom) {
		scheme = "https"
	}
	u.Printf("\n  %s\n", u.Bold(fmt.Sprintf("Hostnames (%d)", len(routes))))
	var rows [][]string
	for _, r := range routes {
		flag := ""
		if publishable(r.App.ID, r.App.Public(), envMap) && len(public) > 0 {
			flag = u.Green("public")
		}
		rows = append(rows, []string{u.Cyan(scheme + "://" + r.Host), u.Dim("→ " + r.ForwardHost + ":" + strconv.Itoa(r.ForwardPort)), flag})
	}
	u.Table(nil, rows)
	if o.dryRun {
		u.Printf("\n%s\n", u.Dim("Dry run: nothing was changed."))
		return nil
	}
	if err := h.goAhead(*o.apply, "\nApply?"); err != nil {
		return err
	}

	// 1. The proxy is running.
	fromTailnet := h.clearTailnetURLs(env)
	if err := env.Save(); err != nil {
		return err
	}
	if err := h.recreate(ctx, client, report, fromTailnet, "with its address on "+dom); err != nil {
		return err
	}
	if !running(npmID) {
		if err := h.installApps(ctx, client, containers, []string{npmID, "crowdsec"}); err != nil {
			return err
		}
		// Installing can move a port that was taken; use what it saved.
		envMap = h.envMap()
	}
	if envMap["NPM_HTTP_PORT"] != "80" || envMap["NPM_HTTPS_PORT"] != "443" {
		u.Warn("the proxy listens on ports %s and %s, not 80 and 443, so hostnames only work with the port added; free 80 and 443 and set NPM_HTTP_PORT/NPM_HTTPS_PORT back", envMap["NPM_HTTP_PORT"], envMap["NPM_HTTPS_PORT"])
	}

	// 2. API access with the account created on NPM's first start.
	api := npm.New("http://127.0.0.1:" + envMap["NPM_ADMIN_PORT"])
	waitCtx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()
	u.Printf("\n  Waiting for Nginx Proxy Manager...\n")
	if err := api.WaitHealthy(waitCtx, 2*time.Second); err != nil {
		return err
	}
	if err := api.Login(ctx, envMap["NPM_API_EMAIL"], envMap["NPM_API_PASSWORD"]); err != nil {
		if errors.Is(err, npm.ErrUnauthorized) {
			return fmt.Errorf("Nginx Proxy Manager rejected NPM_API_EMAIL/NPM_API_PASSWORD from .env. That account is created on NPM's first start; if NPM was set up before, create it in the NPM UI (http://localhost:%s) and update .env", envMap["NPM_ADMIN_PORT"])
		}
		return err
	}

	// 3. Certificate: looked up now that NPM answers, so a slow start never
	// leaves the hosts without the one they have.
	settings := domain.Settings{}
	cert, found, err := domain.FindWildcard(ctx, api, dom)
	if err != nil {
		return err
	}
	if !found && o.ssl {
		u.Printf("  Requesting the certificate (this can take a few minutes)...\n")
		if cert, _, err = domain.WildcardCertificate(ctx, api, dom, o.cfToken); err != nil {
			return err
		}
		u.OK("certificate issued for *.%s", dom)
		found = true
	}
	if found {
		settings = domain.Settings{CertificateID: cert.ID, ForceSSL: true}
		scheme = "https"
	}

	// 4. Proxy hosts.
	results, err := domain.Sync(ctx, api, routes, settings)
	if err != nil {
		return err
	}
	removed, err := domain.Withdraw(ctx, api, h.catalog.Apps, dom)
	if err != nil {
		return err
	}
	for _, host := range removed {
		u.OK("removed %s: that app is kept to this computer (docs/Security.md, L1)", host)
	}

	// 5. LAN DNS.
	switch o.dns {
	case "adguard":
		ag := domain.NewAdGuard("http://127.0.0.1:"+envMap["ADGUARD_PORT"], envMap["ADGUARD_USER"], envMap["ADGUARD_PASSWORD"])
		action, err := ag.UpsertRewrite(ctx, "*."+dom, lanIP)
		if err != nil {
			return err
		}
		u.OK("AdGuard Home: *.%s → %s (%s)", dom, lanIP, action)
	case "hosts":
		hostsFile := domain.HostsPath()
		current, err := os.ReadFile(hostsFile)
		if err != nil {
			return err
		}
		var names []string
		for _, r := range routes {
			names = append(names, r.Host)
		}
		if next := domain.HostsBlock(string(current), "127.0.0.1", names); next != string(current) {
			if err := domain.WriteHosts(hostsFile, next); err != nil {
				return err
			}
		}
		u.OK("the hosts file points %d hostname(s) at %s", len(names), h.host.Machine)
	}

	// 6. Public hostnames.
	if len(public) > 0 {
		var hosts []string
		for _, r := range public {
			hosts = append(hosts, r.Host)
		}
		cf := domain.NewCloudflare(o.cfToken)
		cf.BaseURL = cloudflareAPI
		pub, err := domain.Publish(ctx, cf, tunnel, dom, hosts, tunnelService)
		if err != nil {
			if strings.Contains(err.Error(), "Authentication error") {
				return fmt.Errorf("publishing through the tunnel: the Cloudflare token was refused; it needs %s: %w", cloudflarePermissions, err)
			}
			return fmt.Errorf("publishing through the tunnel: %w", err)
		}
		changed := 0
		for _, a := range pub.DNS {
			if a != "unchanged" {
				changed++
			}
		}
		u.OK("Cloudflare Tunnel: %d public hostname(s) (%d DNS record(s) changed, ingress %s)", len(hosts), changed, map[bool]string{true: "updated", false: "unchanged"}[pub.IngressChanged])
		if !running(tunnelID) {
			u.Warn("cloudflared is not running yet: homelab up starts it now that TUNNEL_TOKEN is set")
		}
	}

	u.Title("Your apps")
	rows = nil
	for _, r := range results {
		rows = append(rows, []string{u.Cyan(scheme + "://" + r.Route.Host), r.Route.App.Name(), u.Dim(r.Action)})
	}
	u.Table(nil, rows)
	return nil
}

// hasWildcard reports whether NPM already holds a *.domain certificate.
func (h *homelab) hasWildcard(ctx context.Context, env map[string]string, dom string) bool {
	api := npm.New("http://127.0.0.1:" + env["NPM_ADMIN_PORT"])
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if api.Login(ctx, env["NPM_API_EMAIL"], env["NPM_API_PASSWORD"]) != nil {
		return false
	}
	certs, err := api.Certificates(ctx)
	if err != nil {
		return false
	}
	for _, c := range certs {
		for _, d := range c.DomainNames {
			if strings.EqualFold(d, "*."+dom) {
				return true
			}
		}
	}
	return false
}

// installApps runs the normal install flow for a few apps without prompting.
func (h *homelab) installApps(ctx context.Context, client *docker.Client, containers []docker.Container, ids []string) error {
	sel, err := selector.Resolve(h.catalog, ids, nil)
	if err != nil {
		return err
	}
	home, _ := os.UserHomeDir()
	plan, err := install.Build(install.Inputs{
		Catalog: h.catalog, EnvFile: h.envFile, EnvExample: filepath.Join(h.root, ".env.example"),
		Containers: containers, Prober: newProber(), Identity: domain.HostIdentity(), Home: home,
	}, sel)
	if err != nil {
		return err
	}
	if !plan.Ready() {
		h.showPlan("Starting "+strings.Join(ids, ", "), plan)
		return fmt.Errorf("cannot start %s", strings.Join(ids, ", "))
	}
	return install.Apply(ctx, plan, client, h.catalog, h.envFile)
}

func (h *homelab) domainStatus(ctx context.Context) error {
	env := h.envMap()
	u := h.ui
	dom := env["HOMELAB_DOMAIN"]
	u.Title("Domain")
	if dom == "" {
		u.Printf("  No domain set. Run: %s\n", u.Bold("homelab domain setup example.com"))
		return nil
	}
	u.Info("domain: %s", dom)
	u.Info("proxy listens on %s (HTTP %s, HTTPS %s)", env["LAN_BIND_IP"], env["NPM_HTTP_PORT"], env["NPM_HTTPS_PORT"])
	client, err := h.docker(ctx)
	if err != nil {
		return err
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return err
	}
	report := detect.Analyze(h.catalog, containers)
	var public []string
	for _, a := range h.catalog.Apps {
		if st, _ := report.State(a.ID); st == detect.Running && publishable(a.ID, a.Public(), env) {
			public = append(public, a.Subdomain()+"."+dom)
		}
	}
	sort.Strings(public)
	switch {
	case env["TUNNEL_TOKEN"] == "":
		u.Info("public apps: none (TUNNEL_TOKEN is empty)")
	case len(public) == 0:
		u.Info("public apps: none running")
	default:
		u.Info("public apps: %s", strings.Join(public, ", "))
	}
	if st, _ := report.State(npmID); st != detect.Running {
		u.Warn("Nginx Proxy Manager is not running")
		return nil
	}
	api := npm.New("http://127.0.0.1:" + env["NPM_ADMIN_PORT"])
	if err := api.Login(ctx, env["NPM_API_EMAIL"], env["NPM_API_PASSWORD"]); err != nil {
		u.Warn("cannot read proxy hosts: %v", err)
		return nil
	}
	hosts, err := api.ProxyHosts(ctx)
	if err != nil {
		return err
	}
	var rows [][]string
	for _, ph := range hosts {
		tls := u.Dim("http")
		if ph.CertificateID > 0 {
			tls = u.Green("https")
		}
		rows = append(rows, []string{strings.Join(ph.DomainNames, ", "), u.Dim("→ " + ph.ForwardHost + ":" + strconv.Itoa(ph.ForwardPort)), tls})
	}
	u.Printf("\n")
	u.Table([]string{"HOST", "TARGET", "TLS"}, rows)
	return nil
}

// cloudflarePermissions is what CLOUDFLARE_API_TOKEN needs.
const cloudflarePermissions = "Zone › Zone › Read, Zone › DNS › Edit, and Account › Cloudflare Tunnel › Edit"

// publishable reports whether an app may be published through the tunnel:
// ntfy only once its publishers use a token, since anonymous write grants
// must never face the internet.
func publishable(id string, public bool, env map[string]string) bool {
	return public && (id != "ntfy" || env["NTFY_PUBLISH_TOKEN"] != "")
}
