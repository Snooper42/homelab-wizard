// Package api is the engine's structured view for programs that drive it,
// such as the desktop app: plain, JSON-ready types built from the catalog,
// install plans, and status. Secret values never appear in them.
package api

import (
	"path/filepath"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/install"
	"github.com/Snooper42/homelab-wizard/internal/ports"
	"github.com/Snooper42/homelab-wizard/internal/savings"
	"github.com/Snooper42/homelab-wizard/internal/updates"
	"github.com/Snooper42/homelab-wizard/internal/wiring"
)

// Catalog is everything that can be installed.
type Catalog struct {
	Categories []Category `json:"categories"`
	Apps       []App      `json:"apps"`
	Presets    []Preset   `json:"presets"`
	// Wireable are the apps "connect the apps for me" covers.
	Wireable []string `json:"wireable"`
}

// Category groups apps on the "Choose stacks" screen.
type Category struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

// App is one catalog entry.
type App struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Category    string   `json:"category"`
	Description string   `json:"description"`
	Kind        string   `json:"kind"` // baseline, optional, native, or helper
	Stack       string   `json:"stack,omitempty"`
	Aliases     []string `json:"aliases,omitempty"`
	DependsOn   []string `json:"dependsOn,omitempty"`
	Conflicts   []string `json:"conflicts,omitempty"`
	// Inputs are the .env settings the app needs before it can start; a
	// form collects them and passes them back with --set.
	Inputs []string `json:"inputs,omitempty"`
	// Login is the .env settings that sign in to it (user, then password).
	Login   []string `json:"login,omitempty"`
	Public  bool     `json:"public"`
	Warning string   `json:"warning,omitempty"`
	// MacApp: a native app installed as a Mac app, which Status can open
	// (or start as a service, off the Mac).
	MacApp bool `json:"macApp,omitempty"`
	// Phone is the phone app people use it with.
	Phone string `json:"phone,omitempty"`
	// Replaces are the subscriptions it stands in for (docs/Savings.md).
	Replaces []string `json:"replaces,omitempty"`
}

// Preset is a ready-made selection: a bundle or a whole stack. Token is
// what to pass to install or plan.
type Preset struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description,omitempty"`
	Token       string   `json:"token"`
	Apps        []string `json:"apps"`
	// Starter presets are the first picks, shown as cards above the full list.
	Starter bool `json:"starter,omitempty"`
}

// CatalogOf describes c, helpers included.
func CatalogOf(c *catalog.Catalog) Catalog {
	out := Catalog{Categories: []Category{}, Apps: []App{}, Presets: []Preset{}, Wireable: wiring.Wireable}
	replaces := map[string][]string{}
	if rows, err := savings.Load(c.Root); err == nil {
		for _, r := range rows {
			for _, d := range r.Docs {
				replaces[d] = append(replaces[d], r.Replaces)
			}
		}
	}
	for _, g := range c.Grouped(true) {
		out.Categories = append(out.Categories, Category{g.ID, g.Label})
		for _, a := range g.Apps {
			app := appOf(c, a)
			app.Replaces = replaces[filepath.ToSlash(c.DocPath(a))]
			out.Apps = append(out.Apps, app)
		}
	}
	for _, b := range c.Bundles {
		out.Presets = append(out.Presets, Preset{ID: b.ID, Name: b.Name, Description: b.Description, Token: "@" + b.ID, Apps: b.Apps, Starter: b.Starter})
	}
	// One preset per stack folder; the category files are not stacks.
	for _, f := range c.Files[1:] {
		p := Preset{}
		for _, a := range c.Apps {
			if a.File != f || a.Internal() || a.Stack() == "" {
				continue
			}
			if p.Name == "" {
				p = Preset{ID: "stack:" + a.Stack(), Token: "stack:" + a.Stack(), Name: a.Name(), Description: a.Meta.Description}
			}
			p.Apps = append(p.Apps, a.ID)
		}
		if len(p.Apps) > 0 {
			out.Presets = append(out.Presets, p)
		}
	}
	return out
}

func appOf(c *catalog.Catalog, a *catalog.App) App {
	kind := "baseline"
	switch {
	case a.Native() != nil:
		kind = "native"
	case a.Internal():
		kind = "helper"
	case a.Optional():
		kind = "optional"
	}
	out := App{
		ID: a.ID, Name: a.Name(), Category: a.Category(), Description: a.Meta.Description, Kind: kind,
		Aliases: a.Meta.Aliases, DependsOn: a.DependsOn, Conflicts: a.Meta.Conflicts,
		Inputs: a.Meta.Requires, Login: a.Meta.Login, Phone: a.Phone(), Public: a.Public(), Warning: a.Meta.Warning,
	}
	out.Stack = a.Stack()
	if n := a.Native(); n != nil {
		out.MacApp = strings.Contains(n.Install, "--cask")
	}
	return out
}

// Plan is what an install will do.
type Plan struct {
	Ready     bool              `json:"ready"`
	Requested []string          `json:"requested"`
	Added     map[string]string `json:"added"` // dependency -> the app that needs it
	Notes     []string          `json:"notes"`
	Start     []string          `json:"start"`
	Skips     []Skip            `json:"skips"`
	Ports     []PortChange      `json:"portChanges"`
	Env       []EnvChange       `json:"envChanges"`
	Folders   []string          `json:"folders"`
	Networks  []string          `json:"networks"`
	Warnings  []string          `json:"warnings"`
	Problems  []string          `json:"problems"`
	// Memory: what the apps running after the install use, and the room
	// this machine has for them beside the system (MB; room 0: unknown).
	Memory PlanMemory `json:"memory"`
}

