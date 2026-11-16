package finance

import "time"

// WorthBack is how one account went back before the first balance typed
// in: what it is read to have been on Plan.WorthFrom (what is there, or a
// card's or loan's owed as a minus, as in net worth), how ("transactions":
// the ledger's, undone day by day; "flat": nothing to go on, held where it
// is, so it cannot make the line jump), and the lowest it got on the way
// back (checking under nothing says the past is missing money in).
type WorthBack struct {
	Account  string  `json:"account"`
	Start    float64 `json:"start"`
	How      string  `json:"how"`
	Lowest   float64 `json:"lowest"`
	LowestOn string  `json:"lowestOn,omitempty"`
	// Ends is what it is read to have been on each month's last day in
	// that time (and the day before the first balance), by day: Net worth
	// by month's bars before the first balance.
	Ends map[string]float64 `json:"ends,omitempty"`
}

// worthBack is net worth each day from Plan.WorthFrom to the day before
// worth's first (the first balance typed in, or today with none), worked
// back from that day: each account as the real line has it there, less
// each day's transactions on it (txSides: a move's other side too), a
// balance taken to hold its own day's already. Nil when none is asked for
// or it starts on or after the real line. Plan amounts are the plan's
// currency (Plan.inHome), the ledger's too (Ledger.inHome).
func worthBack(p Plan, l Ledger, today time.Time) ([]Point, []WorthBack) {
	from, err := day(p.WorthFrom, today.Location())
	if p.WorthFrom == "" || err != nil {
		return nil, nil
	}
	first := today
	for _, a := range p.Accounts {
		if len(a.History) > 0 {
			if d, err := day(a.History[0].Date, today.Location()); err == nil && d.Before(first) {
				first = d
			}
		}
	}
	if min := today.AddDate(0, 0, -keptDays); from.Before(min) {
		from = min
	}
	if !from.Before(first) {
		return nil, nil
	}
	// Each account on the first day, as worth reads it: its first kept
	// balance (or, with none, its balance), owed as a minus.
	now := make([]float64, len(p.Accounts))
	index := map[string]int{}
	for i, a := range p.Accounts {
		index[a.ID] = i
		n := a.Balance
		if a.Kind == Card {
			n = a.Owed()
		}
		if len(a.History) > 0 {
			n = a.History[0].Amount
			for _, x := range a.History {
				if x.Date <= dateOf(first) {
					n = x.Amount
				}
			}
		}
		if Owed(a.Kind) {
			n = -n
		}
		now[i] = n
	}
	// What each day's transactions did to each account, as net worth sees it:
	// signed as the account sees it, which for a card or loan is a plus when paid down.
	moved := map[string][]float64{}
	touched := make([]bool, len(p.Accounts))
	for _, t := range l.Transactions {
		d, err := day(t.Date, today.Location())
		if err != nil || d.Before(from) || d.After(first) {
			continue
		}
		for _, s := range txSides(t) {
			i, ok := index[s.account]
			if !ok {
				continue
			}
			if moved[t.Date] == nil {
				moved[t.Date] = make([]float64, len(p.Accounts))
			}
			moved[t.Date][i] += s.amount
			touched[i] = true
		}
	}
	back := make([]WorthBack, len(p.Accounts))
	for i, a := range p.Accounts {
		how := "flat"
		if touched[i] {
			how = "transactions"
		}
		back[i] = WorthBack{Account: a.ID, How: how, Lowest: cents(now[i])}
	}
	// From the first day back: a day's value is the next day's less what the next day moved.
	days := int(first.Sub(from).Hours()/24 + 0.5)
	out := make([]Point, days)
	for k := days - 1; k >= 0; k-- {
		d := from.AddDate(0, 0, k)
		if m := moved[dateOf(d.AddDate(0, 0, 1))]; m != nil {
			for i := range now {
				now[i] -= m[i]
			}
		}
		total := 0.0
		end := d.AddDate(0, 0, 1).Day() == 1 || k == days-1
		for i := range now {
			total += now[i]
			if end {
				if back[i].Ends == nil {
					back[i].Ends = map[string]float64{}
				}
				back[i].Ends[dateOf(d)] = cents(now[i])
			}
			// The earliest day it was that low (walking back, a tie moves it earlier).
			if v := cents(now[i]); v <= back[i].Lowest {
				back[i].Lowest, back[i].LowestOn = v, dateOf(d)
			}
		}
		out[k] = Point{dateOf(d), cents(total)}
	}
	for i := range back {
		back[i].Start = cents(now[i])
		if back[i].How == "flat" {
			back[i].LowestOn = ""
		}
	}
	return out, back
}
