// Package docs keeps the knowledge base honest. Facts that live in the
// compose files (images, projects, addresses, ports, data folders, update
// policy) are written into the notes between markers, so they cannot drift;
// everything outside the markers is hand-written. It also checks that every
// note carries the repository version.
package docs

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/savings"
)

// Markers around generated text.
const (
	Begin = "<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->"
	End   = "<!-- END homelab:generated -->"
)

// Generator renders the generated blocks.
type Generator struct {
	Catalog *catalog.Catalog
	Env     map[string]string // .env.example values, so output is the same on every Mac
	Version string
}

func (g Generator) lookup() compose.Lookup { return compose.MapLookup(g.Env) }

// image is a service's image with its settings filled in from .env.example
// (postgres:${PAPERLESS_DB_VERSION:-18} reads postgres:18).
func (g Generator) image(img string) string {
	if s, err := compose.Interpolate(img, g.lookup()); err == nil {
		return s
	}
	return img
}

func (g Generator) domain() string {
	if d := g.Env["HOMELAB_DOMAIN"]; d != "" {
		return d
	}
	return "example.com"
}

// Blocks maps repository-relative paths to their generated block.
func (g Generator) Blocks() map[string]string {
	out := map[string]string{
		"docs/Inventory.md":  g.inventory(),
		"docs/Services.md":   g.index(),
		"docs/Automation.md": g.updates(),
		"README.md":          g.catalogTable(),
	}
	for _, a := range g.Catalog.Apps {
		if !a.Custom() {
			out[g.Catalog.DocPath(a)] = g.service(a)
		}
	}
	return out
}

// Required lists the notes that must exist: one per visible app.
func (g Generator) Required() []string {
	var out []string
	for _, a := range g.Catalog.Apps {
		if !a.Internal() && !a.Custom() {
			out = append(out, g.Catalog.DocPath(a))
		}
	}
	return append(out, "docs/Inventory.md", "docs/Services.md", "docs/Automation.md")
}

// Skeleton is a new service note for an app that has none yet.
func (g Generator) Skeleton(a *catalog.App) string {
	return fmt.Sprintf(`---
version: %s
---

# %s

%s

%s
%s
%s

## Purpose

What it is for and who uses it.

## Setup

First-run steps inside the app.

## Backup

What is backed up and how, or the gap.

## Troubleshooting

Known problems and fixes.
`, g.Version, a.Name(), sentence(a.Meta.Description), Begin, g.service(a), End)
}

// sentence ends a catalog description with a full stop, as a note's
// opening line.
func sentence(s string) string {
	if s == "" || strings.HasSuffix(s, ".") {
		return s
	}
	return s + "."
}

func code(s string) string { return "`" + s + "`" }

func (g Generator) relRoot(p string) string {
	// As the docs write it, with forward slashes on every system.
	if rel, err := filepath.Rel(g.Catalog.Root, p); err == nil && !strings.HasPrefix(rel, "..") {
		return filepath.ToSlash(rel)
	}
	return filepath.ToSlash(p)
}

func (g Generator) address(a *catalog.App) string {
	if !a.HasWeb() || a.Internal() || a.Local() {
		return ""
	}
	return "https://" + a.Subdomain() + "." + g.domain()
}

// addressCell is an app's address for a table: this computer only for a local app.
func (g Generator) addressCell(a *catalog.App) string {
	if a.Local() && a.HasWeb() {
		return "this computer only"
	}
	return g.address(a)
}

func (g Generator) localURL(a *catalog.App) (string, string) {
	if n := a.Native(); n != nil {
		return fmt.Sprintf("http://localhost:%d", n.Port), ""
	}
	web := a.WebContainerPort(g.lookup())
	owner := a
	if a.Meta.ProxyHost != "" {
		if p, ok := g.Catalog.Get(a.Meta.ProxyHost); ok {
			owner = p
		}
	}
	for _, p := range owner.Ports {
		r, err := p.Resolve(g.lookup())
		if err != nil || r.Container != web || r.HostPort == 0 {
			continue
		}
		v, _, _ := p.HostVar()
		return fmt.Sprintf("http://localhost:%d", r.HostPort), v
	}
	return "", ""
}

