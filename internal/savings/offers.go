package savings

import (
	"path/filepath"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
)

// Offer is one row of docs/Savings.md for Status › Subscriptions: what the apps replace, at its price.
type Offer struct {
	Apps      []string `json:"apps"` // the apps' catalog IDs, every one needed
	Replaces  string   `json:"replaces"`
	Kind      string   `json:"kind"`    // Direct, Equivalent or Library
	Monthly   float64  `json:"monthly"` // 0 when the table has none
	Annual    float64  `json:"annual"`
	Condition string   `json:"condition"`
	Counted   bool     `json:"counted"` // false when another row counts the same service
}

// Offers is every row of docs/Savings.md with its apps' catalog IDs, in the table's order. A link to a note no app
// has (a renamed app) is left out of Apps.
func Offers(c *catalog.Catalog) ([]Offer, error) {
	rows, err := Load(c.Root)
	if err != nil {
		return nil, err
	}
	ids := map[string]string{}
	for _, a := range c.Apps {
		ids[filepath.ToSlash(c.DocPath(a))] = a.ID
	}
	out := make([]Offer, 0, len(rows))
	for _, r := range rows {
		o := Offer{Apps: []string{}, Replaces: r.Replaces, Kind: r.Kind, Monthly: r.Monthly, Annual: r.Annual, Condition: r.Condition, Counted: r.Counted}
		for _, d := range r.Docs {
			if id, ok := ids[d]; ok {
				o.Apps = append(o.Apps, id)
			}
		}
		out = append(out, o)
	}
	return out, nil
}
