package main

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/applist"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/domain"
	"github.com/Snooper42/homelab-wizard/internal/health"
)

// away turns a public app's Reach it away from home on or off (homelab
// away on|off <app>). Off keeps it home only: it goes on the household's
// list (data/home-only.json), and its hostname comes out of the tunnel
// and its record out of Cloudflare's DNS, only what Set up the domain put
// there. On takes it off the list and publishes it again, as Set up the
// domain would. Either way the list is kept first, so the next Set up the
// domain does the same when Cloudflare can't be reached now.
func (h *homelab) away(ctx context.Context, args []string) error {
	if len(args) != 2 || (args[0] != "on" && args[0] != "off") {
		return fmt.Errorf("usage: homelab away on|off <app>   (off: home only, nothing of it on the internet)")
	}
	a, ok := h.catalog.Get(args[1])
	if !ok {
		return fmt.Errorf("unknown app %q", args[1])
	}
	if !a.Public() {
		return fmt.Errorf("%s is never put on the internet: it is home only already", a.Name())
	}
	on := args[0] == "on"
	if err := applist.HomeOnly.Set(h.root, a.ID, !on); err != nil {
		return err
	}
	u, env := h.ui, h.envMap()
	dom := env["HOMELAB_DOMAIN"]
	host := a.Subdomain() + "." + dom
	tunnel, err := domain.ParseTunnelToken(env["TUNNEL_TOKEN"])
	if dom == "" || err != nil || env["CLOUDFLARE_API_TOKEN"] == "" {
		if on {
			u.OK("%s may be reached away from home: Set up the domain, with the Cloudflare tunnel, puts it there", a.Name())
			return nil
		}
		// The tunnel can't be changed from here, so whether it is off the
		// internet is asked of the internet, not assumed: a hostname Set up
		// the domain published before stays until it runs again (#975).
		if dom != "" {
			if public, err := domain.Reachable(ctx, publicLookup, host); err == nil && len(public) > 0 {
				u.Warn("%s is kept home only, but %s still answers from the internet (%s): CLOUDFLARE_API_TOKEN is empty, so the tunnel can't be changed from here. Set up the domain with the token takes it off, or remove its public hostname from the tunnel in Cloudflare", a.Name(), host, strings.Join(public, ", "))
				return nil
			}
		}
		u.OK("%s is home only: the internet's DNS doesn't reach it, and Set up the domain keeps it off", a.Name())
		return nil
	}
	cf := domain.NewCloudflare(env["CLOUDFLARE_API_TOKEN"])
	cf.BaseURL = cloudflareAPI
	if !on {
		un, err := domain.Unpublish(ctx, cf, tunnel, dom, []string{host}, tunnelService)
		if err != nil {
			return fmt.Errorf("%s is kept home only, but Cloudflare could not be changed (%w): Set up the domain again takes it off the internet", a.Name(), err)
		}
		for _, why := range un.Left {
			u.Warn("%s: left as it is in Cloudflare DNS, as the homelab didn't make it", why)
		}
		if len(un.StillPublic) > 0 {
			for _, why := range un.StillPublic {
				u.Warn("%s: the homelab didn't make them, so it leaves them; change them in Cloudflare to keep it home only", why)
			}
			return nil
		}
		u.OK("%s is home only: %s opens on the home network, and nowhere else", a.Name(), host)
		return nil
	}
	if ok, why := h.mayPublish(ctx, a, env); !ok {
		if why == "" {
			why = a.Name() + " stays off the internet until homelab notify setup has run (it needs the publishers' token)"
		}
		u.Info("%s", why)
		return nil
	}
	if _, err := domain.Publish(ctx, cf, tunnel, dom, []string{host}, tunnelService); err != nil {
		return fmt.Errorf("%s may be reached away from home, but Cloudflare could not be changed (%w): Set up the domain again puts it there", a.Name(), err)
	}
	u.OK("%s opens away from home at https://%s, through Cloudflare, which can see what passes", a.Name(), host)
	return nil
}

// homeOnly reports whether an app is kept home only by the household.
func (h *homelab) homeOnly(a *catalog.App) bool {
	return slices.Contains(applist.HomeOnly.Load(h.root, nil), a.ID)
}

// homeOnlyNames are the names of the apps among list kept home only.
func homeOnlyNames(list []*catalog.App) string {
	var names []string
	for _, a := range list {
		names = append(names, a.Name())
	}
	return strings.Join(names, ", ")
}

// publicLookup sees a name as the internet does (domain.PublicLookup);
// tests stand in for it.
var publicLookup domain.Lookup = domain.PublicLookup

// homeOnlyChecks is one watchdog check per app the household keeps home
// only, failing while its name answers from the internet: a tunnel
// hostname left from before it was kept home only, or one added by hand
// in Cloudflare. Vaultwarden and Paperless-ngx were found so on Nov 28,
// 2026, while every screen said "home only" (#975). It asks a public
// resolver, so it needs no Cloudflare token; an app whose name can't be
// looked up now (no network) has no check this run, rather than a pass.
func (h *homelab) homeOnlyChecks(ctx context.Context, dom string) []health.Result {
	var results []health.Result
	for _, a := range h.catalog.Apps {
		if !a.Public() || !h.homeOnly(a) {
			continue
		}
		host := a.Subdomain() + "." + dom
		public, err := domain.Reachable(ctx, publicLookup, host)
		if err != nil {
			continue
		}
		r := health.Result{Name: "home only (" + a.Name() + ")", URL: "https://" + host, Status: 200}
		if len(public) > 0 {
			r.Err = fmt.Errorf("%s answers from the internet at %s (%s), though %s is kept home only: Set up the domain again (homelab domain setup --apply) takes it off, or remove its public hostname from the tunnel in Cloudflare", host, strings.Join(public, ", "), cloudflareOrNot(public), a.Name())
		}
		results = append(results, r)
	}
	return results
}

// cloudflareOrNot says whose addresses those are, when it is Cloudflare's.
func cloudflareOrNot(addrs []string) string {
	for _, a := range addrs {
		if strings.HasPrefix(a, "104.16.") || strings.HasPrefix(a, "104.21.") || strings.HasPrefix(a, "172.67.") || strings.HasPrefix(a, "2606:4700:") {
			return "Cloudflare's, so through the tunnel"
		}
	}
	return "a public address"
}