func (g Generator) startsWith(a *catalog.App) string {
	switch {
	case a.Native() != nil:
		return "No: a native app (" + code(a.Native().Install) + ")"
	case a.Optional():
		return "No: optional, " + code("./homelab install "+a.ID)
	}
	if len(a.Meta.Requires) > 0 {
		return "Yes, once " + code(strings.Join(a.Meta.Requires, ", ")) + " is set in .env"
	}
	return "Yes (" + code("./homelab up") + ")"
}

// helpers are the internal services the app needs, directly or indirectly.
func (g Generator) helpers(a *catalog.App) []*catalog.App {
	var out []*catalog.App
	seen := map[string]bool{a.ID: true}
	var walk func(x *catalog.App)
	walk = func(x *catalog.App) {
		for _, d := range x.DependsOn {
			dep, ok := g.Catalog.Get(d)
			if !ok || seen[dep.ID] {
				continue
			}
			seen[dep.ID] = true
			if dep.Internal() {
				out = append(out, dep)
			}
			walk(dep)
		}
	}
	walk(a)
	return out
}

func (g Generator) data(a *catalog.App) []string {
	var out []string
	for _, v := range a.Volumes {
		r, err := v.Resolve(g.lookup(), a.File.Dir, "~")
		if err != nil || r.Source == "" || filepath.ToSlash(r.Source) == "/var/run/docker.sock" {
			continue
		}
		src := r.Source
		if r.Bind {
			src = g.relRoot(src)
		} else {
			src += " (volume)"
		}
		if v.ReadOnly {
			src += ", read-only"
		}
		out = append(out, code(src)+" → "+code(r.Target))
	}
	return out
}

func (g Generator) service(a *catalog.App) string {
	var rows [][2]string
	add := func(k, v string) {
		if v != "" {
			rows = append(rows, [2]string{k, v})
		}
	}
	if n := a.Native(); n != nil {
		add("Runs as", "A native app, not a container")
		add("Install", code(n.Install))
	} else {
		add("Service", fmt.Sprintf("%s in %s (project %s)", code(a.ID), code(g.relRoot(a.Source)), code(a.Project())))
		if a.BuildContext != "" {
			add("Image", "Built locally from "+code(g.relRoot(filepath.Join(a.File.Dir, a.BuildContext))))
		} else {
			add("Image", code(g.image(a.Image)))
		}
	}
	add("Category", g.Catalog.CategoryLabel(a.Category()))
	add("Starts with `./homelab up`", g.startsWith(a))
	if addr := g.address(a); addr != "" {
		where := "LAN, through Nginx Proxy Manager"
		if a.Public() {
			where = "LAN and public, through the Cloudflare Tunnel"
		}
		add("Address", addr+" ("+where+")")
	} else if a.Local() && a.HasWeb() {
		add("Address", "this computer only: it has no sign-in of its own, so it gets no tailnet or domain address")
	}
	if local, v := g.localURL(a); local != "" {
		if v != "" {
			local += " (" + code(v) + ")"
		}
		add("On this machine", local)
	}
	if len(a.DependsOn) > 0 {
		var deps []string
		for _, d := range a.DependsOn {
			deps = append(deps, code(d))
		}
		add("Depends on", strings.Join(deps, ", "))
	}
	var help []string
	for _, h := range g.helpers(a) {
		desc := code(h.ID) + " " + code(g.image(h.Image))
		if h.Meta.Dump != "" {
			desc += ", dumped daily by " + code("./homelab backup")
		}
		if len(h.Meta.Archive) > 0 {
			desc += ", volume " + code(strings.Join(h.Meta.Archive, ", ")) + " archived daily by " + code("./homelab backup")
		}
		help = append(help, desc)
	}
	add("Helpers", strings.Join(help, "<br>"))
	add("Data", strings.Join(g.data(a), "<br>"))
	if a.Meta.Dump != "" {
		add("Database dump", "Daily by "+code("./homelab backup")+" into "+code("recovery-staging/databases/"+a.ID))
	}
	for _, v := range a.Meta.Archive {
		add("Volume archive", code(v)+" daily by "+code("./homelab backup")+" into "+code("recovery-staging/volumes/"+v))
	}
	if how, why := a.UpdatePolicy(); how != "" {
		add("Updates", updateText(a, how, why))
	}
	if len(a.Meta.Requires) > 0 {
		add("Needs in .env", code(strings.Join(a.Meta.Requires, ", ")))
	}
	if len(a.Meta.Aliases) > 0 {
		add("Also known as", strings.Join(a.Meta.Aliases, ", "))
	}
	var b strings.Builder
	b.WriteString("| | |\n|---|---|\n")
	for _, r := range rows {
		fmt.Fprintf(&b, "| %s | %s |\n", r[0], strings.ReplaceAll(r[1], "|", `\|`))
	}
	return strings.TrimRight(b.String(), "\n")
}

