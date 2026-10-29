// Package catalog turns compose files into installable apps. compose.yaml and
// stacks/*/compose.yaml are the single source of truth: an app exists if and
// only if a service exists (or a native app is declared), so the catalog
// cannot drift from what Compose can run.
package catalog

import (
	"errors"
	"fmt"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/host"
	"github.com/Snooper42/homelab-wizard/internal/kit"
)

// App is a compose service, or a native Mac app, plus its x-homelab metadata.
type App struct {
	*compose.Service
	native *compose.Native
}

// Name is the display name (falls back to the service id).
func (a *App) Name() string {
	if a.Meta.Name != "" {
		return a.Meta.Name
	}
	return a.ID
}

// LegacyProjects are Compose projects apps used to belong to: homelab_core
// held every single-container app until each category got its own project
// (compose/<category>.yaml). Their containers still count as the app's own
// until homelab migrate moves them.
var LegacyProjects = map[string]bool{"homelab_core": true}

// LegacyCategories maps the category ids before the regroup in 0.9.0 to
// their nearest new one, so your own apps (stacks/custom) keep validating.
var LegacyCategories = map[string]string{
	"infrastructure": "system",
	"productivity":   "documents",
	"home":           "household",
}

// Category returns the category id ("other" when unset).
func (a *App) Category() string {
	if c, ok := LegacyCategories[a.Meta.Category]; ok {
		return c
	}
	if a.Meta.Category != "" {
		return a.Meta.Category
	}
	return "other"
}

// Internal apps are helpers (databases, caches) pulled in as dependencies.
func (a *App) Internal() bool { return a.Meta.Internal }

// Custom reports whether it is one of your own apps (stacks/custom), which
// stay out of the repository's generated docs.
func (a *App) Custom() bool { return a.File != nil && filepath.Base(a.File.Dir) == "custom" }

// Native apps run on the Mac itself; the CLI proxies and monitors them.
func (a *App) Native() *compose.Native { return a.native }

// Phone is the phone app people use the app with ("" for none).
func (a *App) Phone() string {
	if a.native != nil {
		return a.native.Phone
	}
	return a.Meta.Phone
}

// Optional apps carry a Compose profile and only start when asked for.
func (a *App) Optional() bool { return len(a.Profiles) > 0 }

// Public apps are published through the Cloudflare Tunnel.
func (a *App) Public() bool { return a.Meta.Public }

// Admin apps manage the homelab: every Network and System app, and any
// marked admin. They are never published.
func (a *App) Admin() bool {
	return a.Meta.Admin || a.Category() == "network" || a.Category() == "system"
}

// Local apps are opened on this computer only: they get no tailnet or
// domain address, since they have no sign-in of their own.
func (a *App) Local() bool { return a.Meta.Local }

// Stack is the folder of the app's own stack (stacks/<name>), or "" for an
// app in compose/<category>.yaml.
func (a *App) Stack() string {
	if a.File == nil || a.File.Category != "" || filepath.Base(a.File.Path) != "compose.yaml" || filepath.Base(filepath.Dir(a.File.Dir)) != "stacks" {
		return ""
	}
	return filepath.Base(a.File.Dir)
}

// Project is the Compose project the app belongs to.
func (a *App) Project() string { return a.File.Name }

// HasWeb reports whether the app has a browser UI.
func (a *App) HasWeb() bool {
	if a.Meta.Web.Set {
		return !a.Meta.Web.Disabled
	}
	return len(a.Ports) > 0
}

// WebContainerPort is the container port serving the UI (0 if none).
func (a *App) WebContainerPort(lookup compose.Lookup) int {
	if !a.HasWeb() {
		return 0
	}
	if a.Meta.Web.Port > 0 {
		return a.Meta.Web.Port
	}
	for _, p := range a.Ports {
		if r, err := p.Resolve(lookup); err == nil && p.Protocol == "tcp" {
			return r.Container
		}
	}
	return 0
}

// ProxyTarget is the hostname the proxy and tunnel use to reach the app on
// the shared network (the Mac itself for native apps).
func (a *App) ProxyTarget() string {
	switch {
	case a.native != nil:
		return "host.docker.internal"
	case a.Meta.ProxyHost != "":
		return a.Meta.ProxyHost
	}
	return a.ID
}

