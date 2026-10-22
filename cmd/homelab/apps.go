package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/install"
	"github.com/Snooper42/homelab-wizard/internal/ports"
	"github.com/Snooper42/homelab-wizard/internal/selector"
	"github.com/Snooper42/homelab-wizard/internal/tailnet"
	"github.com/Snooper42/homelab-wizard/internal/ui"
	"github.com/Snooper42/homelab-wizard/internal/updates"
)

// installOptions are the flags shared by up, install, and plan.
type installOptions struct {
	apply, dryRun, includeExisting bool
	exclude                        string
	waitMedia                      time.Duration
	set                            map[string]string // --set and --set-stdin
}

var envKey = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

// addSetting records one KEY=value. Errors never repeat the value.
func (o *installOptions) addSetting(kv string) error {
	k, v, ok := strings.Cut(strings.TrimSpace(kv), "=")
	if !ok || !envKey.MatchString(k) {
		return fmt.Errorf("settings are KEY=value")
	}
	if o.set == nil {
		o.set = map[string]string{}
	}
	o.set[k] = v
	return nil
}

func (h *homelab) installFlags(name string, args []string) (installOptions, []string, error) {
	fs := newFlags(name)
	var o installOptions
	apply := applyFlag(fs)
	fs.BoolVar(&o.dryRun, "dry-run", false, "")
	fs.BoolVar(&o.includeExisting, "include-existing", false, "")
	fs.StringVar(&o.exclude, "exclude", "", "")
	fs.DurationVar(&o.waitMedia, "wait-media", 0, "")
	fs.Func("set", "", o.addSetting)
	setStdin := fs.Bool("set-stdin", false, "")
	tokens, err := parseFlags(fs, args)
	o.apply = *apply
	if err == nil && *setStdin {
		err = h.readSettings(&o)
	}
	return o, tokens, err
}

// readSettings reads KEY=value lines from stdin; blank lines and # comments
// are skipped.
func (h *homelab) readSettings(o *installOptions) error {
	sc := bufio.NewScanner(h.ui.In)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if err := o.addSetting(line); err != nil {
			return err
		}
	}
	return sc.Err()
}

// up starts the baseline: every container app without a profile.
// newProber checks whether host ports are free when planning an install.
// Tests replace it so plans do not depend on the machine running them.
var newProber = func() ports.Prober { return ports.NewHostProber() }

func (h *homelab) up(ctx context.Context, args []string) error {
	o, tokens, err := h.installFlags("up", args)
	if err != nil {
		return err
	}
	if len(tokens) > 0 {
		return fmt.Errorf("up starts the baseline; to add apps use: homelab install %s", strings.Join(tokens, " "))
	}
	err = h.runInstall(ctx, h.baselineIDs(), o, "Start the homelab")
	if o.waitMedia > 0 {
		// After a restart: the apps Docker could not start before their
		// drive was mounted.
		if started := h.startFailed(ctx, false); len(started) > 0 {
			h.ui.OK("started what could not start before its drive was there: %s", strings.Join(started, ", "))
		}
		if opened := h.openMacApps(ctx); len(opened) > 0 {
			h.ui.OK("opened %s", strings.Join(opened, ", "))
		}
	}
	return err
}

func (h *homelab) baselineIDs() []string {
	var ids []string
	for _, a := range h.catalog.Baseline() {
		ids = append(ids, a.ID)
	}
	return ids
}

func (h *homelab) install(ctx context.Context, args []string) error {
	o, tokens, err := h.installFlags("install", args)
	if err != nil {
		return err
	}
	if len(tokens) == 0 {
		if !h.ui.Interactive {
			return fmt.Errorf("name the apps to install (see: homelab apps)")
		}
		client, err := h.docker(ctx)
		if err != nil {
			return err
		}
		containers, err := client.Containers(ctx)
		if err != nil {
			return err
		}
		if tokens, err = h.pick(detect.Analyze(h.catalog, containers)); err != nil {
			return err
		}
	}
	return h.runInstall(ctx, tokens, o, "Install plan")
}

