package main

import (
	"cmp"
	"context"
	"fmt"
	"net/url"
	"os"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/sso"
)

const pocketID = "pocket-id"

// ssoCmd connects the installed apps to Pocket ID: homelab sso shows
// which are, homelab sso setup connects the rest.
func (h *homelab) ssoCmd(ctx context.Context, args []string) error {
	setup := len(args) > 0 && args[0] == "setup"
	if len(args) > 0 && !setup {
		return fmt.Errorf("usage: homelab sso [setup]")
	}
	fs := newFlags("sso")
	apply := applyFlag(fs)
	rest := args
	if setup {
		rest = args[1:]
	}
	if _, err := parseFlags(fs, rest); err != nil {
		return err
	}
	u := h.ui
	env := h.envMap()
	dom := env["HOMELAB_DOMAIN"]
	if dom == "" {
		return fmt.Errorf("single sign-on needs a domain: in Home mode the apps' containers cannot reach Pocket ID's tailnet address (Setup › Set up the domain)")
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
	if _, ok := runningContainer(report, pocketID); !ok {
		return fmt.Errorf("Pocket ID is not running: homelab install pocket-id, then make its admin at its /setup page")
	}
	pid, _ := h.catalog.Get(pocketID)
	issuer := h.appAddress(pid, env)
	host := ""
	if pu, err := url.Parse(issuer); err == nil {
		host = pu.Hostname()
	}

	type item struct {
		app       *catalog.App
		spec      sso.App
		connected bool
	}
	var items []item
	for _, spec := range sso.Apps {
		a, ok := h.catalog.Get(spec.ID)
		if !ok {
			continue
		}
		if _, running := runningContainer(report, a.ID); !running {
			continue
		}
		_, err := os.Stat(sso.EnvPath(h.root, a.ID))
		items = append(items, item{a, spec, err == nil})
	}
	u.Title("Sign-in with Pocket ID (" + issuer + ")")
	if len(items) == 0 {
		u.Info("none of the apps that can use it run here: %s", strings.Join(ssoIDs(), ", "))
		return nil
	}
	todo := 0
	for _, it := range items {
		switch {
		case it.connected:
			u.OK("%s", it.app.Name())
		case it.spec.Env == nil:
			u.Info("%s: make its client, then paste it in the app's settings", it.app.Name())
			todo++
		default:
			u.Info("%s: make its client and restart it with the sign-in settings", it.app.Name())
			todo++
		}
	}
	if !setup {
		if todo > 0 {
			u.Printf("\n  %s\n", u.Dim("homelab sso setup connects the rest."))
		}
		return nil
	}
	if todo == 0 {
		return nil
	}
	if err := h.goAhead(*apply, "\nConnect them?"); err != nil {
		return err
	}
	if env["POCKET_ID_API_KEY"] == "" {
		return fmt.Errorf("POCKET_ID_API_KEY is empty: homelab up generates it and restarts Pocket ID with it")
	}
	api := sso.NewPocketID("http://127.0.0.1:"+cmp.Or(env["POCKET_ID_PORT"], "1411"), env["POCKET_ID_API_KEY"])
	if host != "" && env["SSO_HOST"] != host {
		if err := h.setEnv("SSO_HOST", host); err != nil {
			return err
		}
	}
	for _, it := range items {
		if it.connected {
			continue
		}
		a, spec := it.app, it.spec
		address := h.appAddress(a, env)
		has, err := api.HasClient(ctx, a.ID)
		if err != nil {
			return err
		}
		secret := ""
		if !has {
			if secret, err = api.CreateClient(ctx, a.ID, a.Name(), spec.CallbackURLs(address)); err != nil {
				return fmt.Errorf("%s: %w", a.Name(), err)
			}
		}
		if secret == "" {
			if secret, err = api.NewSecret(ctx, a.ID); err != nil {
				return fmt.Errorf("%s: %w", a.Name(), err)
			}
		}
		c := sso.Client{ID: a.ID, Secret: secret, Issuer: issuer, Address: address}
		path := sso.EnvPath(h.root, a.ID)
		if spec.Env == nil {
			if err := sso.WriteEnv(path, map[string]string{"CLIENT_ID": c.ID, "CLIENT_SECRET": c.Secret, "ISSUER": c.Issuer}); err != nil {
				return err
			}
			u.OK("%s: client made", a.Name())
			u.Printf("    %s\n", fmt.Sprintf(spec.Steps, issuer, h.rel(path)))
			continue
		}
		if err := sso.WriteEnv(path, spec.Env(c)); err != nil {
			return err
		}
		if err := client.Compose(ctx, h.project(a.File), a.Profiles, "up", "--detach", "--no-deps", "--force-recreate", a.ID); err != nil {
			return err
		}
		u.OK("%s signs in with Pocket ID", a.Name())
	}
	u.Printf("\n  %s\n", u.Dim("Each person signs in with their passkey; an account with the same email is linked where the app allows it."))
	return nil
}

// appAddress is where people open an app: its URL setting when it has
// one (Home mode, or set by hand), else https://<subdomain>.<domain>.
func (h *homelab) appAddress(a *catalog.App, env map[string]string) string {
	if k := a.Meta.URL; k != "" && env[k] != "" {
		return strings.TrimRight(env[k], "/")
	}
	return "https://" + a.Subdomain() + "." + env["HOMELAB_DOMAIN"]
}

func ssoIDs() []string {
	var out []string
	for _, a := range sso.Apps {
		out = append(out, a.ID)
	}
	return out
}
