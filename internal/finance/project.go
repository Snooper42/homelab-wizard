package finance

import (
	"math"
	"sort"
	"time"
)

// View is the plan read forward from today: what the Finances screen draws.
type View struct {
	Plan Plan `json:"plan"`
	// Today is the day it was read from (YYYY-MM-DD).
	Today string `json:"today"`
	// Checking is the account paychecks land in and payments come out of,
	// by ID ("" before there is a checking account).
	Checking string `json:"checking"`
	// Periods are now (until the next paycheck) and each paycheck after it.
	Periods []Period `json:"periods"`
	// Days are checking at the end of each day from today, for the chart.
	Days []Day `json:"days"`
	// PayToday is a paycheck that lands today, so the screen can ask whether
	// it is in the balances yet (Plan.NotYet); nil on other days.
	PayToday *Payday `json:"payToday,omitempty"`
}

// Period is from a paycheck until the day before the next one (or from
// today, for the first).
type Period struct {
	// Now marks the first: from today, with no paycheck of its own.
	Now   bool    `json:"now"`
	Start string  `json:"start"`
	Last  string  `json:"last"`
	Pay   *Payday `json:"pay,omitempty"`
	// Carried is checking at the start, before the paycheck.
	Carried float64 `json:"carried"`
	// In is what the paycheck put in checking; Out what the payments took.
	In  float64 `json:"in"`
	Out float64 `json:"out"`
	// Left is checking on the last day: the post-pay balance.
	Left float64 `json:"left"`
	Rows []Row   `json:"rows"`
	// Accounts is each account on the last day, by ID (what a card or loan owes).
	Accounts map[string]float64 `json:"accounts"`
}

// Payday is one day's paychecks: one person's, or two on the same day.
type Payday struct {
	Date   string   `json:"date"`
	People []string `json:"people"` // earners' IDs
	Amount float64  `json:"amount"` // into checking
	// Moved says when a check comes early: its day was a weekend or holiday.
	Moved []Moved `json:"moved,omitempty"`
}

// Moved is a paycheck paid the business day before its day.
type Moved struct {
	Person string `json:"person"`
	From   string `json:"from"`
	Why    string `json:"why"` // "the weekend", a holiday, or both: "the weekend and Christmas"
}

// Row is one payment in a period.
type Row struct {
	Date     string  `json:"date"`
	Payment  string  `json:"payment"` // its ID
	Amount   float64 `json:"amount"`
	Estimate bool    `json:"estimate,omitempty"`
	// After is checking once it is paid; set only for payments out of checking.
	After   float64 `json:"after"`
	Outside bool    `json:"outside,omitempty"` // paid from another account
}

// Day is checking at the end of one day, and what came in or went out.
type Day struct {
	Date    string  `json:"date"`
	Balance float64 `json:"balance"`
	Events  []Event `json:"events,omitempty"`
}

// Event is a paycheck (its people, a positive amount) or a payment (its
// ID, a negative amount) on a day.
type Event struct {
	Payment string   `json:"payment,omitempty"`
	People  []string `json:"people,omitempty"`
	Amount  float64  `json:"amount"`
}

// horizon is how far ahead paychecks and payments are read; chartDays how
// many days the chart shows.
const (
	horizon   = 400
	chartDays = 93
)

type hit struct {
	date time.Time
	pay  *Payment
	amt  float64
}