// Subdomain is the default hostname label for this app.
func (a *App) Subdomain() string {
	if a.Meta.Subdomain != "" {
		return a.Meta.Subdomain
	}
	return a.ID
}

// WebPath is the UI path ("/" by default).
func (a *App) WebPath() string {
	if a.Meta.Path != "" {
		return a.Meta.Path
	}
	return "/"
}

// cacheImage matches small in-memory stores (job queues, caches).
var cacheImage = regexp.MustCompile(`(^|/)(redis|valkey)(:|$)`)

// Memory is about what the app uses in MB on a busy day: x-homelab memory,
// else a typical figure for its kind. Heavy work (indexing a photo library)
// can take more for a while.
func (a *App) Memory() int {
	switch {
	case a.Meta.Memory > 0:
		return a.Meta.Memory
	case a.native != nil:
		return 300
	case cacheImage.MatchString(a.Image):
		return 30
	case databaseImage.MatchString(a.Image):
		return 250
	}
	return 100
}

// databaseImage matches images whose major versions need a dump and restore.
var databaseImage = regexp.MustCompile(`(^|/)(postgres|redis|valkey|mariadb|mysql|mongo|getmeili/meilisearch)(:|$)|immich-app/postgres|(^|/)postgis/postgis:`)

// githubProject is an owner/name on GitHub.
var githubProject = regexp.MustCompile(`^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$`)

// UpdatePolicy is how the app's image is kept current, and why: "nightly"
// (the agent's nightly update, homelab update --all), "built" (rebuilt by
// homelab update), or "manual": an x-homelab pin, with its reason, or a
// database or cache. Native apps have none.
func (a *App) UpdatePolicy() (how, why string) {
	switch {
	case a.native != nil:
		return "", ""
	case a.BuildContext != "":
		return "built", a.Meta.Pin
	case a.Meta.Pin != "":
		return "manual", a.Meta.Pin
	case databaseImage.MatchString(a.Image):
		return "manual", "A database or cache: a new major version needs a dump and restore (homelab db upgrade for PostgreSQL, else Runbooks)"
	}
	return "nightly", ""
}

// Catalog is every app across the compose files, with categories and bundles.
type Catalog struct {
	Root       string
	Files      []*compose.File // compose.yaml first, then stacks in name order
	Apps       []*App
	Categories []compose.Category
	Bundles    []compose.Bundle
	byID       map[string]*App
	byAlias    map[string]*App
	loadIssues []Issue
}

// Format is the layout of the compose files this program understands:
// 2 is one compose/<category>.yaml per category. A homelab folder with a
// newer one needs a newer CLI and app.
const Format = 2

// ErrNewerFormat means the homelab folder is newer than this program.
var ErrNewerFormat = errors.New("this homelab folder is newer than this copy of the homelab: get the newest Homelab Wizard (GitHub › Actions › Release › the latest green run), or run ./homelab, which rebuilds itself")

// Load reads root/compose.yaml and root/stacks/*/compose.yaml.
func Load(root string) (*Catalog, error) {
	core, err := compose.Load(filepath.Join(root, "compose.yaml"))
	if err != nil {
		return nil, err
	}
	if core.Format > Format {
		return nil, ErrNewerFormat
	}
	files := []*compose.File{core}
	// compose/<category>.yaml: one project per category, run from the
	// homelab folder, in the order the categories are declared.
	parts, _ := filepath.Glob(filepath.Join(root, "compose", "*.yaml"))
	rank := map[string]int{}
	for i, c := range core.Categories {
		rank[c.ID] = i + 1
	}
	sort.SliceStable(parts, func(i, j int) bool {
		ri, rj := rank[strings.TrimSuffix(filepath.Base(parts[i]), ".yaml")], rank[strings.TrimSuffix(filepath.Base(parts[j]), ".yaml")]
		if ri == 0 || rj == 0 {
			return ri != 0 || parts[i] < parts[j] && rj == 0
		}
		return ri < rj
	})
	for _, p := range parts {
		f, err := compose.Load(p)
		if err != nil {
			return nil, err
		}
		f.Dir, f.Category = root, strings.TrimSuffix(filepath.Base(p), ".yaml")
		files = append(files, f)
	}
	stacks, _ := filepath.Glob(filepath.Join(root, "stacks", "*", "compose.yaml"))
	sort.Strings(stacks)
	for _, p := range stacks {
		f, err := compose.Load(p)
		if err != nil {
			return nil, err
		}
		files = append(files, f)
	}
	c := New(files...)
	c.Root = root
	if SmallBaseline(root) {
		c.Shrink()
	}
	if onSteamOS() {
		c.ForSteamOS()
	}
	return c, nil
}

