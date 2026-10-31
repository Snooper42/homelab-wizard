package main

import (
	"bytes"
	"cmp"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/accounts"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/homepage"
	"github.com/Snooper42/homelab-wizard/internal/people"
	"github.com/Snooper42/homelab-wizard/internal/sso"
	"github.com/Snooper42/homelab-wizard/internal/tailnet"
)

// signInFor is how long a new person's first sign-in link works.
const signInFor = 7 * 24 * time.Hour

// personCmd adds people to the household (a Pocket ID account, their
// Jellyfin and Navidrome accounts, a first sign-in link, and a welcome
// page with their apps), lists them, gives them a new password for the
// apps with one of their own, and removes them (sign-in off, data kept).
func (h *homelab) personCmd(ctx context.Context, args []string) error {
	sub := "list"
	if len(args) > 0 {
		sub, args = args[0], args[1:]
	}
	fs := newFlags("person " + sub)
	email := fs.String("email", "", "")
	username := fs.String("username", "", "")
	admin := fs.Bool("admin", false, "")
	appList := fs.String("apps", "", "")
	all := fs.Bool("all", false, "")
	apply := applyFlag(fs)
	pos, err := parseFlags(fs, args)
	if err != nil {
		return err
	}
	u := h.ui
	path := people.Path(h.root)
	list, err := people.Load(path)
	if err != nil {
		return err
	}
	switch sub {
	case "list":
		if len(list) == 0 {
			u.Info("no one added yet: homelab person add \"Anna Smith\" --email anna@example.com")
			return nil
		}
		var rows [][]string
		for _, p := range list {
			state := "added " + p.Added.Local().Format("2 Jan 2006")
			if !p.Active() {
				state = u.Dim("removed " + p.Removed.Local().Format("2 Jan 2006") + " (data kept)")
			}
			rows = append(rows, []string{p.Name, p.Username, p.Email, state})
		}
		u.Table(nil, rows)
		return nil
	case "apps":
		return h.personApps(ctx, list, pos, *all)
	case "add", "remove", "welcome", "password":
	default:
		return fmt.Errorf("usage: homelab person [list] | add \"<name>\" --email <address> [--apps <ids>] | apps <name> [<ids>|--all] | welcome <name> | password <name> | remove <name>")
	}
	if len(pos) != 1 {
		return fmt.Errorf("usage: homelab person %s \"<name>\"", sub)
	}
	env := h.envMap()
	api, issuer, err := h.pocketIDAPI(ctx, env)
	if err != nil {
		return err
	}

	switch sub {
	case "add":
		name := pos[0]
		user := cmp.Or(*username, people.Username(name))
		if user == "" {
			return fmt.Errorf("give a name, such as \"Anna Smith\"")
		}
		if _, ok := people.Find(list, user); ok {
			return fmt.Errorf("%s is in the household already (homelab person welcome %s makes a new sign-in link)", user, user)
		}
		uses, err := h.householdIDs(splitList(*appList))
		if err != nil {
			return err
		}
		u.Title("Add " + name)
		u.Info("a Pocket ID account %q%s, with a sign-in link that works for 7 days", user, map[bool]string{true: " (an administrator)", false: ""}[*admin])
		u.Info("a welcome page with their apps: %s", h.rel(people.WelcomePath(h.root, user)))
		h.planAccounts(env, people.Person{Apps: uses}, "an account %q in %s, with one password for them, on the welcome page", user)
		if err := h.goAhead(*apply, "\nAdd them?"); err != nil {
			return err
		}
		first, last := people.Split(name)
		pu := sso.User{Username: user, FirstName: first, LastName: last, DisplayName: name, IsAdmin: *admin}
		if *email != "" {
			pu.Email = email
		}
		made, err := api.CreateUser(ctx, pu)
		if err != nil {
			return err
		}
		p := people.Person{Username: user, Name: name, Email: *email, PocketID: made.ID, Added: time.Now(), Apps: uses}
		list = append(list, p)
		if err := people.Save(path, list); err != nil {
			return err
		}
		h.afterChange(ctx)
		return h.welcome(ctx, api, issuer, p, h.appAccounts(ctx, env, p, "add", accounts.NewPassword()))
	case "welcome":
		i, ok := people.Find(list, pos[0])
		if !ok || !list[i].Active() {
			return fmt.Errorf("%s is not in the household (homelab person list)", pos[0])
		}
		return h.welcome(ctx, api, issuer, list[i], h.appAccounts(ctx, env, list[i], "welcome", ""))
	case "password":
		i, ok := people.Find(list, pos[0])
		if !ok || !list[i].Active() {
			return fmt.Errorf("%s is not in the household (homelab person list)", pos[0])
		}
		p := list[i]
		u.Title("A new password for " + p.Name)
		if !h.planAccounts(env, p, "a new password for %[1]q in %[2]s (an account made where there is none)", p.Username) {
			return fmt.Errorf("%s uses no app the homelab can set a password in", p.Name)
		}
		u.Info("a fresh welcome page with it, and a new sign-in link")
		u.Info("%s", u.Dim("music apps and Navidrome's web page need the new password straight away; Jellyfin's apps and Infuse keep playing until they sign in again"))
		if err := h.goAhead(*apply, "\nSet it?"); err != nil {
			return err
		}
		accts := h.appAccounts(ctx, env, p, "password", accounts.NewPassword())
		set := 0
		for _, a := range accts {
			if a.Password != "" {
				set++
			}
		}
		if set == 0 {
			return fmt.Errorf("no app took the new password (above)")
		}
		return h.welcome(ctx, api, issuer, p, accts)
	default: // remove
		i, ok := people.Find(list, pos[0])
		if !ok || !list[i].Active() {
			return fmt.Errorf("%s is not in the household (homelab person list)", pos[0])
		}
		p := list[i]
		u.Title("Remove " + p.Name)
		u.Info("turn off their Pocket ID sign-in, so the apps that sign in with it let them in no more")
		u.Info("keep their data in every app: photos, documents, and the rest stay until you delete them there")
		svcs, _ := h.passwordApps(env)
		if len(svcs) > 0 {
			u.Info("turn off their Jellyfin and Navidrome accounts the homelab can reach")
		}
		u.Info("Vaultwarden has a password of its own: turn their account off in its admin page")
		if err := h.goAhead(*apply, "\nRemove them?"); err != nil {
			return err
		}
		if err := api.SetDisabled(ctx, p.PocketID, true); err != nil {
			return err
		}
		h.appAccounts(ctx, env, p, "remove", "")
		list[i].Removed = time.Now()
		if err := people.Save(path, list); err != nil {
			return err
		}
		_ = os.Remove(people.WelcomePath(h.root, p.Username))
		u.OK("%s can no longer sign in with Pocket ID; their data stays", p.Name)
		h.afterChange(ctx)
		return nil
	}
}