func (g Generator) link(a *catalog.App, fromDir string) string {
	rel, _ := filepath.Rel(fromDir, g.Catalog.DocPath(a))
	return fmt.Sprintf("[%s](<%s>)", a.Name(), filepath.ToSlash(rel))
}

// updateText is how an app is updated, in words for its note.
func updateText(a *catalog.App, how, why string) string {
	var s string
	switch how {
	case "nightly":
		s = "Nightly at 4 AM, with a copy of its data first"
	case "built":
		s = "Built locally: " + code("./homelab update "+a.ID) + " rebuilds it"
	default:
		s = "By hand"
	}
	if why != "" {
		s += ". " + why
	}
	return s
}

// updates is the table of who updates which image, for Automation.md.
func (g Generator) updates() string {
	name := func(a *catalog.App) string {
		if a.Internal() {
			return code(a.ID)
		}
		return g.link(a, "docs")
	}
	var nightly, built, manual [][]string
	for _, a := range g.Catalog.Apps {
		how, why := a.UpdatePolicy()
		switch how {
		case "nightly":
			nightly = append(nightly, []string{name(a), code(g.image(a.Image)), why})
		case "built":
			built = append(built, []string{name(a), code(g.relRoot(filepath.Join(a.File.Dir, a.BuildContext))), why})
		case "manual":
			manual = append(manual, []string{name(a), code(g.image(a.Image)), why})
		}
	}
	var b strings.Builder
	table := func(title, intro string, head []string, rows [][]string) {
		if len(rows) == 0 {
			return
		}
		empty := true // drop a last column with nothing in it
		for _, r := range rows {
			empty = empty && r[len(r)-1] == ""
		}
		if empty {
			head = head[:len(head)-1]
			for i := range rows {
				rows[i] = rows[i][:len(rows[i])-1]
			}
		}
		fmt.Fprintf(&b, "### %s (%d)\n\n%s\n\n| %s |\n|%s\n", title, len(rows), intro, strings.Join(head, " | "), strings.Repeat("---|", len(head)))
		for _, r := range rows {
			fmt.Fprintf(&b, "| %s |\n", strings.Join(r, " | "))
		}
		b.WriteString("\n")
	}
	table("Nightly", "The background agent runs `./homelab update --all` at 4 AM (`WATCHTOWER_SCHEDULE`): for each app with a newer image it dumps its databases, copies its data, then pulls the image and recreates the container.", []string{"App", "Image", "Note"}, nightly)
	table("Built locally", "Built from a Dockerfile in this repository; `./homelab update <app>` rebuilds it on the latest base image.", []string{"App", "Built from", "Why"}, built)
	table("By hand", "Left out of the nightly update, each for the reason given. Update with a backup first: `./homelab backup --apply`, then `./homelab update <app>` (or the steps in its note).", []string{"App", "Image", "Why"}, manual)
	return strings.TrimRight(b.String(), "\n")
}

