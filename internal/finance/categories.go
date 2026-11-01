package finance

import (
	"fmt"
	"strings"
)

// Category is a name transactions are sorted into: one of its own, or
// under a group (Groceries under Food), with the icon it shows by
// (Mark.tsx's glyphs: "food", "home", "car"…; none, the group's or a
// letter). A transaction names its category; renaming one renames it in
// the ledger too (the screen does both).
type Category struct {
	Name   string `json:"name"`
	Parent string `json:"parent,omitempty"`
	Icon   string `json:"icon,omitempty"`
	// Income is money in: a paycheck, interest, a refund.
	Income bool `json:"income,omitempty"`
}

// DefaultCategories are the categories a household starts with: the
// payment kinds as groups, with the everyday ones under them, and the
// subscription types under Subscriptions.
func DefaultCategories() []Category {
	return []Category{
		{Name: "Income", Icon: "savings", Income: true},
		{Name: "Paycheck", Parent: "Income", Income: true},
		{Name: "Interest", Parent: "Income", Income: true},
		{Name: "Refunds", Parent: "Income", Income: true},
		{Name: "Home", Icon: "home"},
		{Name: "Mortgage or rent", Parent: "Home"},
		{Name: "Repairs", Parent: "Home"},
		{Name: "Utilities", Icon: "utilities"},
		{Name: "Electric", Parent: "Utilities", Icon: "utilities"},
		{Name: "Water", Parent: "Utilities", Icon: "water"},
		{Name: "Internet", Parent: "Utilities", Icon: "internet"},
		{Name: "Phone", Parent: "Utilities", Icon: "phone"},
		{Name: "Food", Icon: "food"},
		{Name: "Groceries", Parent: "Food", Icon: "spending"},
		{Name: "Eating out", Parent: "Food", Icon: "food"},
		{Name: "Car", Icon: "car"},
		{Name: "Gas", Parent: "Car", Icon: "heat"},
		{Name: "Car insurance", Parent: "Car", Icon: "insurance"},
		{Name: "Subscriptions", Icon: "subscriptions"},
		{Name: "Streaming and music", Parent: "Subscriptions", Icon: "streaming"},
		{Name: "Software and apps", Parent: "Subscriptions", Icon: "software"},
		{Name: "Cloud and homelab", Parent: "Subscriptions", Icon: "cloud"},
		{Name: "Health", Icon: "health"},
		{Name: "Fitness", Parent: "Health", Icon: "fitness"},
		{Name: "Shopping", Icon: "spending"},
		{Name: "Kids and school", Icon: "school"},
		{Name: "Gifts and giving"},
		{Name: "Travel"},
		{Name: "Fees and interest"},
		{Name: "Other", Icon: "other"},
	}
}

// cleanCategories trims each, keeps each name once (whatever its case),
// and checks a group is a category with no group of its own: two levels,
// no more.
func cleanCategories(in []Category) ([]Category, error) {
	if len(in) == 0 {
		return nil, nil
	}
	out := make([]Category, 0, len(in))
	seen := map[string]bool{}
	for _, c := range in {
		c.Name, c.Parent, c.Icon = strings.TrimSpace(c.Name), strings.TrimSpace(c.Parent), strings.TrimSpace(c.Icon)
		if c.Name == "" {
			return nil, fmt.Errorf("a category has no name")
		}
		if seen[strings.ToLower(c.Name)] {
			return nil, fmt.Errorf("two categories are called %q", c.Name)
		}
		seen[strings.ToLower(c.Name)] = true
		out = append(out, c)
	}
	top := map[string]bool{}
	for _, c := range out {
		if c.Parent == "" {
			top[strings.ToLower(c.Name)] = true
		}
	}
	for _, c := range out {
		if c.Parent == "" {
			continue
		}
		if strings.EqualFold(c.Parent, c.Name) {
			return nil, fmt.Errorf("%s: a category is not its own group", c.Name)
		}
		if !top[strings.ToLower(c.Parent)] {
			return nil, fmt.Errorf("%s: its group %q is not a category of its own, or is under another", c.Name, c.Parent)
		}
	}
	return out, nil
}
