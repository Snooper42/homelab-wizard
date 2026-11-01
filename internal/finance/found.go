package finance

import (
	"math"
	"sort"
	"strings"
	"time"
)

// Found is a payee the ledger shows being paid on a rhythm that no
// planned payment covers: offered as one ("Hulu, $17.99 monthly since
// June").
type Found struct {
	Payee       string  `json:"payee"`
	Institution string  `json:"institution,omitempty"`
	Category    string  `json:"category,omitempty"`
	Account     string  `json:"account"`
	Amount      float64 `json:"amount"` // the latest
	Every       string  `json:"every"`  // a Schedule's Every
	Since       string  `json:"since"`  // the first
	Last        string  `json:"last"`
	Next        string  `json:"next"` // the day after Last at its rhythm
	Times       int     `json:"times"`
}

// rhythms are the gaps a payee is found at, in days, with the least
// payments each needs and how far a gap may stray.
var rhythms = []struct {
	every string
	days  float64
	least int
	slack float64
}{
	{Weekly, 7, 3, 1},
	{Biweekly, 14, 3, 2},
	{Monthly, 30.44, 3, 4},
	{Quarterly, 91.3, 3, 8},
	{Yearly, 365.25, 2, 10},
}

// findRecurring is each payee paid out of an account on a rhythm, about
// the same each time (within a tenth of the latest), its latest within
// two of its gaps of today, that no planned payment covers: none pays it
// (Transaction.Payment), and none is named alike.
func findRecurring(p Plan, l Ledger, today time.Time) []Found {
	planned := map[string]bool{}
	for _, x := range p.WithCards() {
		planned[strings.ToLower(strings.TrimSpace(x.Name))] = true
	}
	type key struct{ payee, account string }
	by := map[key][]Transaction{}
	covered := map[key]bool{}
	for _, t := range l.Transactions {
		if t.To != "" || t.Amount >= 0 || strings.TrimSpace(t.Payee) == "" {
			continue
		}
		k := key{strings.ToLower(strings.TrimSpace(t.Payee)), t.Account}
		by[k] = append(by[k], t)
		if t.Payment != "" || planned[k.payee] {
			covered[k] = true
		}
	}
	var out []Found
	for k, list := range by {
		if covered[k] {
			continue
		}
		sort.SliceStable(list, func(i, j int) bool { return list[i].Date < list[j].Date })
		last := list[len(list)-1]
		latest := -last.Amount
		var days []time.Time
		for _, t := range list {
			d, err := day(t.Date, today.Location())
			if err != nil || math.Abs(-t.Amount-latest) > latest/10 {
				days = nil
				break
			}
			days = append(days, d)
		}
		if len(days) < 2 {
			continue
		}
		for _, r := range rhythms {
			if len(days) < r.least {
				continue
			}
			steady := true
			for i := 1; i < len(days); i++ {
				gap := days[i].Sub(days[i-1]).Hours() / 24
				if math.Abs(gap-r.days) > r.slack {
					steady = false
					break
				}
			}
			end := days[len(days)-1]
			if !steady || today.Sub(end).Hours()/24 > 2*r.days {
				continue
			}
			next := (Schedule{Every: r.every, Start: dateOf(days[0])}).Dates(end.AddDate(0, 0, 1), end.AddDate(0, 0, int(r.days)+int(r.slack)+1))
			f := Found{Payee: strings.TrimSpace(last.Payee), Institution: last.Institution, Category: last.Category, Account: k.account, Amount: cents(latest), Every: r.every,
				Since: dateOf(days[0]), Last: dateOf(end), Times: len(days)}
			if len(next) > 0 {
				f.Next = dateOf(next[0])
			}
			out = append(out, f)
			break
		}
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].Last > out[j].Last || out[i].Last == out[j].Last && out[i].Payee < out[j].Payee
	})
	return out
}
