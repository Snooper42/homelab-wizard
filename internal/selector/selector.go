// Package selector resolves user selections ("sonarr", "*-arr", "@media",
// "cat:downloads", aliases like "overseerr") into a set of apps plus the
// dependencies they need.
package selector

import (
	"fmt"
	"path"
	"sort"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
)

// Selection is the resolved result.
type Selection struct {
	// Apps in install order (dependencies before dependents, then compose order).
	Apps []*catalog.App
	// Requested holds the apps the user asked for directly.
	Requested map[string]bool
	// RequiredBy maps an auto-added dependency to the app that needed it.
	RequiredBy map[string]string
	// Notes explains alias and glob expansions.
	Notes []string
}

// Has reports whether id is selected.
func (s *Selection) Has(id string) bool {
	for _, a := range s.Apps {
		if a.ID == id {
			return true
		}
	}
	return false
}

// IDs returns the selected app ids.
func (s *Selection) IDs() []string {
	ids := make([]string, len(s.Apps))
	for i, a := range s.Apps {
		ids[i] = a.ID
	}
	return ids
}

// Resolve expands tokens. Tokens may be:
//
//	sonarr              app id
//	overseerr           alias (resolves to seerr)
//	*-arr               bundle alias (the curated *arr stack)
//	son*, *arr          glob over app ids and aliases
//	@media, bundle:media  bundle
//	cat:arr, category:arr all visible apps in a category
//
// excludes removes apps (by id, alias, or glob) before dependencies are added.
func Resolve(c *catalog.Catalog, tokens, excludes []string) (*Selection, error) {
	sel := &Selection{Requested: map[string]bool{}, RequiredBy: map[string]string{}}
	var picked []*catalog.App
	add := func(a *catalog.App) {
		if !sel.Requested[a.ID] {
			sel.Requested[a.ID] = true
			picked = append(picked, a)
		}
	}
	for _, raw := range splitTokens(tokens) {
		apps, note, err := expand(c, raw)
		if err != nil {
			return nil, err
		}
		if note != "" {
			sel.Notes = append(sel.Notes, note)
		}
		for _, a := range apps {
			add(a)
		}
	}
	excluded := map[string]bool{}
	for _, raw := range splitTokens(excludes) {
		apps, _, err := expand(c, raw)
		if err != nil {
			return nil, fmt.Errorf("--exclude: %w", err)
		}
		for _, a := range apps {
			excluded[a.ID] = true
			delete(sel.Requested, a.ID)
		}
	}
	var kept []*catalog.App
	for _, a := range picked {
		if !excluded[a.ID] {
			kept = append(kept, a)
		}
	}
	if len(kept) == 0 {
		return nil, fmt.Errorf("nothing selected")
	}

	// Dependency closure.
	all := map[string]bool{}
	var walk func(a *catalog.App, parent string) error
	walk = func(a *catalog.App, parent string) error {
		if all[a.ID] {
			return nil
		}
		if excluded[a.ID] && parent != "" {
			return fmt.Errorf("%s needs %s, which you excluded", parent, a.ID)
		}
		all[a.ID] = true
		if parent != "" && !sel.Requested[a.ID] {
			sel.RequiredBy[a.ID] = parent
		}
		for _, dep := range a.DependsOn {
			d, ok := c.Get(dep)
			if !ok {
				return fmt.Errorf("%s depends on unknown service %s", a.ID, dep)
			}
			if err := walk(d, a.ID); err != nil {
				return err
			}
		}
		return nil
	}
	for _, a := range kept {
		if err := walk(a, ""); err != nil {
			return nil, err
		}
	}

	// Conflicts inside the selection.
	for _, a := range c.Apps {
		if !all[a.ID] {
			continue
		}
		for _, other := range a.Meta.Conflicts {
			if all[other] && a.ID < other {
				return nil, fmt.Errorf("%s and %s are alternatives and cannot be installed together; keep one (for example add --exclude %s)", a.ID, other, other)
			}
		}
	}
	sel.Apps = order(c, all)
	return sel, nil
}

