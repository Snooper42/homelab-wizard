package finance

import (
	"fmt"
	"math"
	"regexp"
	"strings"
	"time"
)

// The Collection (the owner, Nov 12: "a mini Collectr" for their Pokémon
// cards; the mockup a yes, Nov 13): each card the household keeps, in a
// collectible account whose balance is what they are worth now, so Net
// worth, its history and the account's own page count them as any
// account. A price is typed in, or (later) read on a click from a card
// price service, sending only the card's name and number.

// Collected is one card kept (Count of it, none: one).
type Collected struct {
	ID      string `json:"id"`
	Account string `json:"account"`
	Name    string `json:"name"`
	// Set and Number say which printing: "Set A", "4/102".
	Set    string `json:"set,omitempty"`
	Number string `json:"number,omitempty"`
	// Grade is its condition or grade, as the household says it: "Near mint", "Graded 9".
	Grade string `json:"grade,omitempty"`
	Count int    `json:"count,omitempty"`
	// Paid is what one cost, on PaidOn (YYYY-MM-DD).
	Paid   float64 `json:"paid,omitempty"`
	PaidOn string  `json:"paidOn,omitempty"`
	// Price is what one is worth now, set on PriceOn; Typed, by the
	// household (a graded slab the price service doesn't list), so a read
	// never changes it.
	Price   float64 `json:"price,omitempty"`
	PriceOn string  `json:"priceOn,omitempty"`
	Typed   bool    `json:"typed,omitempty"`
	// Ref is the price service's id for this printing, once found.
	Ref string `json:"ref,omitempty"`
	// Picture is its picture's file in data/finance-cards, saved on the
	// computer and shown from there: never fetched by a screen.
	Picture string `json:"picture,omitempty"`
}

// maxCollected is as many cards as a plan keeps; maxCollectedText as long
// as a name, a set, a number, a grade or a ref may be.
const (
	maxCollected     = 2000
	maxCollectedText = 120
	maxCollectedEach = 99999
)

// pictureName is a picture's file as the computer names it: its content's
// hash and kind, nothing that could reach outside its folder.
var pictureName = regexp.MustCompile(`^[0-9a-f]{32}\.(jpg|png|webp)$`)

// Worth is what c is worth now: its price, as many times as it is kept.
func Worth(c Collected) float64 { return c.Price * float64(max(1, c.Count)) }

// cleanCollection checks each card and gives it an ID of its own, and
// returns what each collectible account's cards come to and the latest day
// a price of them was set.
func cleanCollection(p *Plan, id func(have, name, prefix string) string) (map[string]float64, map[string]string, error) {
	if len(p.Collection) > maxCollected {
		return nil, nil, fmt.Errorf("%d cards: a plan keeps at most %d", len(p.Collection), maxCollected)
	}
	kind := map[string]string{}
	for _, a := range p.Accounts {
		kind[a.ID] = a.Kind
	}
	sum, latest := map[string]float64{}, map[string]string{}
	for i := range p.Collection {
		c := &p.Collection[i]
		c.Name = clip(strings.TrimSpace(c.Name), maxCollectedText)
		if c.Name == "" {
			return nil, nil, fmt.Errorf("a card has no name")
		}
		c.Set, c.Number, c.Grade, c.Ref = clip(strings.TrimSpace(c.Set), maxCollectedText), clip(strings.TrimSpace(c.Number), maxCollectedText), clip(strings.TrimSpace(c.Grade), maxCollectedText), clip(strings.TrimSpace(c.Ref), maxCollectedText)
		switch k, ok := kind[c.Account]; {
		case !ok:
			return nil, nil, fmt.Errorf("%s: its account %q isn't in the plan", c.Name, c.Account)
		case k != Collectible:
			return nil, nil, fmt.Errorf("%s: cards are kept in a collectible account", c.Name)
		}
		if c.Count < 0 || c.Count > maxCollectedEach {
			return nil, nil, fmt.Errorf("%s: how many, from 1 to %d", c.Name, maxCollectedEach)
		}
		if c.Count == 1 {
			c.Count = 0
		}
		for _, x := range []struct {
			what string
			n    float64
		}{{"price", c.Price}, {"paid", c.Paid}} {
			if math.IsNaN(x.n) || x.n < 0 {
				return nil, nil, fmt.Errorf("%s: a %s below nothing", c.Name, x.what)
			}
			if x.n*float64(max(1, c.Count)) >= maxMoney {
				return nil, nil, fmt.Errorf("%s: %w", c.Name, ErrTooLarge)
			}
		}
		for _, d := range []string{c.PriceOn, c.PaidOn} {
			if _, err := time.Parse(time.DateOnly, d); d != "" && err != nil {
				return nil, nil, fmt.Errorf("%s: %q is no day", c.Name, d)
			}
		}
		if c.Picture != "" && !pictureName.MatchString(c.Picture) {
			return nil, nil, fmt.Errorf("%s: its picture %q isn't one the computer saved", c.Name, c.Picture)
		}
		c.ID = id(c.ID, c.Name, "card")
		sum[c.Account] += Worth(*c)
		if c.PriceOn > latest[c.Account] {
			latest[c.Account] = c.PriceOn
		}
	}
	return sum, latest, nil
}
