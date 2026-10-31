package main

import (
	"cmp"
	"context"
	"errors"
	"net"
	"net/url"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/accounts"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/people"
)

// jellyfinAPI is native Jellyfin on this machine (tests replace it).
var jellyfinAPI = "http://127.0.0.1:8096"

// passwordApps are the apps with a password of their own whose accounts
// the homelab can manage, from what Settings holds: Jellyfin with
// JELLYFIN_API_KEY, Navidrome with NAVIDROME_ADMIN_USER and _PASSWORD.
// missing names the settings for the others.
func (h *homelab) passwordApps(env map[string]string) (svcs []accounts.Service, missing []string) {
	if key := env["JELLYFIN_API_KEY"]; key != "" {
		svcs = append(svcs, accounts.NewJellyfin(jellyfinAPI, key))
	} else {
		missing = append(missing, "JELLYFIN_API_KEY")
	}
	if env["NAVIDROME_ADMIN_USER"] != "" && env["NAVIDROME_ADMIN_PASSWORD"] != "" {
		svcs = append(svcs, accounts.NewNavidrome("http://127.0.0.1:"+cmp.Or(env["NAVIDROME_PORT"], "4533"), env["NAVIDROME_ADMIN_USER"], env["NAVIDROME_ADMIN_PASSWORD"]))
	} else {
		missing = append(missing, "NAVIDROME_ADMIN_USER and NAVIDROME_ADMIN_PASSWORD")
	}
	return svcs, missing
}

// appAccounts does action in each app with a password of its own that p
// uses: "add" makes their account (one already there is left as it is),
// "password" sets pw (making the account where there is none), "welcome"
// only looks, and "remove" turns the accounts off. It returns the
// accounts for their welcome page, with pw where it was set now. An app
// that fails is said and left out; the rest go on.
func (h *homelab) appAccounts(ctx context.Context, env map[string]string, p people.Person, action, pw string) []people.Account {
	u := h.ui
	svcs, _ := h.passwordApps(env)
	var out []people.Account
	for _, s := range svcs {
		a, ok := h.catalog.Get(s.App())
		if !ok || !p.Uses(a.ID) {
			continue
		}
		pass := pw // this app's: "" where its account keeps its own
		id, found, err := s.Find(ctx, p.Username)
		if err == nil {
			switch {
			case action == "remove" && found:
				if err = s.Disable(ctx, id); err == nil {
					u.OK("%s: %s can no longer sign in; their history stays", a.Name(), p.Username)
				}
				continue
			case action == "remove":
				continue
			case action == "add" && found:
				u.Info("%s already has an account %q: left as it is, with its own password", a.Name(), p.Username)
				pass = ""
			case action == "welcome" && !found:
				continue
			case action == "welcome":
				pass = ""
			case found: // password
				if err = s.SetPassword(ctx, id, pass); err == nil {
					u.OK("%s: %s has the new password", a.Name(), p.Username)
				}
			default: // add, or password with no account yet
				if err = s.Create(ctx, p.Username, pass); err == nil {
					u.OK("%s: made the account %q", a.Name(), p.Username)
				}
			}
		}
		if err != nil {
			if errors.Is(err, accounts.ErrNoAccess) {
				err = errors.New(map[string]string{"jellyfin": "the key in JELLYFIN_API_KEY was refused: make a new one in Jellyfin › Dashboard › API Keys", "navidrome": "Navidrome refused NAVIDROME_ADMIN_USER and NAVIDROME_ADMIN_PASSWORD"}[a.ID])
			}
			u.Warn("%s: %v", a.Name(), err)
			continue
		}
		out = append(out, h.account(a, env, p.Username, pass))
	}
	return out
}

// account is a login as a welcome page shows it, with what to type in the
// apps that ask for each part of the address.
func (h *homelab) account(a *catalog.App, env map[string]string, username, pw string) people.Account {
	addr := h.appAddress(a, env)
	if env["HOMELAB_DOMAIN"] == "" {
		addr = h.tailnetAddress(a, env)
	}
	acct := people.Account{App: a.Name(), Address: addr, Username: username, Password: pw}
	switch a.ID {
	case "jellyfin":
		acct.For = "Films and TV, in the Jellyfin app, Swiftfin, or Infuse on a phone, iPad, or Apple TV"
		if host, port, https := addressParts(addr); host != "" {
			acct.Steps = "In Infuse: Add Files › Add Share › Jellyfin, address " + host + ", port " + port + ", HTTPS " + map[bool]string{true: "on", false: "off"}[https] + "."
		}
	case "navidrome":
		acct.For = "Music, in any Subsonic app: Arpeggi, Amperfy, play:Sub, or Symfonium"
		acct.Steps = "In the music app, add a Navidrome (or Subsonic) server with this address."
		if f, ok := h.catalog.Get("feishin"); ok {
			if faddr := h.appAddress(f, env); faddr != "" && env["HOMELAB_DOMAIN"] != "" {
				acct.Steps += " Feishin, the music player in a browser at " + faddr + ", signs in with the same login."
			}
		}
	}
	return acct
}

// addressParts splits an app's address into what Infuse asks for.
func addressParts(addr string) (host, port string, https bool) {
	u, err := url.Parse(addr)
	if err != nil || u.Host == "" {
		return "", "", false
	}
	https = u.Scheme == "https"
	host, port, err = net.SplitHostPort(u.Host)
	if err != nil {
		host, port = u.Host, map[bool]string{true: "443", false: "80"}[https]
	}
	return strings.TrimSuffix(host, "."), port, https
}