// SmallBaseline reports whether `up` starts only the small baseline, so a
// new household picks its apps instead of getting the author's:
// HOMELAB_BASELINE=small in .env, which a folder the desktop app made gets
// when its .env is created. Before that, a kit folder counts as small; an
// existing .env without the setting keeps the full baseline.
func SmallBaseline(root string) bool {
	env, err := envfile.Load(filepath.Join(root, ".env"))
	if err == nil && env.Exists() {
		v, _ := env.Get("HOMELAB_BASELINE")
		return strings.EqualFold(v, "small")
	}
	_, kitFolder := kit.Installed(root)
	return kitFolder
}

// Shrink makes every container app optional except the small baseline
// (x-homelab-small-baseline) and what it depends on.
func (c *Catalog) Shrink() {
	if len(c.Files) == 0 {
		return
	}
	keep := map[string]bool{}
	var walk func(id string)
	walk = func(id string) {
		a, ok := c.byID[id]
		if !ok || keep[id] {
			return
		}
		keep[id] = true
		for _, d := range a.DependsOn {
			walk(d)
		}
	}
	for _, id := range c.Files[0].SmallBaseline {
		walk(id)
	}
	for _, a := range c.Apps {
		if a.native == nil && !a.Optional() && !keep[a.ID] {
			a.Profiles = []string{"optional"}
		}
	}
}

// New builds a catalog. The first file holds the catalog-wide blocks
// (categories, bundles, native apps).
func New(files ...*compose.File) *Catalog {
	c := &Catalog{Files: files, byID: map[string]*App{}, byAlias: map[string]*App{}}
	if len(files) == 0 {
		return c
	}
	root := files[0]
	c.Categories, c.Bundles = root.Categories, root.Bundles
	add := func(a *App) {
		if prev, ok := c.byID[a.ID]; ok {
			c.loadIssues = append(c.loadIssues, Issue{true, fmt.Sprintf("%s is defined in both %s and %s; service names must be unique across stacks", a.ID, rel(prev.Source), rel(a.Source))})
			return
		}
		c.Apps = append(c.Apps, a)
		c.byID[a.ID] = a
	}
	for _, f := range files {
		for _, id := range f.Order {
			add(&App{Service: f.Services[id]})
		}
	}
	for i := range root.Natives {
		n := &root.Natives[i]
		add(&App{native: n, Service: &compose.Service{ID: n.ID, File: root, Labels: map[string]string{}, Meta: compose.Meta{
			Name: n.Name, Category: n.Category, Description: n.Description, Subdomain: n.Subdomain,
			Web: compose.WebPort{Set: true, Port: n.Port}, Public: n.Public, Doc: n.Doc, Conflicts: standIn(n),
		}}})
	}
	for _, a := range c.Apps {
		for _, alias := range a.Meta.Aliases {
			c.byAlias[strings.ToLower(alias)] = a
		}
	}
	return c
}

// standIn is the container app that stands in for n, as a conflict: the
// two are alternatives, sharing a subdomain.
func standIn(n *compose.Native) []string {
	if n.Container == "" {
		return nil
	}
	return []string{n.Container}
}

// onSteamOS reports whether this machine runs SteamOS; tests replace it.
var onSteamOS = func() bool { return host.Current().SteamOS }

// ForSteamOS puts each native app's container (its `container`) in its
// place: SteamOS's system is read-only and takes no packages, so a native
// app has no install there. The container answers to the native app's
// name, so `homelab install jellyfin` and the bundles that name it get the
// container; the native app leaves the catalog.
func (c *Catalog) ForSteamOS() {
	kept := c.Apps[:0]
	for _, a := range c.Apps {
		if n := a.native; n != nil && n.Container != "" {
			if stand, ok := c.byID[n.Container]; ok && stand.native == nil {
				c.byID[a.ID] = stand
				continue
			}
		}
		kept = append(kept, a)
	}
	c.Apps = kept
}