// plan previews install (with apps) or up (without).
func (h *homelab) plan(ctx context.Context, args []string) error {
	o, tokens, err := h.installFlags("plan", args)
	if err != nil {
		return err
	}
	o.dryRun = true
	if len(tokens) == 0 {
		return h.runInstall(ctx, h.baselineIDs(), o, "Start the homelab")
	}
	return h.runInstall(ctx, tokens, o, "Install plan")
}

func (h *homelab) runInstall(ctx context.Context, tokens []string, o installOptions, title string) error {
	if o.waitMedia > 0 {
		h.waitForRuntime(ctx, 3*time.Minute)
		h.waitForDrives(ctx, o.waitMedia)
	}
	client, err := h.docker(ctx)
	if err != nil {
		return err
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return err
	}
	sel, err := selector.Resolve(h.catalog, tokens, splitList(o.exclude))
	if err != nil {
		return err
	}
	home, _ := os.UserHomeDir()
	plan, err := install.Build(install.Inputs{
		Catalog:    h.catalog,
		EnvFile:    h.envFile,
		EnvExample: filepath.Join(h.root, ".env.example"),
		Containers: containers,
		Prober:     newProber(),
		Identity:   envfile.HostIdentity(),
		Home:       home,
		Options:    install.Options{IncludeExisting: o.includeExisting},
		Set:        o.set,
	}, sel)
	if err != nil {
		return err
	}
	j := h.ui.JSON
	if j {
		emit(h.ui, "plan", api.PlanOf(plan))
	} else {
		h.showPlan(title, plan)
	}
	if !plan.Ready() {
		if j {
			return fmt.Errorf("the plan has problems")
		}
		return fmt.Errorf("fix the problems above and try again")
	}
	if o.dryRun {
		if !j {
			h.ui.Printf("\n%s\n", h.ui.Dim("Dry run: nothing was changed."))
		}
		return nil
	}
	if len(plan.Start) == 0 {
		if len(plan.EnvChanges) > 0 || len(plan.Ports.Changes) > 0 {
			if err := plan.Env.Save(); err != nil {
				return err
			}
		}
		if j {
			emit(h.ui, "done", map[string]any{"started": []api.Started{}})
		} else {
			h.ui.Printf("\nNothing to start.\n")
		}
		return nil
	}
	if err := h.goAhead(o.apply, fmt.Sprintf("\nStart %d app(s)?", len(plan.Start))); err != nil {
		return err
	}
	var progress func(install.Event)
	if j {
		progress = func(ev install.Event) { emit(h.ui, "progress", ev) }
	} else {
		h.ui.Println()
	}
	if err := install.ApplyWithProgress(ctx, plan, client, h.catalog, h.envFile, progress); err != nil {
		return err
	}
	h.afterChange(ctx)
	started := api.StartedOf(plan)
	if j {
		emit(h.ui, "done", map[string]any{"started": started})
		return nil
	}
	h.ui.Title("Started")
	var rows [][]string
	for _, s := range started {
		if s.URL != "" {
			rows = append(rows, []string{s.Name, h.ui.Cyan(s.URL)})
		}
	}
	h.ui.Table(nil, rows)
	h.autoDomain(ctx, plan) // https addresses: on the domain, or on the tailnet in Home mode
	return nil
}

// autoDomain gives the apps just started their hostnames in Nginx Proxy
// Manager (and the tunnel, for public ones), as Set up the domain would.
func (h *homelab) autoDomain(ctx context.Context, plan *install.Plan) {
	var ids []string
	for _, a := range plan.Start {
		ids = append(ids, a.ID)
	}
	if len(ids) == 0 {
		return
	}
	h.ui.Println()
	if err := h.domainSetup(ctx, []string{"--auto", "--apps", strings.Join(ids, ",")}); err != nil {
		h.ui.Warn("could not give the new apps their addresses: %v (Setup › Set up the domain tries again)", err)
	}
	for _, id := range ids {
		if id == adguardID || id == tailnet.DNSApp {
			if err := h.adguardSetup(ctx, true); err != nil {
				h.ui.Warn("could not set up AdGuard Home: %v (homelab adguard setup tries again)", err)
			}
			break
		}
	}
}

