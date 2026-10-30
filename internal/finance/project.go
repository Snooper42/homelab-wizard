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
	// Paydays are the paychecks ahead, wherever they land: a check into
	// savings is one too, though it starts no period.
	Paydays []Payday `json:"paydays"`
	// Days are checking at the end of each day from today, for the chart.
	Days []Day `json:"days"`
	// PayToday is a paycheck that lands today, so the screen can ask whether
	// it is in the balances yet (Plan.NotYet); nil on other days.
	PayToday *Payday `json:"payToday,omitempty"`
}

// Period is from a paycheck into checking until the day before the next
// one (or from today, for the first).
type Period struct {
	// Now marks the first: from today, with no paycheck of its own.
	Now   bool    `json:"now"`
	Start string  `json:"start"`
	Last  string  `json:"last"`
	Pay   *Payday `json:"pay,omitempty"`
	// Carried is checking at the start, before the paycheck.
	Carried float64 `json:"carried"`
	// In is what came into checking: the paycheck, and money moved in from
	// another account. Out is what the payments took.
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
	// Total is every check's take-home, wherever it lands.
	Total float64 `json:"total"`
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
	// After is checking once it is paid; set only for payments out of or into checking.
	After   float64 `json:"after"`
	Outside bool    `json:"outside,omitempty"` // between other accounts: checking is not in it
	// Into marks money moved into checking from another account (savings to checking).
	Into bool `json:"into,omitempty"`
}

// Day is checking at the end of one day, and what came in or went out.
type Day struct {
	Date    string  `json:"date"`
	Balance float64 `json:"balance"`
	Events  []Event `json:"events,omitempty"`
}

// Event is a paycheck (its people, a positive amount), a payment (its ID,
// a negative amount), or money moved into checking (its ID, a positive
// amount) on a day.
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

type deposit struct {
	account string
	amount  float64
}

// Project reads the plan forward from today, a day at a time: periods
// paychecks after the current stretch, and the chart's days, from the same
// balances.
func Project(p Plan, today time.Time, periods int) View {
	loc := today.Location()
	today = time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, loc)
	end := today.AddDate(0, 0, horizon)
	v := View{Plan: p, Today: dateOf(today), Periods: []Period{}, Paydays: []Payday{}, Days: []Day{}}
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
	// balances yet (else it is taken to be in them). A day with a check
	// into checking starts a period; one only into savings does not.
	byDay := map[string]*Payday{}
	intoChecking := map[string]bool{}
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
			pd.Total += e.Net
			to := e.Account
			if to == "" {
				to = v.Checking
			}
			if to == v.Checking {
				pd.Amount += e.Net
				intoChecking[k] = true
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
		if intoChecking[dateOf(today)] {
			v.PayToday = pd
		}
		if p.NotYet != dateOf(today) {
			delete(byDay, dateOf(today))
		}
	}
	var days []string
	checks := 0 // paydays ahead with a check into checking
	for k, pd := range byDay {
		pd.Amount, pd.Total = cents(pd.Amount), cents(pd.Total)
		days = append(days, k)
		if intoChecking[k] {
			checks++
		}
	}
	sort.Strings(days)
	for _, k := range days {
		if len(v.Paydays) == periods {
			break
		}
		v.Paydays = append(v.Paydays, *byDay[k])
	}

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

	// Each day: its paychecks, then its payments, then a day's interest.
	// A paycheck into checking closes the period before it and opens its
	// own, until there are periods after now; with none ahead, now runs a
	// month, so the payments still show. The chart goes on to its last day.
	var per *Period
	open := func(k string, pd *Payday) {
		per = &Period{Now: pd == nil, Start: k, Pay: pd, Carried: cents(bal[v.Checking]), Rows: []Row{}}
	}
	shut := func(d time.Time) {
		if per == nil {
			return
		}
		per.Last = dateOf(d.AddDate(0, 0, -1))
		per.In, per.Out = cents(per.In), cents(per.Out)
		per.Left = cents(bal[v.Checking])
		per.Accounts = rounded(bal)
		v.Periods = append(v.Periods, *per)
		per = nil
	}
	if !intoChecking[dateOf(today)] || byDay[dateOf(today)] == nil {
		open(dateOf(today), nil)
	}
	monthOn := today.AddDate(0, 1, 0)
	hi := 0
	for d := today; d.Before(end); d = d.AddDate(0, 0, 1) {
		k := dateOf(d)
		pd := byDay[k]
		if pd != nil && intoChecking[k] {
			shut(d)
			if len(v.Periods) <= periods {
				open(k, pd)
			}
		} else if checks == 0 && d.Equal(monthOn) {
			shut(d)
		}
		if per == nil && len(v.Days) >= chartDays {
			break
		}
		var ev []Event
		if pd != nil {
			for _, dep := range deposits[k] {
				move(bal, kind, dep.account, dep.amount)
			}
			if intoChecking[k] {
				ev = append(ev, Event{People: pd.People, Amount: pd.Amount})
				if per != nil {
					per.In += pd.Amount
				}
			}
		}
		for ; hi < len(hits) && !hits[hi].date.After(d); hi++ {
			r, e := pay(hits[hi], bal, kind, v.Checking)
			if e != nil {
				ev = append(ev, *e)
			}
			if per == nil {
				continue
			}
			if r.Into {
				per.In += r.Amount
			} else if !r.Outside {
				per.Out += r.Amount
			}
			per.Rows = append(per.Rows, r)
		}
		earn(p, bal)
		if len(v.Days) < chartDays {
			v.Days = append(v.Days, Day{Date: k, Balance: cents(bal[v.Checking]), Events: ev})
		}
	}
	return v
}

// pay takes one payment out of its account and into the one it goes to:
// its row, and its event on the chart when checking is in it.
func pay(h hit, bal map[string]float64, kind map[string]string, checking string) (Row, *Event) {
	from := h.pay.From
	if from == "" {
		from = checking
	}
	move(bal, kind, from, -h.amt)
	if h.pay.To != "" {
		move(bal, kind, h.pay.To, h.amt)
	}
	if h.pay.Card != "" && h.pay.Card != h.pay.To {
		move(bal, kind, h.pay.Card, h.amt)
	}
	r := Row{Date: dateOf(h.date), Payment: h.pay.ID, Amount: cents(h.amt), Estimate: h.pay.Estimate, After: cents(bal[checking])}
	switch {
	case from == checking:
		return r, &Event{Payment: h.pay.ID, Amount: -r.Amount}
	case h.pay.To == checking:
		r.Into = true
		return r, &Event{Payment: h.pay.ID, Amount: r.Amount}
	}
	r.Outside, r.After = true, 0
	return r, nil
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

// earn adds a day's interest to each account with a rate.
func earn(p Plan, bal map[string]float64) {
	for _, a := range p.Accounts {
		if a.Rate > 0 && !Owed(a.Kind) {
			bal[a.ID] += bal[a.ID] * a.Rate / 100 / 365
		}
	}
}

func cents(x float64) float64 { return math.Round(x*100) / 100 }

func rounded(m map[string]float64) map[string]float64 {
	out := make(map[string]float64, len(m))
	for k, v := range m {
		out[k] = cents(v)
	}
	return out
}
