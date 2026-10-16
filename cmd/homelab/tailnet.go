package main

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/tailnet"
)

// tailnetCmd is Home mode: every app at https://homelab.<tailnet>.ts.net:<port>
// without a domain. `homelab tailnet setup` writes Tailscale's serve
// config for the running apps; installs run it by themselves.
func (h *homelab) tailnetCmd(ctx context.Context, args []string) error {
	if len(args) > 0 && args[0] == "login" {
		return h.tailnetLogin(ctx)
	}
	if len(args) == 0 || args[0] != "setup" {
		return fmt.Errorf("usage: homelab tailnet setup | homelab tailnet login")
	}
	fs := newFlags("tailnet setup")
	auto := fs.Bool("auto", false, "")
	if _, err := parseFlags(fs, args[1:]); err != nil {
		return err
	}
	return h.tailnetSetup(ctx, *auto)
}

// tailnetSetup gives the running apps their tailnet addresses. With auto
// (after an install) it says nothing when Tailscale is not set up yet.
func (h *homelab) tailnetSetup(ctx context.Context, auto bool) error {
	u := h.ui
	client, err := h.docker(ctx)
	if err != nil {
		return err
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return err
	}
	report := detect.Analyze(h.catalog, containers)
	ctr, ok := runningContainer(report, tailnet.App)
	if !ok {
		if auto {
			return nil
		}
		return fmt.Errorf("Tailscale is not running: homelab install tailscale (or Choose stacks › Tailscale)")
	}
	self, err := tailscaleSelf(ctx, client, ctr.Name)
	if err != nil {
		return err
	}
	if !self.Running && self.State == "NeedsLogin" && !auto {
		if self, err = h.signInTailscale(ctx, client, ctr.Name, self); err != nil {
			return err
		}
	}
	if !self.Running || self.Host == "" {
		if auto {
			return nil
		}
		return fmt.Errorf("Tailscale is %s, not connected: homelab tailnet login signs it in", self.State)
	}

	var running []*catalog.App
	for _, a := range h.catalog.Apps {
		if n := a.Native(); n != nil {
			if api.NativeUp(ctx, n.Port) {
				running = append(running, a)
			}
		} else if st, _ := report.State(a.ID); st == detect.Running && a.ID != tailnet.App {
			running = append(running, a)
		}
	}
	env := h.envMap()
	routes := tailnet.Routes(running, compose.MapLookup(env))
	cfg := tailnet.ServeConfig(routes)
	path := filepath.Join(h.root, tailnet.ConfigFile)
	old, _ := os.ReadFile(path)
	if !bytes.Equal(old, cfg) {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return err
		}
		if err := os.WriteFile(path, cfg, 0o644); err != nil {
			return err
		}
	}
	// The apps that need their own address (sign-in, links) get the
	// tailnet one in their URL setting; the ones running are recreated.
	want := map[string]string{"TAILSCALE_HOST": self.Host}
	for _, r := range routes {
		if v := r.App.Meta.URL; v != "" {
			want[v] = "https://" + tailnet.Address(self.Host, r.Port)
		}
	}
	changed := map[*compose.File]bool{}
	f, err := envfile.Load(h.envFile)
	if err != nil {
		return err
	}
	dirty := false
	for k, v := range want {
		if cur, _ := f.Get(k); cur != v {
			f.Set(k, v)
			dirty = true
			for _, r := range routes {
				if r.App.Meta.URL == k {
					changed[r.App.File] = true
				}
			}
		}
	}
	if dirty {
		if err := f.Save(); err != nil {
			return err
		}
	}
	if err := h.recreate(ctx, client, report, changed, "with its tailnet address"); err != nil {
		return err
	}
	if !self.HTTPS {
		u.Warn("the tailnet gives out no certificates yet, so the addresses do not open: Tailscale admin console › DNS › turn on MagicDNS and HTTPS Certificates")
	}
	if auto && bytes.Equal(old, cfg) {
		return nil
	}
	u.Title("On your tailnet")
	var rows [][]string
	for _, r := range routes {
		rows = append(rows, []string{u.Cyan("https://" + tailnet.Address(self.Host, r.Port)), r.App.Name()})
	}
	u.Table(nil, rows)
	u.Printf("\n  %s\n", u.Dim("Open these on any device signed in to your Tailscale account, at home or away."))
	return nil
}