func (g Generator) inventory() string {
	var b strings.Builder
	table := func(title string, head []string, rows [][]string) {
		if len(rows) == 0 {
			return
		}
		fmt.Fprintf(&b, "### %s\n\n| %s |\n|%s\n", title, strings.Join(head, " | "), strings.Repeat("---|", len(head)))
		for _, r := range rows {
			fmt.Fprintf(&b, "| %s |\n", strings.Join(r, " | "))
		}
		b.WriteString("\n")
	}
	var base, optional, native, helpers [][]string
	var public []string
	for _, a := range g.Catalog.Apps {
		if a.Custom() {
			continue
		}
		local, _ := g.localURL(a)
		pub := ""
		if a.Public() {
			pub = "Yes"
			public = append(public, a.Subdomain()+"."+g.domain())
		}
		switch {
		case a.Internal():
			var backups []string
			if a.Meta.Dump != "" {
				backups = append(backups, "Daily dump")
			}
			if len(a.Meta.Archive) > 0 {
				backups = append(backups, "Daily volume archive")
			}
			helpers = append(helpers, []string{code(a.ID), code(a.Project()), code(g.image(a.Image)), strings.Join(backups, ", ")})
		case a.Native() != nil:
			native = append(native, []string{g.link(a, "docs"), g.addressCell(a), local, code(a.Native().Install)})
		case a.Optional():
			optional = append(optional, []string{g.link(a, "docs"), g.addressCell(a), local, code("./homelab install " + a.ID)})
		default:
			base = append(base, []string{g.link(a, "docs"), code(a.Project()), g.addressCell(a), local, pub})
		}
	}
	table("Baseline (started by ./homelab up)", []string{"App", "Project", "Address", "On this machine", "Public"}, base)
	table("Optional (ready to slot in)", []string{"App", "Address", "On this machine", "Install"}, optional)
	table("Native apps", []string{"App", "Address", "On this machine", "Install"}, native)
	table("Helpers (databases and caches)", []string{"Service", "Project", "Image", "Backup"}, helpers)
	sort.Strings(public)
	fmt.Fprintf(&b, "### Public hostnames (Cloudflare Tunnel)\n\n")
	for _, h := range public {
		fmt.Fprintf(&b, "- %s\n", h)
	}
	return strings.TrimRight(b.String(), "\n")
}

// catalogTable is the README's catalog: every app you can run, by category,
// with what it does, how it runs, its address, and what it replaces
// (from docs/Savings.md).
func (g Generator) catalogTable() string {
	replaces := map[string][]string{}
	rows, _ := savings.Load(g.Catalog.Root)
	for _, r := range rows {
		for _, d := range r.Docs {
			replaces[d] = append(replaces[d], r.Replaces)
		}
	}
	var b strings.Builder
	counts := map[string]int{}
	for _, grp := range g.Catalog.Grouped(false) {
		fmt.Fprintf(&b, "### %s\n\n| App | What it does | Runs | Address | Replaces |\n|---|---|---|---|---|\n", grp.Label)
		for _, a := range grp.Apps {
			if a.Custom() {
				continue
			}
			runs := "Baseline"
			switch {
			case a.Native() != nil:
				runs = "Native app"
			case a.Optional():
				runs = "Optional: " + code("./homelab install "+a.ID)
			}
			counts[strings.SplitN(runs, ":", 2)[0]]++
			fmt.Fprintf(&b, "| %s | %s | %s | %s | %s |\n", g.link(a, "."), a.Meta.Description, runs, g.addressCell(a),
				strings.Join(replaces[filepath.ToSlash(g.Catalog.DocPath(a))], ", "))
		}
		b.WriteString("\n")
	}
	fmt.Fprintf(&b, "%d apps: %d baseline (started by %s), %d optional, %d native. Databases and caches that apps need start with them and are not listed.",
		counts["Baseline"]+counts["Optional"]+counts["Native app"], counts["Baseline"], code("./homelab up"), counts["Optional"], counts["Native app"])
	return b.String()
}