// Project reads the plan forward from today: periods paychecks after the
// current stretch, and the chart's days.
func Project(p Plan, today time.Time, periods int) View {
	loc := today.Location()
	today = time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, loc)
	end := today.AddDate(0, 0, horizon)
	v := View{Plan: p, Today: dateOf(today), Periods: []Period{}, Days: []Day{}}
	for _, a := range p.Accounts {
		if a.Kind == Checking {
			v.Checking = a.ID
			break
		}
	}
	kind := map[string]string{}
	bal := map[string]float64{}
	for _, a := range p.Accounts {
		kind[a.ID] = a.Kind
		bal[a.ID] = a.Balance
		if a.Kind == Card {
			bal[a.ID] = a.Owed()
		}
	}
	// Paydays: each person's checks, moved before a weekend or holiday,
	// after today; one today too when the household said it was not in the
	// balances yet (else it is taken to be in them).
	byDay := map[string]*Payday{}
	type deposit struct {
		account string
		amount  float64
	}
	deposits := map[string][]deposit{}
	for i := range p.People {
		e := &p.People[i]
		for _, due := range e.Schedule.Dates(today.AddDate(0, 0, -10), end) {
			d, why := BankDayIn(due, p.Holidays)
			if d.Before(today) {
				continue
			}
			k := dateOf(d)
			pd := byDay[k]
			if pd == nil {
				pd = &Payday{Date: k}
				byDay[k] = pd
			}
			pd.People = append(pd.People, e.ID)
			to := e.Account
			if to == "" {
				to = v.Checking
			}
			if to == v.Checking {
				pd.Amount += e.Net
			}
			deposits[k] = append(deposits[k], deposit{to, e.Net})
			for _, ded := range e.Deductions {
				if ded.Account != "" {
					deposits[k] = append(deposits[k], deposit{ded.Account, ded.Amount})
				}
			}
			if why != "" {
				pd.Moved = append(pd.Moved, Moved{Person: e.ID, From: dateOf(due), Why: why})
			}
		}
	}
	if pd := byDay[dateOf(today)]; pd != nil {
		v.PayToday = pd
		if p.NotYet != dateOf(today) {
			delete(byDay, dateOf(today))
		}
	}
	var days []string
	for k := range byDay {
		days = append(days, k)
	}
	sort.Strings(days)

	// Payments: a card's next payment is what it owes now, the later ones the usual amount.
	var hits []hit
	for i := range p.Payments {
		x := &p.Payments[i]
		for n, d := range x.Schedule.Dates(today, end) {
			amt := x.Amount
			if x.Card != "" && n == 0 {
				amt = bal[x.Card]
			}
			// Nothing to pay (a card paid off, an amount left at 0): no row.
			if amt <= 0 {
				continue
			}
			hits = append(hits, hit{d, x, amt})
		}
	}
	sort.SliceStable(hits, func(i, j int) bool {
		if !hits[i].date.Equal(hits[j].date) {
			return hits[i].date.Before(hits[j].date)
		}
		return hits[i].amt > hits[j].amt
	})

	pay := func(h hit) Row {
		from := h.pay.From
		if from == "" {
			from = v.Checking
		}
		move(bal, kind, from, -h.amt)
		if h.pay.To != "" {
			move(bal, kind, h.pay.To, h.amt)
		}
		if h.pay.Card != "" && h.pay.Card != h.pay.To {
			move(bal, kind, h.pay.Card, h.amt)
		}
		return Row{Date: dateOf(h.date), Payment: h.pay.ID, Amount: cents(h.amt), Estimate: h.pay.Estimate, After: cents(bal[v.Checking]), Outside: from != v.Checking}
	}
	// The chart reads its own copy of the balances, day by day.
	chart := copyMap(bal)
	// Now, from today, unless a paycheck still to come lands today: then
	// its stretch is the first.
	starts := days
	if len(days) == 0 || days[0] != dateOf(today) {
		starts = append([]string{dateOf(today)}, days...)
	}
	if len(days) == 0 {
		// No paychecks yet: now runs a month, so the payments still show.
		starts = append(starts, dateOf(today.AddDate(0, 1, 0)))
	}
	next := 0
	for i := 0; i < len(starts)-1 && len(v.Periods) <= periods; i++ {
		start, _ := day(starts[i], loc)
		stop, _ := day(starts[i+1], loc)
		pd := byDay[starts[i]]
		per := Period{Now: pd == nil, Start: starts[i], Last: dateOf(stop.AddDate(0, 0, -1)), Carried: cents(bal[v.Checking]), Rows: []Row{}}
		if pd != nil {
			per.Pay = pd
			for _, dep := range deposits[starts[i]] {
				move(bal, kind, dep.account, dep.amount)
			}
			per.In = cents(pd.Amount)
		}
		for ; next < len(hits) && hits[next].date.Before(stop); next++ {
			if hits[next].date.Before(start) {
				continue
			}
			r := pay(hits[next])
			if !r.Outside {
				per.Out += r.Amount
			}
			per.Rows = append(per.Rows, r)
		}
		earn(p, bal, stop.Sub(start).Hours()/24)
		per.Out = cents(per.Out)
		per.Left = cents(bal[v.Checking])
		per.Accounts = rounded(bal)
		v.Periods = append(v.Periods, per)
	}

	// The chart: checking at the end of each day.
	hi := 0
	for d := today; d.Before(today.AddDate(0, 0, chartDays)); d = d.AddDate(0, 0, 1) {
		k := dateOf(d)
		var ev []Event
		if pd := byDay[k]; pd != nil {
			for _, dep := range deposits[k] {
				move(chart, kind, dep.account, dep.amount)
			}
			ev = append(ev, Event{People: pd.People, Amount: cents(pd.Amount)})
		}
		for ; hi < len(hits) && !hits[hi].date.After(d); hi++ {
			h := hits[hi]
			from := h.pay.From
			if from == "" {
				from = v.Checking
			}
			move(chart, kind, from, -h.amt)
			if from == v.Checking {
				ev = append(ev, Event{Payment: h.pay.ID, Amount: -cents(h.amt)})
			}
		}
		v.Days = append(v.Days, Day{Date: k, Balance: cents(chart[v.Checking]), Events: ev})
	}
	return v
}

// move adds amount to an account: money in for what is there, less owed
// for a card or loan (never below nothing).
func move(bal map[string]float64, kind map[string]string, id string, amount float64) {
	if id == "" {
		return
	}
	if Owed(kind[id]) {
		bal[id] = math.Max(0, bal[id]-amount)
		return
	}
	bal[id] += amount
}

// earn adds days of interest to each account with a rate.
func earn(p Plan, bal map[string]float64, days float64) {
	for _, a := range p.Accounts {
		if a.Rate > 0 && !Owed(a.Kind) {
			bal[a.ID] += bal[a.ID] * a.Rate / 100 * days / 365
		}
	}
}

func cents(x float64) float64 { return math.Round(x*100) / 100 }

func copyMap(m map[string]float64) map[string]float64 {
	out := make(map[string]float64, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}

func rounded(m map[string]float64) map[string]float64 {
	out := make(map[string]float64, len(m))
	for k, v := range m {
		out[k] = cents(v)
	}
	return out
}