// waitForRuntime gives the container runtime time to start after login:
// the startup job often runs before OrbStack is up. On a Mac it is asked to
// start once.
func (h *homelab) waitForRuntime(ctx context.Context, limit time.Duration) {
	deadline := time.Now().Add(limit)
	for asked := false; ; {
		if _, err := h.docker(ctx); err == nil || time.Now().After(deadline) {
			return
		}
		if !asked && h.host.OS == "darwin" {
			_ = exec.CommandContext(ctx, "open", "-g", "-a", h.host.Runtime).Run()
			asked = true
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(5 * time.Second):
		}
	}
}

func (h *homelab) showPlan(title string, p *install.Plan) {
	u := h.ui
	u.Title(title)
	for _, n := range p.Selection.Notes {
		u.Info("%s", n)
	}
	env := p.Env.Map()
	if len(p.Start) > 0 {
		u.Printf("\n  %s\n", u.Bold(fmt.Sprintf("Start (%d)", len(p.Start))))
		var rows [][]string
		for _, a := range p.Start {
			why := a.Meta.Description
			if parent, ok := p.Selection.RequiredBy[a.ID]; ok {
				why = "needed by " + parent
			}
			rows = append(rows, []string{u.Green("+"), a.ID, u.Dim(a.Project()), u.Dim(why), u.Cyan(ports.WebURL(a, p.Ports.Bindings, compose.MapLookup(env)))})
		}
		u.Table(nil, rows)
	}
	if len(p.Skips) > 0 {
		u.Printf("\n  %s\n", u.Bold(fmt.Sprintf("Skip (%d)", len(p.Skips))))
		var rows [][]string
		for _, s := range p.Skips {
			rows = append(rows, []string{u.Dim("="), s.App.ID, u.Dim(s.Reason)})
		}
		u.Table(nil, rows)
	}
	if len(p.Ports.Changes) > 0 {
		u.Printf("\n  %s\n", u.Bold("Port changes"))
		for _, c := range p.Ports.Changes {
			u.Info("%s %d → %d (%s)", c.Var, c.From, c.To, c.Reason)
		}
	}
	var created bool
	secrets := 0
	var other []envfile.Change
	for _, c := range p.EnvChanges {
		switch {
		case c.Key == ".env":
			created = true
		case c.Secret:
			secrets++
		default:
			other = append(other, c)
		}
	}
	if created || secrets > 0 || len(other) > 0 || len(p.Dirs) > 0 || len(p.Networks) > 0 || len(p.Seeds) > 0 {
		u.Printf("\n  %s\n", u.Bold("Setup"))
		if created {
			u.Info("create .env from .env.example")
		}
		if secrets > 0 {
			u.Info("generate %d secret(s) in .env (copy them into Vaultwarden)", secrets)
		}
		added := 0
		for _, c := range other {
			if c.Reason == "added from .env.example" {
				added++
				continue
			}
			u.Info("%s: %s %s", c.Key, c.Reason, u.Dim(c.Value))
		}
		if added > 0 {
			u.Info("add %d new setting(s) from .env.example", added)
		}
		if len(p.Dirs) > 0 {
			u.Info("create %d data folder(s)", len(p.Dirs))
		}
		for _, sd := range p.Seeds {
			u.Info("give %s its starter files: %s", sd.App, strings.Join(sd.Files, ", "))
		}
		for _, n := range p.Networks {
			u.Info("make sure the %s network exists", n)
		}
	}
	if len(p.Warnings) > 0 {
		u.Printf("\n  %s\n", u.Bold("Warnings"))
		for _, w := range p.Warnings {
			u.Warn("%s", w)
		}
	}
	if len(p.Problems) > 0 {
		u.Printf("\n  %s\n", u.Bold("Problems"))
		for _, pr := range p.Problems {
			u.Fail("%s", pr)
		}
	}
}