func (g Generator) index() string {
	var b strings.Builder
	for _, grp := range g.Catalog.Grouped(false) {
		fmt.Fprintf(&b, "### %s\n\n| Service | Address | Starts with `./homelab up` |\n|---|---|---|\n", grp.Label)
		for _, a := range grp.Apps {
			if a.Custom() {
				continue
			}
			starts := "Yes"
			switch {
			case a.Native() != nil:
				starts = "Native app"
			case a.Optional():
				starts = "Optional"
			}
			fmt.Fprintf(&b, "| %s | %s | %s |\n", g.link(a, "docs"), g.addressCell(a), starts)
		}
		b.WriteString("\n")
	}
	return strings.TrimRight(b.String(), "\n")
}

// Replace swaps the text between the markers for block.
func Replace(content, block string) (string, error) {
	start := strings.Index(content, Begin)
	end := strings.Index(content, End)
	if start < 0 || end < start {
		return "", fmt.Errorf("missing the %q / %q markers", Begin, End)
	}
	return content[:start+len(Begin)] + "\n" + block + "\n" + content[end:], nil
}

// Issue is a docs problem.
type Issue struct {
	Path    string
	Message string
}

// Sync rewrites stale blocks (apply) or only reports them. Missing required
// notes are created from Skeleton when apply is set.
func (g Generator) Sync(apply bool) (changed []string, issues []Issue, err error) {
	blocks := g.Blocks()
	required := map[string]bool{}
	for _, p := range g.Required() {
		required[p] = true
	}
	paths := make([]string, 0, len(blocks))
	for p := range blocks {
		paths = append(paths, p)
	}
	sort.Strings(paths)
	byPath := map[string]*catalog.App{}
	for _, a := range g.Catalog.Apps {
		byPath[g.Catalog.DocPath(a)] = a
	}
	for _, rel := range paths {
		full := filepath.Join(g.Catalog.Root, rel)
		data, rerr := os.ReadFile(full)
		if os.IsNotExist(rerr) {
			if !required[rel] {
				continue
			}
			a := byPath[rel]
			if !apply || a == nil {
				issues = append(issues, Issue{rel, "missing (./homelab docs creates it)"})
				continue
			}
			if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
				return changed, issues, err
			}
			if err := os.WriteFile(full, []byte(g.Skeleton(a)), 0o644); err != nil {
				return changed, issues, err
			}
			changed = append(changed, rel)
			continue
		}
		if rerr != nil {
			return changed, issues, rerr
		}
		next, rerr := Replace(string(data), blocks[rel])
		if rerr != nil {
			if required[rel] {
				issues = append(issues, Issue{rel, rerr.Error()})
			}
			continue
		}
		if next == string(data) {
			continue
		}
		if !apply {
			issues = append(issues, Issue{rel, "generated facts are out of date (run ./homelab docs)"})
			continue
		}
		if err := os.WriteFile(full, []byte(next), 0o644); err != nil {
			return changed, issues, err
		}
		changed = append(changed, rel)
	}
	return changed, issues, nil
}

// CheckVersions reports Markdown files under dirs whose front matter version
// is missing or differs from version.
func CheckVersions(root, version string, dirs ...string) []Issue {
	var issues []Issue
	for _, d := range dirs {
		_ = filepath.WalkDir(filepath.Join(root, d), func(path string, e os.DirEntry, err error) error {
			if err != nil || e.IsDir() || filepath.Ext(path) != ".md" {
				return nil
			}
			rel, _ := filepath.Rel(root, path)
			rel = filepath.ToSlash(rel)
			if v := frontMatterVersion(path); v != version {
				msg := "no version in front matter"
				if v != "" {
					msg = fmt.Sprintf("version %s, expected %s", v, version)
				}
				issues = append(issues, Issue{rel, msg})
			}
			return nil
		})
	}
	return issues
}

func frontMatterVersion(path string) string {
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()
	s := bufio.NewScanner(f)
	if !s.Scan() || strings.TrimSpace(s.Text()) != "---" {
		return ""
	}
	for s.Scan() {
		line := strings.TrimSpace(s.Text())
		if line == "---" {
			break
		}
		if v, ok := strings.CutPrefix(line, "version:"); ok {
			return strings.Trim(strings.TrimSpace(v), `"'`)
		}
	}
	return ""
}
