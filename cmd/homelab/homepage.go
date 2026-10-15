package main

import (
	"context"
	"errors"
	"path/filepath"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/homepage"
	"github.com/Snooper42/homelab-wizard/internal/people"
)

// homepageCmd writes Homepage's services.yaml from the running apps.
func (h *homelab) homepageCmd(ctx context.Context, args []string) error {
	if _, err := parseFlags(newFlags("homepage"), args); err != nil {
		return err
	}
	n, changed, err := h.refreshHomepage(ctx)
	switch {
	case errors.Is(err, homepage.ErrHandEdited):
		h.ui.Info("%v; delete it (or put the marker line back) to have homelab write it", err)
		return nil
	case err != nil:
		return err
	case changed:
		h.ui.OK("Homepage lists %d app(s) (%s)", n, h.rel(h.homepagePath()))
	default:
		h.ui.OK("Homepage already lists the %d running app(s)", n)
	}
	return nil
}

func (h *homelab) homepagePath() string {
	return filepath.Join(h.root, "data", "appdata", "homepage", "services.yaml")
}

func (h *homelab) homepageSettingsPath() string {
	return filepath.Join(h.root, "data", "appdata", "homepage", "settings.yaml")
}

// tabNames is each active person's tab on Homepage, by username: their
// first name, or their whole name when two share one.
func tabNames(list []people.Person) map[string]string {
	out := map[string]string{}
	seen := map[string]bool{}
	for _, p := range list {
		first, _ := people.Split(p.Name)
		if !p.Active() || first == "" {
			continue
		}
		t := homepage.Tab{Name: first}
		if seen[t.Slug()] {
			t.Name = p.Name
		}
		seen[t.Slug()] = true
		out[p.Username] = t.Name
	}
	return out
}

// homepageTabs are the household's tabs: each person's apps among entries.
func (h *homelab) homepageTabs(entries []homepage.Entry, ids []string) []homepage.Tab {
	list, _ := people.Load(people.Path(h.root))
	names := tabNames(list)
	var tabs []homepage.Tab
	for _, p := range list {
		name, ok := names[p.Username]
		if !ok {
			continue
		}
		t := homepage.Tab{Name: name}
		for i, e := range entries {
			if a, ok := h.catalog.Get(ids[i]); ok && householdApp(a) && p.Uses(a.ID) {
				t.Entries = append(t.Entries, e)
			}
		}
		if len(t.Entries) > 0 {
			tabs = append(tabs, t)
		}
	}
	return tabs
}

func (h *homelab) refreshHomepage(ctx context.Context) (n int, changed bool, err error) {
	client, err := h.docker(ctx)
	if err != nil {
		return 0, false, err
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return 0, false, err
	}
	st := api.StatusOf(ctx, h.catalog, containers, h.envMap(), false)
	installed := false
	var entries []homepage.Entry
	var ids []string // entries[i] is the app ids[i]
	var categories []string
	byID := map[string]api.AppStatus{}
	for _, a := range st.Apps {
		byID[a.ID] = a
		installed = installed || a.ID == "homepage" && a.State != "missing" && a.State != "not running"
	}
	if !installed {
		return 0, false, nil
	}
	for _, cat := range h.catalog.Grouped(false) {
		for _, a := range cat.Apps {
			s, ok := byID[a.ID]
			if !ok || s.State != "running" || s.Address == "" {
				continue
			}
			if len(categories) == 0 || categories[len(categories)-1] != cat.Label {
				categories = append(categories, cat.Label)
			}
			entries = append(entries, homepage.Entry{Category: cat.Label, Name: a.Name(), Description: a.Meta.Description, URL: "https://" + s.Address, Icon: homepage.Icon(a.ID)})
			ids = append(ids, a.ID)
		}
	}
	tabs := h.homepageTabs(entries, ids)
	changed, err = homepage.Write(h.homepagePath(), homepage.Render(entries, tabs...))
	if err != nil {
		return len(entries), changed, err
	}
	// The tabs need Homepage's layout; a settings.yaml of your own stays.
	if settings := h.homepageSettingsPath(); len(tabs) > 0 || homepage.Ours(settings) {
		c, err := homepage.Write(settings, homepage.Settings("Homelab", categories, tabs))
		if err != nil && !errors.Is(err, homepage.ErrHandEdited) {
			return len(entries), changed, err
		}
		changed = changed || c
	}
	return len(entries), changed, nil
}

// afterChange refreshes Homepage after apps start or go, quietly: a
// failure here never fails the command that changed the apps.
func (h *homelab) afterChange(ctx context.Context) {
	n, changed, err := h.refreshHomepage(ctx)
	if err == nil && changed && !h.ui.JSON {
		h.ui.OK("Homepage now lists %d app(s)", n)
	}
}