// pick shows the grouped catalog and reads a selection.
func (h *homelab) pick(report *detect.Report) ([]string, error) {
	u := h.ui
	u.Title("Pick apps to install")
	u.Printf("%s\n", u.Dim("Apps already running are marked; they will be skipped."))
	items := u.ShowPicker(h.catalog.Grouped(false), func(a *catalog.App) string {
		if a.Native() != nil {
			return "native app"
		}
		if st, _ := report.State(a.ID); st != detect.NotInstalled {
			return st.String()
		}
		if !a.Optional() {
			return "baseline"
		}
		return ""
	})
	var bundles []string
	for _, b := range h.catalog.Bundles {
		bundles = append(bundles, "@"+b.ID)
	}
	u.Printf("\n  %s %s\n", u.Dim("Bundles:"), strings.Join(bundles, " "))
	for {
		in, err := u.Ask("\nApps (e.g. 1 4 7-9, sonarr, *-arr; blank to cancel):")
		if err != nil || in == "" {
			return nil, errCancelled
		}
		tokens, err := ui.ParsePick(in, items)
		if err != nil {
			u.Fail("%v", err)
			continue
		}
		if _, err := selector.Resolve(h.catalog, tokens, nil); err != nil {
			u.Fail("%v", err)
			continue
		}
		return tokens, nil
	}
}

func (h *homelab) status(ctx context.Context, args []string) error {
	fs := newFlags("status")
	all := fs.Bool("all", false, "")
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	st, err := h.statusOf(ctx, *all)
	if err != nil {
		return err
	}
	u := h.ui
	if u.JSON {
		emit(u, "status", st)
		return nil
	}
	u.Title("Homelab status")
	var rows [][]string
	for _, a := range st.Apps {
		state, health := a.State, a.Health
		switch state {
		case "running":
			state = u.Green(state)
		case "stopped", "missing":
			state = u.Yellow(state)
		case "elsewhere":
			state = u.Cyan(state)
			health = u.Dim("container " + a.Container)
		default:
			state = u.Dim(state)
		}
		switch health {
		case "healthy":
			health = u.Green(health)
		case "unhealthy":
			health = u.Red(health)
		case "starting":
			health = u.Yellow(health)
		case "native":
			health = u.Dim(health)
		}
		rows = append(rows, []string{a.ID, state, health, u.Cyan(a.URL), u.Dim(a.Address)})
	}
	u.Table([]string{"APP", "STATE", "HEALTH", strings.ToUpper("On " + h.host.Machine), "ADDRESS"}, rows)
	if st.Missing > 0 {
		u.Printf("\n  %s\n", u.Yellow(fmt.Sprintf("%d baseline app(s) are not running: homelab up shows why.", st.Missing)))
	}
	if st.Unmatched > 0 {
		u.Printf("\n  %s\n", u.Dim(fmt.Sprintf("%d other running container(s) are not catalog apps (homelab detect).", st.Unmatched)))
	}
	return nil
}

// statusOf is the state of every app; helpers only with all.
func (h *homelab) statusOf(ctx context.Context, all bool) (api.Status, error) {
	client, err := h.docker(ctx)
	if err != nil {
		return api.Status{}, err
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return api.Status{}, err
	}
	return api.StatusOf(ctx, h.catalog, containers, h.envMap(), all), nil
}