// planAccounts says, in a plan, what would happen in each app with a
// password of its own that p uses (what is a format with the username and
// the apps' names), and which settings the others need. It reports
// whether there is any app to do it in.
func (h *homelab) planAccounts(env map[string]string, p people.Person, what, username string) bool {
	svcs, missing := h.passwordApps(env)
	var names []string
	for _, s := range svcs {
		if a, ok := h.catalog.Get(s.App()); ok && p.Uses(a.ID) {
			names = append(names, a.Name())
		}
	}
	if len(names) > 0 {
		h.ui.Info(what, username, strings.Join(names, " and "))
	}
	for _, m := range missing {
		h.ui.Info("%s", h.ui.Dim("with "+m+" in Settings, the homelab would do this in "+map[bool]string{true: "Jellyfin", false: "Navidrome"}[strings.HasPrefix(m, "JELLYFIN")]+" too"))
	}
	return len(names) > 0
}

// welcome makes a person's first sign-in link and writes their page, with
// their logins in the apps with a password of their own.
func (h *homelab) welcome(ctx context.Context, api *sso.PocketID, issuer string, p people.Person, accts []people.Account) error {
	u := h.ui
	link, err := api.SignInLink(ctx, issuer, p.PocketID, signInFor)
	if err != nil {
		return err
	}
	env := h.envMap()
	w := people.Welcome{Person: p, SignIn: link, Until: time.Now().Add(signInFor), Issuer: issuer, Tailnet: env["HOMELAB_DOMAIN"] == "", Accounts: accts}
	if client, err := h.docker(ctx); err == nil {
		if containers, err := client.Containers(ctx); err == nil {
			report := detect.Analyze(h.catalog, containers)
			for _, a := range h.catalog.Apps {
				if !a.HasWeb() || a.Internal() || a.Meta.Admin || a.Meta.Category == "network" || a.Meta.Category == "system" || a.Meta.Category == "security" && a.ID != "vaultwarden" {
					continue
				}
				if st, _ := report.State(a.ID); st != detect.Running && a.Native() == nil {
					continue
				}
				addr := h.appAddress(a, env)
				if w.Tailnet {
					addr = h.tailnetAddress(a, env)
				}
				if addr == "" {
					continue
				}
				w.Apps = append(w.Apps, people.App{Name: a.Name(), Address: addr, What: a.Meta.Description, Phone: a.Phone()})
			}
			w.StartPage = h.startPage(report, env, p, w.Tailnet, len(w.Apps))
		}
	}
	var b bytes.Buffer
	if err := people.Render(&b, w); err != nil {
		return err
	}
	path := people.WelcomePath(h.root, p.Username)
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	if err := os.WriteFile(path, b.Bytes(), 0o600); err != nil {
		return err
	}
	u.OK("%s's welcome page: %s (%d apps)", p.Name, h.rel(path), len(w.Apps))
	var with []string
	for _, a := range accts {
		if a.Password != "" {
			with = append(with, a.App)
		}
	}
	if len(with) > 0 {
		u.Printf("  %s\n", u.Dim("Their "+strings.Join(with, " and ")+" password is on it and nowhere else: the homelab does not keep it."))
	}
	u.Printf("  %s\n", u.Dim("Send it to them, or open it and print it. Their sign-in link works once, for 7 days."))
	return nil
}

