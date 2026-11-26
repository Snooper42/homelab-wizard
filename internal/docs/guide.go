package docs

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
)

// Guide is an app's note (services/<category>/<App>.md) read for its page
// before it's installed: what it's for, how it's set up and used, what it
// works with, and where to read more. Text keeps `code` and **bold**;
// links are their words only.
type Guide struct {
	Purpose  []string    `json:"purpose,omitempty"`
	Setup    []string    `json:"setup,omitempty"`
	Everyday []string    `json:"everyday,omitempty"`
	Ideas    []string    `json:"ideas,omitempty"`
	Connects []GuideLink `json:"connects,omitempty"`
	Learn    []GuideLink `json:"learn,omitempty"`
	// Memory is about what it uses, in MB (x-homelab memory); 0 unknown.
	Memory int `json:"memory,omitempty"`
	// Updates is how it takes new versions, from the note's facts.
	Updates string `json:"updates,omitempty"`
}

// GuideLink is a line naming another app (ID) or a web page (URL).
type GuideLink struct {
	Label string `json:"label"`
	Text  string `json:"text,omitempty"`
	ID    string `json:"id,omitempty"`
	URL   string `json:"url,omitempty"`
}

var (
	guideLink = regexp.MustCompile(`\[([^\]]+)\]\(<?([^)>]*)>?\)`)
	bareURL   = regexp.MustCompile(`https?://[^\s)>]+`)
	stepNum   = regexp.MustCompile(`^\d+\.\s+`)
	// A decision record named in passing, "(ADR-0019)": the repository's, not the reader's.
	adrRef = regexp.MustCompile(`\s*\(ADR-\d+\)`)
)

// ReadGuide reads the note of the app id under root. An app with no note
// has an empty guide.
func ReadGuide(root string, c *catalog.Catalog, id string) (Guide, error) {
	a, ok := c.Get(id)
	if !ok {
		return Guide{}, nil
	}
	g := Guide{Memory: a.Meta.Memory}
	data, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(c.DocPath(a))))
	if os.IsNotExist(err) {
		return g, nil
	}
	if err != nil {
		return g, err
	}
	byName := map[string]string{}
	for _, o := range c.Apps {
		byName[strings.ToLower(o.Name())] = o.ID
	}
	sections := splitSections(string(data))
	// Its list, then its prose, as the note gives either or both.
	g.Purpose = append(items(sections["Purpose"]), paragraphs(sections["Purpose"])...)
	g.Setup = items(sections["Setup"])
	g.Everyday = items(sections["Everyday use"])
	g.Ideas = items(sections["Tinkering ideas"])
	for _, it := range rawItems(sections["Connects to"]) {
		l := GuideLink{Text: plain(it)}
		if m := guideLink.FindStringSubmatch(it); m != nil {
			l.Label = m[1]
			l.ID = byName[strings.ToLower(m[1])]
		}
		if l.ID == "" {
			continue
		}
		// "[Duplicati](…), the main backup: …" reads "the main backup: …";
		// "[Duplicati](…)'s job …" keeps its name.
		if rest, ok := strings.CutPrefix(l.Text, l.Label); ok && (strings.HasPrefix(rest, ",") || strings.HasPrefix(rest, ":") || strings.HasPrefix(rest, " —") || strings.HasPrefix(rest, " -")) {
			l.Text = strings.TrimLeft(rest, " ,:—-")
		}
		g.Connects = append(g.Connects, l)
	}
	for _, it := range rawItems(sections["Learn more"]) {
		var l GuideLink
		if m := guideLink.FindStringSubmatch(it); m != nil && strings.HasPrefix(m[2], "http") {
			l = GuideLink{Label: m[1], URL: m[2]}
		} else if u := bareURL.FindString(it); u != "" {
			label := strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(it[:strings.Index(it, u)]), ":"))
			if label == "" {
				label = strings.TrimPrefix(strings.TrimPrefix(u, "https://"), "http://")
			}
			l = GuideLink{Label: label, URL: strings.TrimRight(u, ".,")}
		} else {
			continue
		}
		g.Learn = append(g.Learn, l)
	}
	for _, line := range strings.Split(sections[""], "\n") {
		if v, ok := strings.CutPrefix(line, "| Updates | "); ok {
			g.Updates = plain(strings.TrimSuffix(strings.TrimSpace(v), "|"))
		}
	}
	return g, nil
}

// splitSections is the note's text under each "## " heading; "" is what
// comes before the first.
func splitSections(s string) map[string]string {
	out := map[string]string{}
	cur := ""
	var b strings.Builder
	fence := false
	for _, line := range strings.Split(s, "\n") {
		if strings.HasPrefix(line, "```") {
			fence = !fence
		}
		if !fence && strings.HasPrefix(line, "## ") {
			out[cur] = b.String()
			b.Reset()
			cur = strings.TrimSpace(line[3:])
			continue
		}
		b.WriteString(line)
		b.WriteByte('\n')
	}
	out[cur] = b.String()
	return out
}

// paragraphs is a section's prose, a paragraph each, lists and code left out.
func paragraphs(s string) []string {
	var out []string
	for _, p := range strings.Split(s, "\n\n") {
		p = strings.TrimSpace(p)
		if p == "" || strings.HasPrefix(p, "```") || strings.HasPrefix(p, "|") || strings.HasPrefix(p, "- ") || stepNum.MatchString(p) {
			continue
		}
		out = append(out, plain(strings.Join(strings.Fields(p), " ")))
	}
	return out
}

// rawItems is a section's top-level list items ("- " or "1. "), each on
// one line, as written.
func rawItems(s string) []string {
	var out []string
	fence := false
	for _, line := range strings.Split(s, "\n") {
		if strings.HasPrefix(line, "```") {
			fence = !fence
			continue
		}
		if fence {
			continue
		}
		switch {
		case strings.HasPrefix(line, "- "):
			out = append(out, strings.TrimSpace(line[2:]))
		case stepNum.MatchString(line):
			out = append(out, strings.TrimSpace(stepNum.ReplaceAllString(line, "")))
		case len(out) > 0 && strings.HasPrefix(line, "  ") && strings.TrimSpace(line) != "" && !strings.HasPrefix(strings.TrimSpace(line), "- "):
			out[len(out)-1] += " " + strings.TrimSpace(line)
		}
	}
	return out
}

func items(s string) []string {
	raw := rawItems(s)
	out := make([]string, 0, len(raw))
	for _, it := range raw {
		out = append(out, plain(it))
	}
	return out
}

// plain is markdown text with links as their words.
func plain(s string) string {
	return strings.TrimSpace(adrRef.ReplaceAllString(guideLink.ReplaceAllString(s, "$1"), ""))
}