// PlanMemory is a plan's memory check, in MB.
type PlanMemory struct {
	Use  int `json:"use"`
	Room int `json:"room"`
}

// Skip is an app that will not start, and why.
type Skip struct {
	App    string `json:"app"`
	Reason string `json:"reason"`
}

// PortChange moves an app off a busy host port.
type PortChange struct {
	Var    string `json:"var"`
	From   int    `json:"from"`
	To     int    `json:"to"`
	Reason string `json:"reason"`
}

// EnvChange is a .env setting the install writes; Value is empty for secrets.
type EnvChange struct {
	Key    string `json:"key"`
	Reason string `json:"reason"`
	Secret bool   `json:"secret"`
	Value  string `json:"value,omitempty"`
}

// PlanOf describes p.
func PlanOf(p *install.Plan) Plan {
	out := Plan{
		Ready: p.Ready(), Requested: []string{}, Added: map[string]string{}, Notes: nonNil(p.Selection.Notes),
		Start: []string{}, Skips: []Skip{}, Ports: []PortChange{}, Env: []EnvChange{},
		Folders: nonNil(p.Dirs), Networks: nonNil(p.Networks), Warnings: nonNil(p.Warnings), Problems: nonNil(p.Problems),
		Memory: PlanMemory{Use: p.Memory.Use, Room: p.Memory.Room},
	}
	for _, a := range p.Selection.Apps {
		if p.Selection.Requested[a.ID] {
			out.Requested = append(out.Requested, a.ID)
		} else if by, ok := p.Selection.RequiredBy[a.ID]; ok {
			out.Added[a.ID] = by
		}
	}
	for _, a := range p.Start {
		out.Start = append(out.Start, a.ID)
	}
	for _, s := range p.Skips {
		out.Skips = append(out.Skips, Skip{s.App.ID, s.Reason})
	}
	if p.Ports != nil {
		for _, c := range p.Ports.Changes {
			out.Ports = append(out.Ports, PortChange{c.Var, c.From, c.To, c.Reason})
		}
	}
	for _, c := range p.EnvChanges {
		e := EnvChange{Key: c.Key, Reason: c.Reason, Secret: c.Secret}
		if !c.Secret {
			e.Value = c.Value
		}
		out.Env = append(out.Env, e)
	}
	return out
}

// Started is an app an install started, with its local address.
type Started struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	URL  string `json:"url,omitempty"`
}

// StartedOf lists the apps a plan starts, helpers left out, with the
// address each answers on.
func StartedOf(p *install.Plan) []Started {
	lookup := compose.MapLookup(p.Env.Map())
	out := []Started{}
	for _, a := range p.Start {
		if !a.Internal() {
			out = append(out, Started{ID: a.ID, Name: a.Name(), URL: ports.WebURL(a, p.Ports.Bindings, lookup)})
		}
	}
	return out
}

// Status is the state of every app.
type Status struct {
	Apps []AppStatus `json:"apps"`
	// Missing counts baseline apps that are not running.
	Missing int `json:"missing"`
	// Unmatched counts running containers that are not catalog apps.
	Unmatched int `json:"unmatched"`
	// Savings is what the running apps replace in subscriptions a year,
	// from docs/Savings.md.
	Savings float64 `json:"savings"`
	// Updates is whether nightly image updates run, and when.
	Updates updates.State `json:"updates"`
	// BatteryPaused are the apps the battery saver paused until power
	// returns.
	BatteryPaused []string `json:"batteryPaused,omitempty"`
	// Checking says some apps' pages are still to be asked: a Status made
	// without waiting for them (StatusRemembered) has only the answers kept
	// from the last few seconds; Probe asks the rest.
	Checking bool `json:"checking,omitempty"`
}

// AppStatus is one app's state.
type AppStatus struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	State     string `json:"state"`            // running, stopped, elsewhere, missing, or not running
	Health    string `json:"health,omitempty"` // healthy, unhealthy, starting, restarting (a crash loop), or native
	Container string `json:"container,omitempty"`
	URL       string `json:"url,omitempty"`      // on this machine
	Address   string `json:"address,omitempty"`  // on the homelab domain
	Since     string `json:"since,omitempty"`    // when it last started (RFC 3339), while running
	Restarts  int    `json:"restarts,omitempty"` // restarts by its restart policy since it was created
	// UpdatedAt is when its last update was noticed, while the image it ran
	// before is kept to go back to (homelab rollback); RFC 3339.
	UpdatedAt string `json:"updatedAt,omitempty"`
	// Held: its updates are held after a rollback (homelab updates release).
	Held bool `json:"held,omitempty"`
	// WaitingFor is the drive a stopped app's folders are on while that
	// drive is not plugged in ("/Volumes/Hobbies"); it starts once it is.
	WaitingFor string `json:"waitingFor,omitempty"`
	// NotAnswering is why a running app's web address on this machine
	// does not answer ("connection refused", "HTTP 502"): the container
	// runs, but the app does not work.
	NotAnswering string `json:"notAnswering,omitempty"`
	// SettingsChanged: its compose file or .env changed since its
	// container was made, so it runs the old settings until `up` (or Fix
	// it) recreates it.
	SettingsChanged bool `json:"settingsChanged,omitempty"`
}

func nonNil(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
