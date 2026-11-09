package main

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/domain"
	"github.com/Snooper42/homelab-wizard/internal/npm"
)

// awayKeys are the .env keys homelab phone away writes: Access's team,
// application, and the household's service token (its secret only in .env,
// and given to a phone only when it pairs at home), and the hostname.
var awayKeys = []string{"COMPANION_ACCESS_TEAM", "COMPANION_ACCESS_AUD", "COMPANION_ACCESS_CLIENT_ID", "COMPANION_ACCESS_CLIENT_SECRET", "COMPANION_AWAY_HOST"}

// awayHost is the companion's hostname through the tunnel: its own, beside
// the one at home (which stays on the home network), under the same
// wildcard certificate.
func awayHost(sub, dom string) string { return sub + "-away." + dom }

// phoneAway is homelab phone away [--apply]: the iPhone app away from home
// through the Cloudflare tunnel (ADR-0023). It puts Cloudflare Access in
// front of the companion's own hostname, letting in only the household's
// service token, gives the proxy a host for it, and publishes it through
// the tunnel. Without --apply it says what it would do.
func (h *homelab) phoneAway(ctx context.Context, args []string) error {
	fs := newFlags("phone away")
	apply := fs.Bool("apply", false, "")
	if err := fs.Parse(args); err != nil {
		return err
	}
	u := h.ui
	env := h.envMap()
	if env["HOMELAB_DOMAIN"] == "" {
		return errors.New("away from home goes through your domain's Cloudflare tunnel: set up the domain first (Setup › Addresses and certificate)")
	}
	dom, err := domain.Normalize(env["HOMELAB_DOMAIN"])
	if err != nil {
		return err
	}
	if env["TUNNEL_TOKEN"] == "" {
		return errors.New("away from home goes through the Cloudflare tunnel: set it up first (Setup › Access away from home)")
	}
	tunnel, err := domain.ParseTunnelToken(env["TUNNEL_TOKEN"])
	if err != nil {
		return err
	}
	if env["CLOUDFLARE_API_TOKEN"] == "" {
		return fmt.Errorf("CLOUDFLARE_API_TOKEN is empty: it makes the Access application; it needs %s", domain.AccessPermissions)
	}
	app, ok := h.catalog.Get(domain.CompanionID)
	if !ok {
		return errors.New("the phone companion isn't in this catalog")
	}
	routes := domain.Routes(append(h.catalog.Apps[:0:0], app), dom, compose.MapLookup(env))
	if len(routes) != 1 {
		return errors.New("the phone companion has no web port to send the tunnel to")
	}
	route := routes[0]
	route.Host = awayHost(app.Subdomain(), dom)

	u.Title("The iPhone app away from home: " + route.Host)
	u.Info("Cloudflare Access in front of %s, letting in only the household's phones (a service token)", route.Host)
	u.Info("a proxy host for it, to the phone companion, and %s published through the tunnel", route.Host)
	u.Info("away from home, a phone only looks: Status, its apps, the Finances it may see; pair a phone at home after this")
	if !*apply {
		u.Printf("\n  Run again with --apply to do it.\n")
		return nil
	}

	cf := domain.NewCloudflare(env["CLOUDFLARE_API_TOKEN"])
	cf.BaseURL = cloudflareAPI
	away, err := domain.SetUpAway(ctx, cf, tunnel.AccountID, route.Host, domain.Away{ClientID: env["COMPANION_ACCESS_CLIENT_ID"], Secret: env["COMPANION_ACCESS_CLIENT_SECRET"]})
	// The token's secret is shown once: kept before anything else can fail.
	if away.ClientID != "" && away.Secret != "" && away.ClientID != env["COMPANION_ACCESS_CLIENT_ID"] {
		if serr := h.setEnvs([]string{"COMPANION_ACCESS_CLIENT_ID", "COMPANION_ACCESS_CLIENT_SECRET"}, map[string]string{"COMPANION_ACCESS_CLIENT_ID": away.ClientID, "COMPANION_ACCESS_CLIENT_SECRET": away.Secret}); serr != nil {
			return serr
		}
	}
	if err != nil {
		return domain.AccessRefused(err)
	}
	for _, m := range away.Made {
		u.OK("Cloudflare Access: made %s", m)
	}

	api := npm.New("http://127.0.0.1:" + env["NPM_ADMIN_PORT"])
	nctx, cancel := context.WithTimeout(ctx, time.Minute)
	defer cancel()
	if err := api.Login(nctx, env["NPM_API_EMAIL"], env["NPM_API_PASSWORD"]); err != nil {
		return fmt.Errorf("Nginx Proxy Manager: %w (Set up the domain makes its account)", err)
	}
	settings := domain.Settings{CompanionKey: env["COMPANION_PROXY_KEY"]}
	if cert, found, err := domain.FindWildcard(nctx, api, dom); err != nil {
		return err
	} else if found {
		settings.CertificateID, settings.ForceSSL = cert.ID, true
	}
	results, err := domain.Sync(nctx, api, []domain.Route{route}, settings)
	if err != nil {
		return err
	}
	for _, r := range results {
		u.OK("proxy host %s → the phone companion (%s)", r.Route.Host, r.Action)
	}
	pub, err := domain.Publish(ctx, cf, tunnel, dom, []string{route.Host}, tunnelService)
	if err != nil {
		if strings.Contains(err.Error(), "Authentication error") {
			return fmt.Errorf("publishing through the tunnel: the Cloudflare token was refused; it needs %s: %w", cloudflarePermissions, err)
		}
		return fmt.Errorf("publishing through the tunnel: %w", err)
	}
	u.OK("Cloudflare Tunnel: %s (DNS %s, ingress %s)", route.Host, pub.DNS[route.Host], map[bool]string{true: "updated", false: "unchanged"}[pub.IngressChanged])

	// Last, so the companion answers through the tunnel only once all of it
	// is in place.
	if err := h.setEnvs([]string{"COMPANION_ACCESS_TEAM", "COMPANION_ACCESS_AUD", "COMPANION_AWAY_HOST"}, map[string]string{"COMPANION_ACCESS_TEAM": away.Team, "COMPANION_ACCESS_AUD": away.AUD, "COMPANION_AWAY_HOST": route.Host}); err != nil {
		return err
	}
	u.OK("the phone companion answers the household's phones through the tunnel")
	u.Printf("\n  %s\n", u.Dim("Pair each phone again at home once (Settings › Phones), so it gets its key for away from home."))
	return nil
}

// setEnvs sets several .env keys, in order.
func (h *homelab) setEnvs(keys []string, values map[string]string) error {
	for _, k := range keys {
		if err := h.setEnv(k, values[k]); err != nil {
			return err
		}
	}
	return nil
}