// rel shortens a compose file path to compose.yaml or stacks/<name>/compose.yaml.
func rel(file string) string {
	dir := filepath.Dir(file)
	if filepath.Base(filepath.Dir(dir)) == "stacks" {
		return path.Join("stacks", filepath.Base(dir), filepath.Base(file))
	}
	return filepath.Base(file)
}

// Get returns an app by id or alias.
func (c *Catalog) Get(name string) (*App, bool) {
	n := strings.ToLower(strings.TrimSpace(name))
	if a, ok := c.byID[n]; ok {
		return a, true
	}
	a, ok := c.byAlias[n]
	return a, ok
}

// Bundle returns a bundle by id.
func (c *Catalog) Bundle(id string) (compose.Bundle, bool) {
	for _, b := range c.Bundles {
		if strings.EqualFold(b.ID, id) {
			return b, true
		}
	}
	return compose.Bundle{}, false
}

// BundleByAlias returns the bundle that declares token as an alias.
func (c *Catalog) BundleByAlias(token string) (compose.Bundle, bool) {
	for _, b := range c.Bundles {
		for _, a := range b.Aliases {
			if strings.EqualFold(a, token) {
				return b, true
			}
		}
	}
	return compose.Bundle{}, false
}

// CategoryLabel returns the display label for a category id.
func (c *Catalog) CategoryLabel(id string) string {
	for _, cat := range c.Categories {
		if cat.ID == id {
			return cat.Label
		}
	}
	return id
}

// Baseline returns the apps `homelab up` starts: every container app without
// a profile (helpers included; they are dependencies of the others).
func (c *Catalog) Baseline() []*App {
	var out []*App
	for _, a := range c.Apps {
		if a.native == nil && !a.Optional() {
			out = append(out, a)
		}
	}
	return out
}

// SharedNetwork is the external network every project joins (the core
// file's default network).
func (c *Catalog) SharedNetwork() string {
	if len(c.Files) == 0 {
		return ""
	}
	if nw, ok := c.Files[0].Networks["default"]; ok && nw.External {
		return nw.Name
	}
	return ""
}

// ExternalNetworks lists every external network the given apps' projects use.
func (c *Catalog) ExternalNetworks(apps []*App) []string {
	seen := map[string]bool{}
	var out []string
	for _, a := range apps {
		if a.native != nil {
			continue
		}
		keys := make([]string, 0, len(a.File.Networks))
		for k := range a.File.Networks {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			nw := a.File.Networks[k]
			if nw.External && nw.Name != "" && !seen[nw.Name] {
				seen[nw.Name] = true
				out = append(out, nw.Name)
			}
		}
	}
	return out
}

// DocsDir is the services/ folder for a category ("services/media automation",
// "services/cloud and files"), with forward slashes on every system: it is
// a path in the repository, as the docs link it.
func (c *Catalog) DocsDir(category string) string {
	return path.Join("services", strings.ReplaceAll(strings.ToLower(c.CategoryLabel(category)), " & ", " and "))
}

// DocPath is the app's note, relative to the repository root.
func (c *Catalog) DocPath(a *App) string {
	if a.Meta.Doc != "" {
		return a.Meta.Doc
	}
	return path.Join(c.DocsDir(a.Category()), a.Name()+".md")
}

// Grouped returns visible apps grouped by category, in category order.
func (c *Catalog) Grouped(includeInternal bool) []Group {
	var groups []Group
	index := map[string]int{}
	for _, cat := range c.Categories {
		index[cat.ID] = len(groups)
		groups = append(groups, Group{ID: cat.ID, Label: cat.Label})
	}
	for _, a := range c.Apps {
		if a.Internal() && !includeInternal {
			continue
		}
		i, ok := index[a.Category()]
		if !ok {
			index[a.Category()] = len(groups)
			i = len(groups)
			groups = append(groups, Group{ID: a.Category(), Label: a.Category()})
		}
		groups[i].Apps = append(groups[i].Apps, a)
	}
	out := groups[:0]
	for _, g := range groups {
		if len(g.Apps) > 0 {
			out = append(out, g)
		}
	}
	return out
}

