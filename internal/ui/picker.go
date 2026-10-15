package ui

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
)

// PickerItem is one numbered app in the picker.
type PickerItem struct {
	App    *catalog.App
	Status string // e.g. "running", shown next to the name
}

// ShowPicker prints the numbered, grouped catalog and returns the numbering.
func (u *UI) ShowPicker(groups []catalog.Group, status func(*catalog.App) string) []PickerItem {
	var items []PickerItem
	for _, g := range groups {
		u.Printf("\n  %s\n", u.Bold(g.Label))
		for _, a := range g.Apps {
			items = append(items, PickerItem{App: a, Status: status(a)})
			n := len(items)
			line := fmt.Sprintf("  %3d  %-24s %s", n, a.ID, u.Dim(a.Meta.Description))
			if s := status(a); s != "" {
				line += "  " + u.Cyan("["+s+"]")
			}
			u.Println(line)
		}
	}
	return items
}

// ParsePick turns picker input into selector tokens. Numbers and ranges
// ("3", "5-8") map to app ids; anything else (ids, aliases, globs, @bundles,
// cat:...) passes through for the selector to resolve.
func ParsePick(input string, items []PickerItem) ([]string, error) {
	var tokens []string
	for _, f := range strings.FieldsFunc(input, func(r rune) bool { return r == ',' || r == ' ' }) {
		if lo, hi, ok := strings.Cut(f, "-"); ok && isNum(lo) && isNum(hi) {
			a, _ := strconv.Atoi(lo)
			b, _ := strconv.Atoi(hi)
			if a > b {
				a, b = b, a
			}
			for n := a; n <= b; n++ {
				id, err := itemID(n, items)
				if err != nil {
					return nil, err
				}
				tokens = append(tokens, id)
			}
			continue
		}
		if isNum(f) {
			n, _ := strconv.Atoi(f)
			id, err := itemID(n, items)
			if err != nil {
				return nil, err
			}
			tokens = append(tokens, id)
			continue
		}
		tokens = append(tokens, f)
	}
	return tokens, nil
}

func itemID(n int, items []PickerItem) (string, error) {
	if n < 1 || n > len(items) {
		return "", fmt.Errorf("%d is not in the list (1-%d)", n, len(items))
	}
	return items[n-1].App.ID, nil
}

func isNum(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}