// recreate brings up the running apps of each changed Compose file again,
// so they pick up new settings (compose recreates only what changed).
func (h *homelab) recreate(ctx context.Context, client *docker.Client, report *detect.Report, changed map[*compose.File]bool, why string) error {
	for file := range changed {
		var ids, profiles []string
		for _, a := range h.catalog.Apps {
			if st, _ := report.State(a.ID); a.File == file && a.Native() == nil && st == detect.Running {
				ids = append(ids, a.ID)
				profiles = append(profiles, a.Profiles...)
			}
		}
		if len(ids) == 0 {
			continue
		}
		h.ui.Info("restarting %s %s", strings.Join(ids, ", "), why)
		if err := client.Compose(ctx, h.project(file), profiles, append([]string{"up", "--detach", "--no-deps"}, ids...)...); err != nil {
			return err
		}
	}
	return nil
}

// clearTailnetURLs empties the URL settings tailnet setup wrote, once the
// homelab has a domain, so the apps go back to https://<name>.<domain>.
// It returns the Compose files whose apps need recreating.
func (h *homelab) clearTailnetURLs(env *envfile.File) map[*compose.File]bool {
	changed := map[*compose.File]bool{}
	host, _ := env.Get("TAILSCALE_HOST")
	if host == "" {
		return changed
	}
	for _, a := range h.catalog.Apps {
		if v := a.Meta.URL; v != "" {
			if cur, _ := env.Get(v); strings.HasPrefix(cur, "https://"+host+":") {
				env.Set(v, "")
				changed[a.File] = true
			}
		}
	}
	return changed
}

// tailscaleSelf reads Tailscale's status in its container.
func tailscaleSelf(ctx context.Context, client *docker.Client, ctr string) (tailnet.Self, error) {
	out, err := client.Exec(ctx, ctr, "tailscale", "status", "--json")
	if err != nil {
		return tailnet.Self{}, fmt.Errorf("reading Tailscale's status: %w", err)
	}
	return tailnet.ParseStatus(out)
}

// tailnetLogin signs Tailscale in when it waits for a login.
func (h *homelab) tailnetLogin(ctx context.Context) error {
	client, err := h.docker(ctx)
	if err != nil {
		return err
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return err
	}
	ctr, ok := runningContainer(detect.Analyze(h.catalog, containers), tailnet.App)
	if !ok {
		return fmt.Errorf("Tailscale is not running: homelab install tailscale")
	}
	self, err := tailscaleSelf(ctx, client, ctr.Name)
	if err != nil {
		return err
	}
	if self.Running {
		h.ui.OK("Tailscale is signed in as %s", self.Host)
		return nil
	}
	_, err = h.signInTailscale(ctx, client, ctr.Name, self)
	return err
}

// loginWait is how long signing in to Tailscale may take.
var loginWait = 5 * time.Minute

// signInTailscale opens Tailscale's sign-in page (no auth key needed) and
// waits until the login went through.
func (h *homelab) signInTailscale(ctx context.Context, client *docker.Client, ctr string, self tailnet.Self) (tailnet.Self, error) {
	link := self.AuthURL
	if link == "" {
		logs, _ := client.Runner.Output(ctx, client.Bin, "logs", "--tail", "200", ctr)
		if all := tailnet.LoginLink.FindAll(logs, -1); len(all) > 0 {
			link = string(all[len(all)-1])
		}
	}
	if link == "" {
		return self, fmt.Errorf("Tailscale waits for a login but shows no sign-in link yet; try again in a minute (homelab logs tailscale), or put an auth key in TAILSCALE_AUTHKEY")
	}
	u := h.ui
	u.Info("sign in to Tailscale: %s", link)
	openLink(link)
	u.Info("%s", u.Dim("waiting for the sign-in (up to 5 minutes)…"))
	deadline := time.Now().Add(loginWait)
	for {
		if s, err := tailscaleSelf(ctx, client, ctr); err == nil && s.Running {
			u.OK("Tailscale is signed in as %s", s.Host)
			return s, nil
		}
		if time.Now().After(deadline) {
			return self, fmt.Errorf("Tailscale is still waiting for the sign-in; open %s, then run this again", link)
		}
		select {
		case <-ctx.Done():
			return self, ctx.Err()
		case <-time.After(loginPoll):
		}
	}
}

// loginPoll is how often signInTailscale checks.
var loginPoll = 3 * time.Second

// openLink opens a web page in the default browser, best effort.
func openLink(url string) {
	var c *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		c = exec.Command("open", url)
	case "windows":
		c = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		c = exec.Command("xdg-open", url)
	}
	if os.Getenv("HOMELAB_NO_BROWSER") == "" {
		_ = c.Start()
	}
}
