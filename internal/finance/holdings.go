package finance

import (
	"fmt"
	"math"
	"regexp"
	"sort"
	"strings"
	"time"
)

// Investments, read from Ghostfolio, the homelab's own investment tracker,
// on a click (Read now) or once a day on opening Finances: each account's
// holdings, kept in the plan so the card shows them with Ghostfolio
// stopped, on a phone, and day by day. Ghostfolio looks prices up by
// symbol itself; nothing here is fetched from anywhere else.

// Holding is a fund or a company's shares an account holds: how many,
// what went in, and what they were worth when read; History is that worth
// on each day it was read, oldest first.
type Holding struct {
	Symbol  string  `json:"symbol"`
	Name    string  `json:"name,omitempty"`
	Shares  float64 `json:"shares"`
	Paid    float64 `json:"paid"`
	Value   float64 `json:"value"`
	History []Point `json:"history,omitempty"`
}

// Invested is an account as Ghostfolio read it: its name there, what it is
// worth (its holdings and its cash), the currency that is in, and its
// holdings.
type Invested struct {
	Name     string    `json:"name"`
	Value    float64   `json:"value"`
	Currency string    `json:"currency,omitempty"`
	Holdings []Holding `json:"holdings"`
}

var notWord = regexp.MustCompile(`[^a-z0-9]+`)

// plain is a name as it is matched: lower case, words only.
func plain(s string) string {
	return strings.TrimSpace(notWord.ReplaceAllString(strings.ToLower(s), " "))
}

// TakeHoldings keeps what Ghostfolio read on the plan's accounts, at now,
// and gives the names of Ghostfolio's accounts nothing matched. Each is
// matched, as Update balances matches, to the account picked for it by
// hand, else the investment or retirement account of the same name, else
// one whose name is inside the other's; never one kept in another
// currency. A match's worth is its balance, today's, and each of its
// holdings remembers its worth on each day read; one with nothing in
// it in Ghostfolio yet (no holdings, no cash) leaves the balance as it was. An account Ghostfolio no
// longer matches keeps its balance, but not holdings that are no longer
// true. The plan given is left as it was.
func TakeHoldings(p Plan, found []Invested, now time.Time) (Plan, []string) {
	p.Accounts = append([]Account(nil), p.Accounts...)
	today := dateOf(now)
	taken := make([]bool, len(p.Accounts))
	matched := make([]int, len(found))
	for i := range matched {
		matched[i] = -1
	}
	fits := func(a Account, f Invested) bool {
		code := a.Currency
		if code == "" {
			code = p.home()
		}
		return f.Currency == "" || strings.EqualFold(f.Currency, code)
	}
	invested := func(a Account) bool { return a.Kind == Investment || a.Kind == Retirement }
	pass := func(same func(a Account, name string) bool) {
		for i, f := range found {
			name := plain(f.Name)
			if matched[i] >= 0 || name == "" {
				continue
			}
			for j, a := range p.Accounts {
				if !taken[j] && same(a, name) {
					if fits(a, f) {
						matched[i], taken[j] = j, true
					}
					break
				}
			}
		}
	}
	// By hand first, then the same name, then one inside the other: a
	// loose match never takes an account another names exactly.
	pass(func(a Account, name string) bool { return a.Ghostfolio != "" && plain(a.Ghostfolio) == name })
	pass(func(a Account, name string) bool { return a.Ghostfolio == "" && invested(a) && plain(a.Name) == name })
	pass(func(a Account, name string) bool {
		own := plain(a.Name)
		return a.Ghostfolio == "" && invested(a) && own != "" && (strings.Contains(own, name) || strings.Contains(name, own))
	})
	var left []string
	for i, f := range found {
		if matched[i] < 0 {
			if strings.TrimSpace(f.Name) != "" {
				left = append(left, strings.TrimSpace(f.Name))
			}
			continue
		}
		a := &p.Accounts[matched[i]]
		// Set up in Ghostfolio with nothing in it yet: its $0 is not this
		// account's worth, so the balance typed in here stays as it is.
		if len(f.Holdings) == 0 && math.Abs(f.Value) < 0.005 {
			a.Holdings = nil
			continue
		}
		was := map[string][]Point{}
		for _, h := range a.Holdings {
			was[strings.ToUpper(h.Symbol)] = h.History
		}
		a.Holdings = make([]Holding, 0, len(f.Holdings))
		for _, h := range f.Holdings {
			h.Symbol = strings.ToUpper(strings.TrimSpace(h.Symbol))
			h.Name = strings.TrimSpace(h.Name)
			h.Shares = math.Round(h.Shares*1e6) / 1e6
			h.Paid, h.Value = cents(h.Paid), cents(h.Value)
			h.History = putPoint(append([]Point(nil), was[h.Symbol]...), Point{today, h.Value})
			a.Holdings = append(a.Holdings, h)
		}
		a.Balance, a.Updated = cents(f.Value), today
	}
	for j := range p.Accounts {
		if !taken[j] {
			p.Accounts[j].Holdings = nil
		}
	}
	p.HoldingsRead = now.Format(time.RFC3339)
	return p, left
}

// putPoint puts a day's amount in a history in order, in place of what
// that day had, keeping at most keptDays.
func putPoint(h []Point, pt Point) []Point {
	at := sort.Search(len(h), func(i int) bool { return h[i].Date >= pt.Date })
	if at < len(h) && h[at].Date == pt.Date {
		h[at] = pt
	} else {
		h = append(h, Point{})
		copy(h[at+1:], h[at:])
		h[at] = pt
	}
	if n := len(h); n > keptDays {
		h = h[n-keptDays:]
	}
	return h
}

// cleanHoldings tidies an account's holdings: symbols in capitals, each
// with one, its numbers real ones, its days in order.
func cleanHoldings(a *Account) error {
	a.Ghostfolio = strings.TrimSpace(a.Ghostfolio)
	for i := range a.Holdings {
		h := &a.Holdings[i]
		h.Symbol, h.Name = strings.ToUpper(strings.TrimSpace(h.Symbol)), strings.TrimSpace(h.Name)
		if h.Symbol == "" {
			return fmt.Errorf("%s: a holding has no symbol", a.Name)
		}
		for _, n := range []float64{h.Shares, h.Paid, h.Value} {
			if math.IsNaN(n) || math.IsInf(n, 0) {
				return fmt.Errorf("%s: %s has no number for what it holds", a.Name, h.Symbol)
			}
		}
		if h.Shares < 0 {
			return fmt.Errorf("%s: %s has %v shares", a.Name, h.Symbol, h.Shares)
		}
		sort.SliceStable(h.History, func(i, j int) bool { return h.History[i].Date < h.History[j].Date })
	}
	return nil
}