func (h *homelab) apps(_ context.Context, args []string) error {
	fs := newFlags("apps")
	category := fs.String("category", "", "")
	all := fs.Bool("all", false, "")
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	u := h.ui
	if u.JSON {
		emit(u, "catalog", api.CatalogOf(h.catalog))
		return nil
	}
	shown := 0
	for _, g := range h.catalog.Grouped(*all) {
		if *category != "" && g.ID != *category {
			continue
		}
		u.Printf("\n  %s %s\n", u.Bold(g.Label), u.Dim("cat:"+g.ID))
		var rows [][]string
		for _, a := range g.Apps {
			names := a.ID
			if len(a.Meta.Aliases) > 0 {
				names += u.Dim(" (" + strings.Join(a.Meta.Aliases, ", ") + ")")
			}
			kind := u.Green("baseline")
			switch {
			case a.Native() != nil:
				kind = u.Cyan("native")
			case a.Internal():
				kind = u.Dim("helper")
			case a.Optional():
				kind = u.Dim("optional")
			}
			rows = append(rows, []string{names, kind, u.Dim(a.Meta.Description)})
			shown++
		}
		u.Table(nil, rows)
	}
	if shown == 0 {
		return fmt.Errorf("no apps in category %q", *category)
	}
	u.Printf("\n  %s\n", u.Dim(fmt.Sprintf("%d apps. Baseline apps start with homelab up; add optional ones with homelab install <app>.", shown)))
	return nil
}

func (h *homelab) bundles(context.Context, []string) error {
	u := h.ui
	u.Title("Bundles")
	var rows [][]string
	for _, b := range h.catalog.Bundles {
		names := "@" + b.ID
		if len(b.Aliases) > 0 {
			names += u.Dim(" (" + strings.Join(b.Aliases, ", ") + ")")
		}
		rows = append(rows, []string{names, b.Description, u.Dim(strings.Join(b.Apps, " "))})
	}
	u.Table(nil, rows)
	u.Printf("\n  %s\n", u.Dim("Install with: homelab install @arr   (mix with apps: homelab install @arr seerr)"))
	return nil
}

func (h *homelab) detect(ctx context.Context, _ []string) error {
	client, err := h.docker(ctx)
	if err != nil {
		return err
	}
	info, _ := client.Info(ctx)
	containers, err := client.Containers(ctx)
	if err != nil {
		return err
	}
	report := detect.Analyze(h.catalog, containers)
	u := h.ui
	u.Title(fmt.Sprintf("Containers on %s (%d)", info.Runtime(), len(containers)))
	var rows [][]string
	for _, m := range report.Summary() {
		state := u.Green("running")
		if !m.Container.Running {
			state = u.Yellow(m.Container.State)
		}
		owner := u.Dim("outside the homelab: install skips it")
		if m.How == detect.ByLabel {
			owner = u.Dim("managed (" + m.Container.Project() + ")")
		}
		rows = append(rows, []string{m.Container.Name, m.App.ID, state, m.How, owner})
	}
	if len(rows) > 0 {
		u.Table([]string{"CONTAINER", "APP", "STATE", "MATCHED BY", ""}, rows)
	} else {
		u.Printf("  No catalog apps are running yet.\n")
	}
	if len(report.Unmatched) > 0 {
		u.Printf("\n  %s\n", u.Bold("Other running containers"))
		var other [][]string
		for _, c := range report.Unmatched {
			var ps []string
			for _, p := range c.Ports {
				ps = append(ps, fmt.Sprintf("%d/%s", p.HostPort, p.Protocol))
			}
			other = append(other, []string{c.Name, u.Dim(c.Image), strings.Join(ps, " ")})
		}
		u.Table(nil, other)
		u.Printf("  %s\n", u.Dim("Their ports are avoided automatically when installing."))
	}
	return nil
}

// byProject groups apps by compose file, in catalog file order.
func (h *homelab) byProject(apps []*catalog.App) []projectApps {
	var out []projectApps
	for _, f := range h.catalog.Files {
		pa := projectApps{file: f}
		seen := map[string]bool{}
		for _, a := range apps {
			if a.File != f || a.Native() != nil {
				continue
			}
			pa.ids = append(pa.ids, a.ID)
			if a.BuildContext != "" {
				pa.built = append(pa.built, a.ID)
			}
			for _, p := range a.Profiles {
				if !seen[p] {
					seen[p] = true
					pa.profiles = append(pa.profiles, p)
				}
			}
		}
		if len(pa.ids) > 0 {
			out = append(out, pa)
		}
	}
	return out
}

