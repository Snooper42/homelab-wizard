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
}

var linkRe = regexp.MustCompile(`\]\(<\.\./([^>]+)>\)`)

// Load reads the per-app tables (those with App and Annual plan columns).
func Load(root string) ([]Row, error) {
	data, err := os.ReadFile(filepath.Join(root, "docs", "Savings.md"))
	if err != nil {
		return nil, err
	}
	var rows []Row
	col, inTable := -1, false
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
			for i, c := range cells {
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
		amount, err := strconv.ParseFloat(strings.NewReplacer("$", "", ",", "", "*", "").Replace(cells[col]), 64)
		if err != nil {
			continue
		}
		r := Row{Replaces: cells[2], Annual: amount}
		for _, l := range links {
			r.Docs = append(r.Docs, filepath.ToSlash(l[1]))
		}
		rows = append(rows, r)
	}
	return rows, nil
}

// Annual is what the running apps replace a year: every row whose apps all
// run. 0 when docs/Savings.md is missing.
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
	total := 0.0
	for _, r := range rows {
		all := true
		for _, d := range r.Docs {
			all = all && up[d]
		}
		if all {
			total += r.Annual
		}
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
