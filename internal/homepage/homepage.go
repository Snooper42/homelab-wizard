// Package homepage writes Homepage's services.yaml from the catalog: every
// running app with an address, grouped by category, so the household's
// start page lists exactly what runs. A services.yaml without the marker
// line (made or edited by hand) is never touched.
package homepage

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Marker is the first line of a services.yaml this package wrote.
const Marker = "# Written by homelab from the running apps. Delete this line to keep your own edits; homelab then leaves the file alone."

// Entry is one app on the page.
type Entry struct {
	Category    string // the group heading, e.g. Media
	Name        string
	Description string
	URL         string
	Icon        string // a dashboard-icons name, e.g. immich.png; "" for none
}

// Tab is one person's own tab: only the apps they use, at #<slug>.
type Tab struct {
	Name    string // their first name, the tab's label
	Entries []Entry
}

// Group is the services.yaml group a tab shows.
func (t Tab) Group() string { return t.Name + "'s apps" }

// Slug is the URL hash that opens the tab (Homepage's own rule:
// lower case, spaces as dashes).
func (t Tab) Slug() string {
	return strings.ToLower(strings.ReplaceAll(strings.TrimSpace(t.Name), " ", "-"))
}

// Everything is the tab with every app, when there are people's tabs.
const Everything = "Everything"

// Render is services.yaml for the entries, grouped by category in the
// order the categories first appear, then a group per person.
func Render(entries []Entry, tabs ...Tab) []byte {
	var order []string
	groups := map[string][]Entry{}
	for _, e := range entries {
		if _, ok := groups[e.Category]; !ok {
			order = append(order, e.Category)
		}
		groups[e.Category] = append(groups[e.Category], e)
	}
	for _, t := range tabs {
		order = append(order, t.Group())
		groups[t.Group()] = t.Entries
	}
	var b bytes.Buffer
	b.WriteString(Marker + "\n")
	for _, cat := range order {
		b.WriteString("- " + quote(cat) + ":\n")
		if len(groups[cat]) == 0 {
			b.WriteString("    []\n")
		}
		for _, e := range groups[cat] {
			b.WriteString("    - " + quote(e.Name) + ":\n")
			if e.Icon != "" {
				b.WriteString("        icon: " + quote(e.Icon) + "\n")
			}
			b.WriteString("        href: " + quote(e.URL) + "\n")
			if e.Description != "" {
				b.WriteString("        description: " + quote(e.Description) + "\n")
			}
		}
	}
	return b.Bytes()
}

// Settings is settings.yaml putting the categories on an Everything tab
// and each person's group on a tab of their own.
func Settings(title string, categories []string, tabs []Tab) []byte {
	var b bytes.Buffer
	b.WriteString(Marker + "\n")
	b.WriteString("title: " + quote(title) + "\n")
	if len(tabs) == 0 {
		return b.Bytes()
	}
	b.WriteString("layout:\n")
	for _, t := range tabs {
		b.WriteString("  " + quote(t.Group()) + ":\n    tab: " + quote(t.Name) + "\n    style: row\n    columns: 4\n")
	}
	for _, c := range categories {
		b.WriteString("  " + quote(c) + ":\n    tab: " + quote(Everything) + "\n")
	}
	return b.Bytes()
}

// Ours reports whether the file at path was written by this package.
func Ours(path string) bool {
	data, err := os.ReadFile(path)
	return err == nil && bytes.HasPrefix(data, []byte(Marker))
}

// ErrHandEdited means services.yaml exists without the marker.
var ErrHandEdited = errors.New("edited by hand (no marker line), so it is left alone")

// Write saves data at path unless the file there was made by hand.
// changed is false when the file already held exactly data.
func Write(path string, data []byte) (changed bool, err error) {
	old, err := os.ReadFile(path)
	switch {
	case err == nil && !bytes.HasPrefix(old, []byte(Marker)) && len(bytes.TrimSpace(old)) > 0 && !isStarter(old):
		return false, fmt.Errorf("%s: %w", filepath.Base(path), ErrHandEdited)
	case err == nil && bytes.Equal(old, data):
		return false, nil
	case err != nil && !os.IsNotExist(err):
		return false, err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return false, err
	}
	return true, os.WriteFile(path, data, 0o644)
}

// isStarter reports Homepage's own first-run services.yaml (its example
// groups) or settings.yaml (placeholder weather keys), which are safe to
// replace.
func isStarter(data []byte) bool {
	s := string(data)
	return strings.Contains(s, "- My First Group:") && strings.Contains(s, "- My Second Group:") ||
		strings.Contains(s, "openweathermapapikey") && !strings.Contains(s, "layout:")
}

// icons are dashboard-icons names where they differ from the app's ID.
var icons = map[string]string{
	"immich-server": "immich",
	"paperless":     "paperless-ngx",
	"seerr":         "jellyseerr",
}

// noIcon are apps dashboard-icons has no picture for.
var noIcon = map[string]bool{"moneymatter-frontend": true, "docker-socket-proxy": true, "cloudflared": true, "psitransfer": true}

// Icon is the dashboard-icons file for an app.
func Icon(id string) string {
	if noIcon[id] {
		return ""
	}
	if name, ok := icons[id]; ok {
		return name + ".png"
	}
	return id + ".png"
}

func quote(s string) string {
	b, _ := json.Marshal(s) // a JSON string is a valid YAML double-quoted scalar
	return string(b)
}