type projectApps struct {
	file     *compose.File
	ids      []string
	built    []string
	profiles []string
}

// lifecycle runs compose start/stop/restart/update/remove on selected apps.
func (h *homelab) lifecycle(action string) func(context.Context, []string) error {
	return func(ctx context.Context, args []string) error {
		fs := newFlags(action)
		apply := applyFlag(fs)
		all := false
		if action == "update" {
			fs.BoolVar(&all, "all", false, "")
		}
		tokens, err := parseFlags(fs, args)
		if err != nil {
			return err
		}
		if all {
			if len(tokens) > 0 {
				return fmt.Errorf("homelab update --all takes no app names")
			}
			if tokens, err = h.updatable(ctx); err != nil {
				return err
			}
			if len(tokens) == 0 {
				h.ui.Printf("Nothing to update: no running app takes image updates.\n")
				return nil
			}
			h.ui.Printf("Updates now what the nightly update would (%d apps): %s.\n", len(tokens), strings.Join(tokens, ", "))
			if held := updates.Held(h.envMap()); len(held) > 0 {
				h.ui.Printf("Held, so left alone: %s.\n", strings.Join(held, ", "))
			}
			if err := h.goAhead(*apply, fmt.Sprintf("Update these %d apps now?", len(tokens))); err != nil {
				return err
			}
		}
		if len(tokens) == 0 {
			return fmt.Errorf("name the apps to %s", action)
		}
		sel, err := selector.Resolve(h.catalog, tokens, nil)
		if err != nil {
			return err
		}
		// Only act on what was asked for; dependencies keep running.
		var apps []*catalog.App
		for _, a := range sel.Apps {
			if sel.Requested[a.ID] {
				if a.Native() != nil {
					h.ui.Warn("%s runs natively on the Mac; manage it in its own app", a.ID)
					continue
				}
				apps = append(apps, a)
			}
		}
		if len(apps) == 0 {
			return nil
		}
		if action == "remove" {
			var names []string
			for _, a := range apps {
				names = append(names, a.ID)
			}
			if err := h.goAhead(*apply, fmt.Sprintf("Remove the containers for %s? App data on disk is kept.", strings.Join(names, ", "))); err != nil {
				return err
			}
		}
		client, err := h.docker(ctx)
		if err != nil {
			return err
		}
		if action == "update" {
			if err := h.beforeUpdate(ctx, client, apps); err != nil {
				return err
			}
		}
		// With --all, one project that fails to update leaves the others
		// to go ahead; the failures are listed at the end.
		var failed []string
		for _, pa := range h.byProject(apps) {
			p := h.project(pa.file)
			run := func(args ...string) error { return client.Compose(ctx, p, pa.profiles, args...) }
			switch action {
			case "update":
				err = run(append([]string{"pull", "--ignore-buildable"}, pa.ids...)...)
				if err == nil && len(pa.built) > 0 {
					err = run(append([]string{"build", "--pull"}, pa.built...)...)
				}
				if err == nil {
					err = run(append([]string{"up", "--detach"}, pa.ids...)...)
				}
			case "remove":
				err = run(append([]string{"rm", "--stop", "--force"}, pa.ids...)...)
			default:
				err = run(append([]string{action}, pa.ids...)...)
			}
			if err != nil {
				if !all {
					return err
				}
				h.ui.Warn("%s: %v", strings.Join(pa.ids, ", "), err)
				failed = append(failed, pa.ids...)
			}
		}
		if action == "update" {
			// Keep what they ran before, to go back to (homelab rollback).
			if cs, err := client.Containers(ctx); err == nil {
				h.trackUpdates(ctx, client, cs, false)
			}
		}
		if action != "update" && action != "restart" {
			h.afterChange(ctx)
		}
		if len(failed) > 0 {
			return fmt.Errorf("not updated: %s (the rest were)", strings.Join(failed, ", "))
		}
		return nil
	}
}

