package main

import (
	"context"

	"github.com/Snooper42/homelab-wizard/internal/domain"
)

// lanAddress is this machine's address on the home network (tests replace
// it).
var lanAddress = domain.LANAddress

// followHome moves the apps' names when the router has given this machine
// another address on the home network: AdGuard's *.domain rewrite and the
// Cloudflare record, whichever domain setup wrote (domain.Home). It
// returns what it moved; what fails is tried again on the next run.
func (h *homelab) followHome(ctx context.Context, env map[string]string) []string {
	dom := env["HOMELAB_DOMAIN"]
	path := domain.HomePath(h.root)
	home := domain.LoadHome(path)
	if dom == "" || home.Address == "" {
		return nil
	}
	ip, err := lanAddress()
	if err != nil || !home.Follows(ip) {
		return nil
	}
	var moved []string
	done := true
	if home.AdGuard && env["ADGUARD_PASSWORD"] != "" {
		ag := domain.NewAdGuard("http://127.0.0.1:"+env["ADGUARD_PORT"], env["ADGUARD_USER"], env["ADGUARD_PASSWORD"])
		if _, err := ag.UpsertRewrite(ctx, "*."+dom, ip); err != nil {
			h.ui.Warn("AdGuard Home still sends *.%s to %s: %v", dom, home.Address, err)
			done = false
		} else {
			moved = append(moved, "AdGuard Home: *."+dom+" → "+ip)
		}
	}
	if home.Cloudflare && env["CLOUDFLARE_API_TOKEN"] != "" {
		cf := domain.NewCloudflare(env["CLOUDFLARE_API_TOKEN"])
		cf.BaseURL = cloudflareAPI
		if _, err := domain.HomeRecord(ctx, cf, dom, ip); err != nil {
			h.ui.Warn("Cloudflare still sends *.%s to %s: %v", dom, home.Address, err)
			done = false
		} else {
			moved = append(moved, "Cloudflare DNS: *."+dom+" → "+ip)
		}
	}
	if done {
		home.Address = ip
		if err := home.Save(path); err != nil {
			h.ui.Warn("could not keep the new home address: %v", err)
		}
	}
	return moved
}