// expand resolves one token.
func expand(c *catalog.Catalog, raw string) ([]*catalog.App, string, error) {
	tok := strings.ToLower(strings.TrimSpace(raw))
	if b, ok := c.BundleByAlias(tok); ok {
		return bundleApps(c, b), fmt.Sprintf("%s is the @%s bundle: %s", raw, b.ID, strings.Join(b.Apps, ", ")), nil
	}
	switch {
	case strings.HasPrefix(tok, "@") || strings.HasPrefix(tok, "bundle:"):
		id := strings.TrimPrefix(strings.TrimPrefix(tok, "@"), "bundle:")
		b, ok := c.Bundle(id)
		if !ok {
			return nil, "", fmt.Errorf("unknown bundle %q (see: homelab bundles)", id)
		}
		return bundleApps(c, b), "", nil
	case strings.HasPrefix(tok, "cat:") || strings.HasPrefix(tok, "category:"):
		id := tok[strings.Index(tok, ":")+1:]
		var apps []*catalog.App
		for _, a := range c.Apps {
			if a.Category() == id && !a.Internal() {
				apps = append(apps, a)
			}
		}
		if len(apps) == 0 {
			return nil, "", fmt.Errorf("unknown or empty category %q (see: homelab apps)", id)
		}
		return apps, "", nil
	case strings.HasPrefix(tok, "stack:"):
		id := strings.TrimPrefix(tok, "stack:")
		var apps []*catalog.App
		for _, a := range c.Apps {
			if a.Stack() == id && !a.Internal() {
				apps = append(apps, a)
			}
		}
		if len(apps) == 0 {
			return nil, "", fmt.Errorf("unknown stack %q (see: homelab apps --json)", id)
		}
		return apps, "", nil
	case strings.ContainsAny(tok, "*?["):
		apps, err := glob(c, tok)
		if err != nil {
			return nil, "", err
		}
		if len(apps) == 0 {
			return nil, "", fmt.Errorf("%q matched no apps", raw)
		}
		ids := make([]string, len(apps))
		for i, a := range apps {
			ids[i] = a.ID
		}
		return apps, fmt.Sprintf("%s matched %s", raw, strings.Join(ids, ", ")), nil
	}
	a, ok := c.Get(tok)
	if !ok {
		return nil, "", fmt.Errorf("unknown app %q%s", raw, suggest(c, tok))
	}
	note := ""
	if a.ID != tok {
		note = fmt.Sprintf("%s is provided by %s (%s)", raw, a.ID, a.Name())
	}
	return []*catalog.App{a}, note, nil
}

func bundleApps(c *catalog.Catalog, b compose.Bundle) []*catalog.App {
	var apps []*catalog.App
	for _, id := range b.Apps {
		if a, ok := c.Get(id); ok {
			apps = append(apps, a)
		}
	}
	return apps
}

// glob matches visible app ids and aliases.
func glob(c *catalog.Catalog, pattern string) ([]*catalog.App, error) {
	pat := pattern
	if _, err := path.Match(pat, ""); err != nil {
		return nil, fmt.Errorf("bad pattern %q: %w", pattern, err)
	}
	var out []*catalog.App
	for _, a := range c.Apps {
		if a.Internal() {
			continue
		}
		names := append([]string{a.ID}, a.Meta.Aliases...)
		for _, n := range names {
			if ok, _ := path.Match(pat, strings.ToLower(n)); ok {
				out = append(out, a)
				break
			}
		}
	}
	return out, nil
}

// splitTokens accepts "a,b c" style input.
func splitTokens(in []string) []string {
	var out []string
	for _, t := range in {
		for _, f := range strings.FieldsFunc(t, func(r rune) bool { return r == ',' || r == ' ' }) {
			if f != "" {
				out = append(out, f)
			}
		}
	}
	return out
}

// order sorts so dependencies come first, otherwise keeping compose order.
func order(c *catalog.Catalog, set map[string]bool) []*catalog.App {
	var out []*catalog.App
	done := map[string]bool{}
	var visit func(a *catalog.App)
	visit = func(a *catalog.App) {
		if done[a.ID] {
			return
		}
		done[a.ID] = true
		for _, dep := range a.DependsOn {
			if d, ok := c.Get(dep); ok && set[d.ID] {
				visit(d)
			}
		}
		out = append(out, a)
	}
	for _, a := range c.Apps {
		if set[a.ID] {
			visit(a)
		}
	}
	return out
}

func suggest(c *catalog.Catalog, tok string) string {
	type cand struct {
		id   string
		dist int
	}
	var cands []cand
	for _, a := range c.Apps {
		if a.Internal() {
			continue
		}
		d := levenshtein(tok, a.ID)
		if strings.Contains(a.ID, tok) || strings.Contains(tok, a.ID) {
			d = 0
		}
		if d <= 3 {
			cands = append(cands, cand{a.ID, d})
		}
	}
	if len(cands) == 0 {
		return " (see: homelab apps)"
	}
	sort.Slice(cands, func(i, j int) bool {
		return cands[i].dist < cands[j].dist || cands[i].dist == cands[j].dist && cands[i].id < cands[j].id
	})
	var names []string
	for i := 0; i < len(cands) && i < 3; i++ {
		names = append(names, cands[i].id)
	}
	return "; did you mean " + strings.Join(names, ", ") + "?"
}

func levenshtein(a, b string) int {
	prev := make([]int, len(b)+1)
	for j := range prev {
		prev[j] = j
	}
	for i := 1; i <= len(a); i++ {
		cur := make([]int, len(b)+1)
		cur[0] = i
		for j := 1; j <= len(b); j++ {
			cost := 1
			if a[i-1] == b[j-1] {
				cost = 0
			}
			cur[j] = min(prev[j]+1, cur[j-1]+1, prev[j-1]+cost)
		}
		prev = cur
	}
	return prev[len(b)]
}