// Group is a category with its apps.
type Group struct {
	ID    string
	Label string
	Apps  []*App
}

// Issue is a catalog validation finding.
type Issue struct {
	Error   bool
	Message string
}

func (i Issue) String() string {
	if i.Error {
		return "error: " + i.Message
	}
	return "warning: " + i.Message
}

// Validate checks metadata consistency. declared is the set of variables in
// .env.example (nil skips the checks that need it).
func (c *Catalog) Validate(declared map[string]bool) []Issue {
	issues := append([]Issue(nil), c.loadIssues...)
	errf := func(format string, args ...any) { issues = append(issues, Issue{true, fmt.Sprintf(format, args...)}) }
	warnf := func(format string, args ...any) { issues = append(issues, Issue{false, fmt.Sprintf(format, args...)}) }

	for _, a := range c.Apps {
		if a.Public() && a.Admin() {
			errf("%s is an admin app and must not be public: its pages would face the internet (docs/Security.md: put Cloudflare Access in front first)", a.ID)
		}
		if a.Public() && a.Local() {
			errf("%s is kept to this computer (local) and cannot be public", a.ID)
		}
	}

	shared := c.SharedNetwork()
	if shared == "" {
		errf("compose.yaml: the default network must be external with a name (the shared network every stack joins)")
	}
	projects := map[string]string{}
	for _, f := range c.Files {
		switch prev, dup := projects[f.Name]; {
		case f.Name == "":
			errf("%s: set a top-level name: (the Compose project name)", rel(f.Path))
		case dup:
			errf("%s and %s use the same project name %q", prev, rel(f.Path), f.Name)
		}
		projects[f.Name] = rel(f.Path)
	}

	cats := map[string]bool{}
	for _, cat := range c.Categories {
		cats[cat.ID] = true
	}
	subdomains := map[string]string{}
	aliases := map[string]string{}
	defaults := map[string]string{}
	for _, a := range c.Apps {
		if a.Meta.Name == "" {
			errf("%s: missing x-homelab metadata", a.ID)
		}
		if !cats[a.Category()] {
			errf("%s: category %q is not declared in x-homelab-categories", a.ID, a.Category())
		}
		for _, dep := range a.DependsOn {
			if d, ok := c.byID[dep]; !ok || d.File != a.File {
				errf("%s: depends on %q, which is not a service in project %s", a.ID, dep, a.Project())
			}
		}
		for _, other := range a.Meta.Conflicts {
			if _, ok := c.byID[other]; !ok {
				errf("%s: conflicts with unknown service %q", a.ID, other)
			}
		}
		for _, alias := range a.Meta.Aliases {
			l := strings.ToLower(alias)
			if _, ok := c.byID[l]; ok {
				errf("%s: alias %q shadows a real service", a.ID, alias)
			}
			if prev, ok := aliases[l]; ok {
				errf("alias %q is used by both %s and %s", alias, prev, a.ID)
			}
			aliases[l] = a.ID
		}
		for _, v := range a.Meta.Requires {
			if declared != nil && !declared[v] {
				errf("%s: requires %s, which is not in .env.example", a.ID, v)
			}
		}
		for _, v := range a.Meta.Login {
			if declared != nil && !declared[v] {
				errf("%s: login %s is not in .env.example", a.ID, v)
			}
		}
		if d := a.Meta.Dump; d != "" && d != "postgres" && !(strings.HasPrefix(d, "sqlite:/") && len(d) > len("sqlite:/")) {
			errf("%s: dump %q is not supported (use postgres, or sqlite:/path/in/container.db)", a.ID, d)
		}
		if v := a.Meta.Version; v != "" {
			switch {
			case a.Meta.Dump != "postgres":
				errf("%s: version %s is for PostgreSQL databases (dump: postgres)", a.ID, v)
			case !strings.Contains(a.Image, "${"+v+":-"):
				errf("%s: version %s is not in its image (postgres:${%s:-<major>})", a.ID, v, v)
			case declared != nil && !declared[v]:
				errf("%s: version %s is not in .env.example", a.ID, v)
			}
		}
		if r := a.Meta.Releases; r != "" && !githubProject.MatchString(r) {
			errf("%s: releases %q is not a GitHub project (owner/name)", a.ID, r)
		}
		for _, vol := range a.Meta.Archive {
			mounted := false
			for _, v := range a.Volumes {
				if v.Source == vol {
					mounted = true
				}
			}
			if !mounted {
				errf("%s: archive lists %q, which is not a named volume of this service", a.ID, vol)
			}
		}
		if a.Meta.ProxyHost != "" {
			if _, ok := c.byID[a.Meta.ProxyHost]; !ok {
				errf("%s: proxy_host %q is not a service", a.ID, a.Meta.ProxyHost)
			}
		}
		if a.Public() && !a.HasWeb() {
			errf("%s: public apps need a web UI", a.ID)
		}
		if a.HasWeb() && !a.Internal() {
			if prev, ok := subdomains[a.Subdomain()]; ok && !conflicting(a, prev) {
				errf("subdomain %q is used by both %s and %s", a.Subdomain(), prev, a.ID)
			}
			subdomains[a.Subdomain()] = a.ID
			if a.WebContainerPort(compose.MapLookup(nil)) == 0 {
				errf("%s: has a web UI but no web port; set x-homelab.web", a.ID)
			}
		}
		if a.native != nil {
			continue
		}
		if a.Image == "" && a.BuildContext == "" {
			errf("%s: has neither image nor build", a.ID)
		}
		if strings.HasPrefix(a.Meta.Dump, "sqlite:") {
			for _, v := range a.Volumes {
				if v.Type == "tmpfs" {
					errf("%s: its tmpfs volume at %s stops the backup's SQLite copy from attaching (docker run --volumes-from); use the service's tmpfs key instead", a.ID, v.Target)
				}
			}
		}
		if a.File != c.Files[0] && a.HasWeb() && a.NetworkMode == "" && shared != "" && !joins(a, shared) {
			errf("%s: has a web UI but does not join the shared %q network, so the proxy cannot reach it", a.ID, shared)
		}
		for _, p := range a.Ports {
			for _, part := range []string{p.HostIP, p.Host, p.Container} {
				for _, ref := range compose.Refs(part) {
					if declared != nil && !declared[ref.Name] && !ref.HasDefault {
						errf("%s: port variable %s has no default and is not in .env.example", a.ID, ref.Name)
					}
				}
			}
			if name, def, ok := p.HostVar(); ok && def != "" {
				key := def + "/" + p.Protocol
				if prev, ok := defaults[key]; ok && prev != name {
					warnf("default host port %s is shared by %s and %s (the installer reassigns on conflict)", key, prev, name)
				}
				defaults[key] = name
			}
		}
	}
	if len(c.Files) > 0 {
		for _, id := range c.Files[0].SmallBaseline {
			if a, ok := c.byID[id]; !ok || a.native != nil {
				errf("x-homelab-small-baseline: %q is not a container app", id)
			}
		}
	}
	for _, b := range c.Bundles {
		for _, id := range b.Apps {
			if _, ok := c.byID[id]; !ok {
				errf("bundle %s: unknown app %q", b.ID, id)
			}
		}
		for _, alias := range b.Aliases {
			if _, ok := c.Get(alias); ok {
				errf("bundle %s: alias %q is also an app name", b.ID, alias)
			}
		}
	}
	sort.SliceStable(issues, func(i, j int) bool { return issues[i].Error && !issues[j].Error })
	return issues
}

// joins reports whether the app joins the network named name.
func joins(a *App, name string) bool {
	keys := a.Networks
	if len(keys) == 0 {
		keys = []string{"default"} // a service without networks joins the default one
	}
	for _, key := range keys {
		if nw, ok := a.File.Networks[key]; ok && (nw.Name == name || nw.Name == "" && key == name) {
			return true
		}
	}
	return false
}

// conflicting apps are alternatives and may share a subdomain.
func conflicting(a *App, otherID string) bool {
	for _, c := range a.Meta.Conflicts {
		if c == otherID {
			return true
		}
	}
	return false
}
