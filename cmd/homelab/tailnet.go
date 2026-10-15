package main

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

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
	if len(args) == 0 || args[0] != "setup" {
		return fmt.Errorf("usage: homelab tailnet setup")
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
		return fmt.Errorf("Tailscale is not running: put an auth key in Settings › TAILSCALE_AUTHKEY (Tailscale admin console › Settings › Keys), then homelab install tailscale")
	}
	out, err := client.Exec(ctx, ctr.Name, "tailscale", "status", "--json")
	if err != nil {
		return fmt.Errorf("reading Tailscale's status: %w", err)
	}
	self, err := tailnet.ParseStatus(out)
	if err != nil {
		return err
	}
	if !self.Running || self.Host == "" {
		return fmt.Errorf("Tailscale is %s, not connected: make a new auth key, put it in TAILSCALE_AUTHKEY, and run homelab install tailscale again", self.State)
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
