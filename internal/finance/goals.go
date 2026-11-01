package finance

import (
	"fmt"
	"math"
	"strings"
	"time"
)

// A goal is money put by for something (an emergency fund, a trip, a
// car): a target, a day it is wanted by if there is one, and a share of
// one or more accounts' balances that counts toward it. It never moves
// money: what an account holds is shared out among the goals that count
// it, at most all of it.
type Goal struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	Target float64 `json:"target"`
	// Date is the day it is wanted by (YYYY-MM-DD); none, whenever.
	Date   string      `json:"date,omitempty"`
	Shares []GoalShare `json:"shares,omitempty"`
}

// GoalShare is the share of an account's balance that counts toward a goal.
type GoalShare struct {
	Account string `json:"account"`
	// Percent of what the account holds (100 when it is all for the goal).
	Percent float64 `json:"percent"`
}

// GoalNow is a goal today: what is saved toward it, what is left, what it
// needs a month and a paycheck to be reached by its day, and the pace the
// accounts have kept (from their history), with the month it is reached
// at that pace.
type GoalNow struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	Target float64 `json:"target"`
	Date   string  `json:"date,omitempty"`
	Saved  float64 `json:"saved"`
	Left   float64 `json:"left"`
	// Needs is a month and a paycheck to reach it by its day; none with no
	// day, once reached, or with the day gone (then all of Left is due).
	NeedsMonth    float64 `json:"needsMonth,omitempty"`
	NeedsPaycheck float64 `json:"needsPaycheck,omitempty"`
	// Pace is what its share of the accounts grew a month, over the last
	// three months of their history (or as far back as it goes, a month at
	// least); none with no history to read.
	Pace  float64 `json:"pace,omitempty"`
	Paced bool    `json:"paced,omitempty"`
	// Reaches is the month (YYYY-MM) the pace reaches the target; none
	// when reached already, or at no pace.
	Reaches string `json:"reaches,omitempty"`
	// Behind says the pace reaches it after its day, or never.
	Behind bool `json:"behind,omitempty"`
}

// goalKinds are the accounts a goal can count: those that hold money.
var goalKinds = map[string]bool{Checking: true, Savings: true, Investment: true, Retirement: true, Other: true}

// cleanGoals checks each goal against the accounts: a name, a target more
// than nothing, a day when one is given, shares of accounts that hold
// money, each more than nothing and at most all of it, and no account
// shared out past all it holds across the goals. Each gets an ID.
func cleanGoals(p *Plan, id func(have, name, prefix string) string) error {
	kind := map[string]string{}
	name := map[string]string{}
	for _, a := range p.Accounts {
		kind[a.ID], name[a.ID] = a.Kind, a.Name
	}
	given := map[string]float64{}
	for i := range p.Goals {
		g := &p.Goals[i]
		g.Name = strings.TrimSpace(g.Name)
		if g.Name == "" {
			return fmt.Errorf("a goal has no name")
		}
		if !(g.Target > 0) || math.IsInf(g.Target, 0) {
			return fmt.Errorf("%s: type how much it needs", g.Name)
		}
		g.Target = cents(g.Target)
		if g.Date != "" {
			if _, err := day(g.Date, time.UTC); err != nil || len(g.Date) != 10 {
				return fmt.Errorf("%s: no date %q (YYYY-MM-DD)", g.Name, g.Date)
			}
		}
		seen := map[string]bool{}
		for _, s := range g.Shares {
			k, ok := kind[s.Account]
			if !ok {
				return fmt.Errorf("%s: no account %q", g.Name, s.Account)
			}
			if !goalKinds[k] {
				return fmt.Errorf("%s: %s holds no money to put by", g.Name, name[s.Account])
			}
			if seen[s.Account] {
				return fmt.Errorf("%s: %s is in it twice", g.Name, name[s.Account])
			}
			seen[s.Account] = true
			if !(s.Percent > 0) || s.Percent > 100 {
				return fmt.Errorf("%s: a share of %s is more than nothing and at most 100%%", g.Name, name[s.Account])
			}
			given[s.Account] += s.Percent
			if given[s.Account] > 100+1e-9 {
				return fmt.Errorf("%s is shared out past all it holds: %.0f%% across the goals", name[s.Account], given[s.Account])
			}
		}
		g.ID = id(g.ID, g.Name, "goal")
	}
	return nil
}

// paceDays is how far back a goal's pace reads the accounts' history.
const paceDays = 91

// goalsNow reads each goal today: its share of each account as it stands
// (start, in the plan's currency) and as its history had it about three
// months ago, and the paydays ahead for what it needs a paycheck.
func goalsNow(p Plan, start map[string]float64, paydays []Payday, today time.Time) []GoalNow {
	if len(p.Goals) == 0 {
		return nil
	}
	accounts := map[string]Account{}
	for _, a := range p.Accounts {
		accounts[a.ID] = a
	}
	// How many paydays a day, from those read ahead, for a day past them.
	var last time.Time
	if n := len(paydays); n > 0 {
		last, _ = day(paydays[n-1].Date, today.Location())
	}
	perDay := 0.0
	if span := last.Sub(today).Hours() / 24; span > 0 {
		perDay = float64(len(paydays)) / span
	}
	out := make([]GoalNow, 0, len(p.Goals))
	for _, g := range p.Goals {
		now := GoalNow{ID: g.ID, Name: g.Name, Target: g.Target, Date: g.Date}
		grew, months := 0.0, 0.0
		for _, s := range g.Shares {
			a, ok := accounts[s.Account]
			if !ok {
				continue
			}
			share := s.Percent / 100
			bal, ok := start[a.ID]
			if !ok {
				bal = a.Balance
			}
			now.Saved += bal * share
			// The history's reading about three months back, or its first.
			var then *Point
			for i := range a.History {
				d, err := day(a.History[i].Date, today.Location())
				if err != nil || !d.Before(today) {
					continue
				}
				if then == nil || !d.After(today.AddDate(0, 0, -paceDays)) {
					then = &a.History[i]
				}
			}
			if then == nil {
				continue
			}
			d, _ := day(then.Date, today.Location())
			m := math.Max(today.Sub(d).Hours()/24/30.44, 1)
			grew += (bal - then.Amount) * share / m
			months = math.Max(months, m)
		}
		now.Saved = cents(now.Saved)
		now.Left = cents(math.Max(0, g.Target-now.Saved))
		if months > 0 {
			now.Pace, now.Paced = cents(grew), true
		}
		due, dated := time.Time{}, false
		if g.Date != "" {
			due, _ = day(g.Date, today.Location())
			dated = true
		}
		if now.Left > 0 && dated && due.After(today) {
			m := due.Sub(today).Hours() / 24 / 30.44
			now.NeedsMonth = cents(now.Left / math.Max(m, 1))
			n := 0
			for _, pd := range paydays {
				if d, err := day(pd.Date, today.Location()); err == nil && !d.After(due) {
					n++
				}
			}
			if due.After(last) && perDay > 0 {
				n += int(due.Sub(last).Hours() / 24 * perDay)
			}
			if n > 0 {
				now.NeedsPaycheck = cents(now.Left / float64(n))
			}
		}
		if now.Left > 0 {
			if now.Pace > 0 {
				at := monthsOn(today, int(math.Ceil(now.Left/now.Pace)))
				now.Reaches = fmt.Sprintf("%04d-%02d", at.Year(), at.Month())
				now.Behind = dated && at.After(time.Date(due.Year(), due.Month()+1, 0, 0, 0, 0, 0, due.Location()))
			} else {
				now.Behind = dated
			}
		}
		out = append(out, now)
	}
	return out
}
