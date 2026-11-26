// Package savings reads docs/Savings.md, the one place subscription prices
// live, and totals what the running apps replace.
package savings

import (
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
)

// Row is one subscription an app (or a set of apps together) replaces.
type Row struct {
	Docs     []string // the apps' notes, relative to the repository root
	Replaces string
	Annual   float64 // the annual-plan price in dollars
	// The columns below are optional: a table without them leaves them empty (lane D, D1).
	Monthly   float64 // the monthly price in dollars, 0 when the table has none
	Kind      string  // Direct, Equivalent or Library
	Condition string  // when the saving is real, links as plain text
	// Counted is false for a row whose paid service another row counts already (Dropbox Plus for both File Browser
	// and Nextcloud): the counted rows add up to the Everything total. Of a service's rows, the dearest is counted,
	// and of equals the last, the one whose note says "counted once, here".
	Counted bool
}

var (
	linkRe = regexp.MustCompile(`\]\(<\.\./([^>]+)>\)`)
	// Any Markdown link, for a condition shown as plain text.
	anyLinkRe = regexp.MustCompile(`\[([^\]]*)\]\((?:<[^>]*>|[^)]*)\)`)
)

// price reads "$1,234.56", "**$9.99**" or "$3.33 †" as dollars.
func price(cell string) (float64, error) {
	return strconv.ParseFloat(strings.TrimSpace(strings.NewReplacer("$", "", ",", "", "*", "", "†", "").Replace(cell)), 64)
}

// Load reads the per-app tables (those with App and Annual plan columns).
func Load(root string) ([]Row, error) {
	data, err := os.ReadFile(filepath.Join(root, "docs", "Savings.md"))
	if err != nil {
		return nil, err
	}
	var rows []Row
	col, inTable := -1, false
	cols := map[string]int{}
	for _, line := range strings.Split(string(data), "\n") {
		if !strings.HasPrefix(line, "|") {
			inTable = false
			continue
		}
		cells := strings.Split(strings.Trim(strings.TrimSpace(line), "|"), "|")
		for i := range cells {
			cells[i] = strings.TrimSpace(cells[i])
		}
		if !inTable { // the header row
			inTable, col = true, -1
			cols = map[string]int{}
			for i, c := range cells {
				cols[c] = i
				if c == "Annual plan" && cells[0] == "App" {
					col = i
				}
			}
			continue
		}
		links := linkRe.FindAllStringSubmatch(cells[0], -1)
		if col < 0 || len(cells) <= col || len(links) == 0 {
			continue // other tables, the separator, subtotals
		}
		amount, err := price(cells[col])
		if err != nil {
			continue
		}
		r := Row{Replaces: cells[2], Annual: amount}
		cell := func(name string) string {
			if i, ok := cols[name]; ok && i < len(cells) {
				return cells[i]
			}
			return ""
		}
		r.Monthly, _ = price(cell("Monthly"))
		r.Kind = cell("Kind")
		r.Condition = anyLinkRe.ReplaceAllString(cell("Condition"), "$1")
		for _, l := range links {
			r.Docs = append(r.Docs, filepath.ToSlash(l[1]))
		}
		rows = append(rows, r)
	}
	counted := map[string]int{}
	for i, r := range rows {
		if j, ok := counted[r.Replaces]; !ok || r.Annual >= rows[j].Annual {
			counted[r.Replaces] = i
		}
	}
	for _, i := range counted {
		rows[i].Counted = true
	}
	return rows, nil
}

// Annual is what the running apps replace a year: every row whose apps all
// run, each service once (two budgets that both replace YNAB save it
// once). 0 when docs/Savings.md is missing.
func Annual(c *catalog.Catalog, running func(id string) bool) float64 {
	rows, err := Load(c.Root)
	if err != nil {
		return 0
	}
	up := map[string]bool{}
	for _, a := range c.Apps {
		if running(a.ID) {
			up[filepath.ToSlash(c.DocPath(a))] = true
		}
	}
	saved := map[string]float64{}
	for _, r := range rows {
		all := true
		for _, d := range r.Docs {
			all = all && up[d]
		}
		if all {
			saved[r.Replaces] = max(saved[r.Replaces], r.Annual)
		}
	}
	total := 0.0
	for _, v := range saved {
		total += v
	}
	return total
}

// Dollars formats an amount as whole dollars: 3291.58 -> "$3,292".
func Dollars(v float64) string {
	s := strconv.FormatInt(int64(v+0.5), 10)
	for i := len(s) - 3; i > 0; i -= 3 {
		s = s[:i] + "," + s[i:]
	}
	return "$" + s
}
