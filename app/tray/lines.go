package tray

import (
	"fmt"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
)

// The menu's lines, read from a Status: what is said first, at a glance,
// then only what needs a look, then the apps to open.

// Summary is the menu's first line: how many apps run.
func Summary(st api.Status) string {
	running := 0
	for _, a := range st.Apps {
		if a.State == "running" {
			running++
		}
	}
	switch total := len(st.Apps); {
	case total == 0:
		return "No apps yet"
	case running == total:
		return fmt.Sprintf("%d %s running", total, plural(total, "app", "apps"))
	default:
		return fmt.Sprintf("%d of %d apps running", running, total)
	}
}

// SummaryDot is the dot beside the first line.
func SummaryDot(st api.Status) Dot {
	switch {
	case NeedsALook(st) > 0:
		return DotLook
	case len(st.Apps) == 0:
		return DotOff
	}
	return DotOK
}

// StatusLine is the second line: how many need a look, and when the
// homelab was last read.
func StatusLine(needs int, checked, now time.Time) string {
	what := "All healthy"
	switch {
	case needs == 1:
		what = "One needs a look"
	case needs > 1:
		what = fmt.Sprintf("%d need a look", needs)
	}
	return what + " · checked " + ago(now.Sub(checked))
}

// ago says how long ago, in the words of a menu: "just now", "a minute
// ago", "5 minutes ago", "2 hours ago".
func ago(d time.Duration) string {
	switch {
	case d < time.Minute:
		return "just now"
	case d < 2*time.Minute:
		return "a minute ago"
	case d < time.Hour:
		return fmt.Sprintf("%d minutes ago", int(d.Minutes()))
	case d < 2*time.Hour:
		return "an hour ago"
	}
	return fmt.Sprintf("%d hours ago", int(d.Hours()))
}

// Looks are the lines for what needs a look, one per app, at most n: the
// last says how many more when there are.
func Looks(st api.Status, n int) []string {
	var out []string
	for _, a := range st.Apps {
		switch {
		case a.Health == "restarting":
			out = append(out, a.Name+" keeps restarting")
		case a.Health == "unhealthy":
			out = append(out, a.Name+" is unwell")
		case a.NotAnswering != "":
			out = append(out, a.Name+" does not answer")
		case a.State == "missing":
			// One of the homelab's own (updates, backups, alerts) that
			// should run and has no container.
			out = append(out, a.Name+" is not running")
		}
	}
	if len(out) > n && n > 0 {
		more := len(out) - n + 1
		out = append(out[:n-1], fmt.Sprintf("and %d more %s a look", more, plural(more, "needs", "need")))
	}
	return out
}

// Entry is a line of Open an app: a category's name, or an app with the
// dot of its state and the address it opens (none while it is stopped).
type Entry struct {
	Title  string
	URL    string
	Header bool
	Dot    Dot
}

// Entries are the installed apps by category, in the catalog's order of
// categories, at most n lines with the categories' names counted.
func Entries(st api.Status, c *catalog.Catalog, n int) []Entry {
	byCat := map[string][]Entry{}
	for _, a := range st.Apps {
		if a.State == "missing" {
			continue
		}
		cat := "other"
		if c != nil {
			if app, ok := c.Get(a.ID); ok {
				cat = app.Category()
			}
		}
		e := Entry{Title: a.Name, Dot: DotOK}
		switch {
		case a.State != "running":
			e.Title, e.Dot = a.Name+" · stopped", DotOff
		case a.Health == "restarting":
			e.Title, e.Dot = a.Name+" · restarting", DotLook
		case a.Health == "unhealthy":
			e.Title, e.Dot = a.Name+" · unwell", DotLook
		case a.NotAnswering != "":
			e.Title, e.Dot = a.Name+" · not answering", DotLook
		}
		if a.State == "running" {
			switch {
			case a.Address != "":
				e.URL = "https://" + a.Address
			case a.URL != "":
				e.URL = a.URL
			}
		}
		byCat[cat] = append(byCat[cat], e)
	}
	var order []string
	if c != nil {
		for _, cat := range c.Categories {
			order = append(order, cat.ID)
		}
	}
	order = append(order, "other")
	var out []Entry
	seen := map[string]bool{}
	for _, cat := range order {
		apps := byCat[cat]
		if len(apps) == 0 || seen[cat] {
			continue
		}
		seen[cat] = true
		label := "Other"
		if c != nil && cat != "other" {
			label = c.CategoryLabel(cat)
		}
		if len(out)+2 > n {
			break
		}
		out = append(out, Entry{Title: label, Header: true})
		for _, e := range apps {
			if len(out) == n {
				break
			}
			out = append(out, e)
		}
	}
	return out
}

// BackupDot is the last backup's mark: a tick while it is on time, the
// orange dot once it is late.
func BackupDot(last, now time.Time) Dot {
	if now.Sub(last) > backup.StaleAfter {
		return DotLook
	}
	return DotDone
}

// BackupTitle is the menu line for the last backup: when it ran, or, once
// it is older than a nightly run should be, that it is late. h24 writes the
// time as Linux does (03:12), else as on a Mac and Windows (3:12).
func BackupTitle(last, now time.Time, h24 bool) string {
	d := now.Sub(last)
	if d > backup.StaleAfter {
		when := fmt.Sprintf("%d hours ago", int(d.Hours()))
		if d >= 48*time.Hour {
			when = fmt.Sprintf("%d days ago", int(d.Hours()/24))
		}
		return "Last backup " + when + " · check Backups"
	}
	clock := last.Format("3:04")
	if h24 {
		clock = last.Format("15:04")
	}
	y, m, day := now.Date()
	today := time.Date(y, m, day, 0, 0, 0, 0, now.Location())
	switch {
	case last.Before(today):
		return "Backed up yesterday at " + clock
	case last.Hour() < 12:
		return "Backed up at " + clock + " this morning"
	case last.Hour() < 18:
		return "Backed up at " + clock + " this afternoon"
	}
	return "Backed up at " + clock + " this evening"
}

func plural(n int, one, many string) string {
	if n == 1 {
		return one
	}
	return many
}