// personApps shows or sets the apps a person uses: their welcome page and
// their tab on Homepage list only these.
func (h *homelab) personApps(ctx context.Context, list []people.Person, pos []string, all bool) error {
	if len(pos) == 0 {
		return fmt.Errorf("usage: homelab person apps <name> [<app> ...|--all]")
	}
	i, ok := people.Find(list, pos[0])
	if !ok || !list[i].Active() {
		return fmt.Errorf("%s is not in the household (homelab person list)", pos[0])
	}
	p := &list[i]
	var ids []string
	for _, arg := range pos[1:] {
		ids = append(ids, splitList(arg)...)
	}
	if len(ids) == 0 && !all {
		if len(p.Apps) == 0 {
			h.ui.Info("%s uses every household app (homelab person apps %s immich-server paperless … chooses)", p.Name, p.Username)
			return nil
		}
		var names []string
		for _, id := range p.Apps {
			if a, ok := h.catalog.Get(id); ok {
				names = append(names, a.Name())
			}
		}
		h.ui.Info("%s uses %s", p.Name, strings.Join(names, ", "))
		return nil
	}
	uses, err := h.householdIDs(ids)
	if err != nil {
		return err
	}
	p.Apps = uses
	if err := people.Save(people.Path(h.root), list); err != nil {
		return err
	}
	if len(uses) == 0 {
		h.ui.OK("%s uses every household app", p.Name)
	} else {
		h.ui.OK("%s uses %d app(s)", p.Name, len(uses))
	}
	h.afterChange(ctx)
	h.ui.Printf("  %s\n", h.ui.Dim("Their Homepage tab follows now; homelab person welcome "+p.Username+" makes their welcome page again."))
	return nil
}

// householdIDs checks app ids a person may use.
func (h *homelab) householdIDs(ids []string) ([]string, error) {
	var out []string
	for _, id := range ids {
		a, ok := h.catalog.Get(id)
		if !ok {
			return nil, fmt.Errorf("unknown app %q (homelab apps lists them)", id)
		}
		if !householdApp(a) {
			return nil, fmt.Errorf("%s is part of the homelab's machinery, not an app people use", a.Name())
		}
		if !slices.Contains(out, a.ID) {
			out = append(out, a.ID)
		}
	}
	return out, nil
}

// startPage is the person's own tab on Homepage, when it runs.
func (h *homelab) startPage(report *detect.Report, env map[string]string, p people.Person, tailnet bool, apps int) string {
	hp, ok := h.catalog.Get("homepage")
	if st, _ := report.State("homepage"); !ok || st != detect.Running || apps == 0 {
		return ""
	}
	addr := h.appAddress(hp, env)
	if tailnet {
		addr = h.tailnetAddress(hp, env)
	}
	list, _ := people.Load(people.Path(h.root))
	name := tabNames(list)[p.Username]
	if addr == "" || name == "" {
		return ""
	}
	return addr + "/#" + homepage.Tab{Name: name}.Slug()
}

// householdApp reports an app the household itself uses (not the
// machinery behind it), for welcome pages and people's start pages.
func householdApp(a *catalog.App) bool {
	if !a.HasWeb() || a.Internal() || a.Meta.Admin || a.ID == "homepage" {
		return false
	}
	switch a.Meta.Category {
	case "network", "system":
		return false
	case "security":
		return a.ID == "vaultwarden"
	}
	return true
}

// tailnetAddress is an app's address in Home mode, "" when it has none.
func (h *homelab) tailnetAddress(a *catalog.App, env map[string]string) string {
	host := env["TAILSCALE_HOST"]
	if host == "" {
		return ""
	}
	for _, r := range tailnet.Routes([]*catalog.App{a}, compose.MapLookup(env)) {
		return "https://" + tailnet.Address(host, r.Port)
	}
	return ""
}

// pocketIDAPI is Pocket ID's API on this machine and its address,
// checking that it runs and the key is there.
func (h *homelab) pocketIDAPI(ctx context.Context, env map[string]string) (*sso.PocketID, string, error) {
	client, err := h.docker(ctx)
	if err != nil {
		return nil, "", err
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return nil, "", err
	}
	if _, ok := runningContainer(detect.Analyze(h.catalog, containers), pocketID); !ok {
		return nil, "", fmt.Errorf("Pocket ID is not running: homelab install pocket-id, then make its admin at its /setup page")
	}
	if env["POCKET_ID_API_KEY"] == "" {
		return nil, "", fmt.Errorf("POCKET_ID_API_KEY is empty: homelab up generates it and restarts Pocket ID with it")
	}
	pid, _ := h.catalog.Get(pocketID)
	return sso.NewPocketID("http://127.0.0.1:"+cmp.Or(env["POCKET_ID_PORT"], "1411"), env["POCKET_ID_API_KEY"]), h.appAddress(pid, env), nil
}