// updatable is every running app that takes image updates, the nightly
// ones and those rebuilt from a Dockerfile, without the held ones:
// homelab update --all.
func (h *homelab) updatable(ctx context.Context) ([]string, error) {
	client, err := h.docker(ctx)
	if err != nil {
		return nil, err
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return nil, err
	}
	report := detect.Analyze(h.catalog, containers)
	held := updates.Held(h.envMap())
	var ids []string
	for _, a := range h.catalog.Apps {
		how, _ := a.UpdatePolicy()
		if how != "nightly" && how != "built" || slices.Contains(held, a.ID) {
			continue
		}
		if _, running := runningContainer(report, a.ID); running {
			ids = append(ids, a.ID)
		}
	}
	return ids, nil
}

func (h *homelab) logs(ctx context.Context, args []string) error {
	fs := newFlags("logs")
	follow := fs.Bool("f", false, "")
	tail := fs.String("tail", "200", "")
	tokens, err := parseFlags(fs, args)
	if err != nil {
		return err
	}
	if len(tokens) != 1 {
		return fmt.Errorf("usage: homelab logs <app> [-f]")
	}
	a, ok := h.catalog.Get(tokens[0])
	if !ok {
		return fmt.Errorf("unknown app %q", tokens[0])
	}
	if a.Native() != nil {
		return fmt.Errorf("%s runs natively on the Mac; see its own logs", a.ID)
	}
	client, err := h.docker(ctx)
	if err != nil {
		return err
	}
	cargs := []string{"logs", "--no-log-prefix", "--tail", *tail}
	if *follow {
		cargs = append(cargs, "--follow")
	}
	return client.Compose(ctx, h.project(a.File), a.Profiles, append(cargs, a.ID)...)
}

// compose runs any docker compose command in the project of an app or stack:
//
//	homelab compose immich exec immich-database psql -U postgres
//	homelab compose paperless ps
func (h *homelab) compose(ctx context.Context, args []string) error {
	if len(args) < 2 {
		return fmt.Errorf("usage: homelab compose <app|category|stack> <compose args...>")
	}
	f := h.fileFor(args[0])
	if f == nil {
		return fmt.Errorf("no app or stack named %q", args[0])
	}
	client, err := h.docker(ctx)
	if err != nil {
		return err
	}
	// Enable every profile in the file so commands like down or ps see
	// optional services too.
	seen := map[string]bool{}
	var profiles []string
	for _, id := range f.Order {
		for _, p := range f.Services[id].Profiles {
			if !seen[p] {
				seen[p] = true
				profiles = append(profiles, p)
			}
		}
	}
	return client.Compose(ctx, h.project(f), profiles, args[1:]...)
}

// fileFor finds a compose file by app id/alias, stack folder, or project name.
func (h *homelab) fileFor(name string) *compose.File {
	if a, ok := h.catalog.Get(name); ok && a.Native() == nil {
		return a.File
	}
	for _, f := range h.catalog.Files {
		stack := f != h.catalog.Files[0] && f.Category == "" && filepath.Base(f.Dir) == name
		if f.Name == name || f.Name == "homelab_"+strings.ReplaceAll(name, "-", "_") || f.Category == name || stack {
			return f
		}
	}
	return nil
}

// envMap is .env layered over .env.example, so settings missing from an
// older .env still have their defaults.
func (h *homelab) envMap() map[string]string {
	out := map[string]string{}
	for _, path := range []string{filepath.Join(h.root, ".env.example"), h.envFile} {
		if env, err := envfile.Load(path); err == nil {
			for k, v := range env.Map() {
				out[k] = v
			}
		}
	}
	return out
}

// runningContainer returns the running container for an app, if any.
func runningContainer(report *detect.Report, id string) (docker.Container, bool) {
	if st, m := report.State(id); st == detect.Running && m != nil {
		return m.Container, true
	}
	return docker.Container{}, false
}

func splitList(s string) []string {
	if s == "" {
		return nil
	}
	return strings.Split(s, ",")
}
