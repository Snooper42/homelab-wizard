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
	// Typed is the oldest day a checking or card balance was typed in
	// (YYYY-MM-DD), "" when none says.
	Typed string `json:"typed"`
	// Start is each account at the start of today, by ID: as typed in, with
	// what has happened since (what a card or loan owes).
	Start map[string]float64 `json:"start"`
	// Since are the paychecks and payments taken to be in the balances or
	// to have happened since they were typed in, oldest first, and each
	// that is waiting (Plan.Waiting), so the household can say which have not.
	Since []Past `json:"since"`
	// Periods are now (until the next paycheck) and each paycheck after it.
	Periods []Period `json:"periods"`
	// Paydays are the paychecks ahead, wherever they land: a check into
	// savings is one too, though it starts no period.
	Paydays []Payday `json:"paydays"`
	// Days are checking at the end of each day from today, for the chart.
	Days []Day `json:"days"`
}

// Past is a paycheck or payment dated on or before today that is taken to
// be in the balances: on the day one it touches was typed in (Typed), or
// after that and before today, so it has happened since.
type Past struct {
	// Key names it in Plan.Waiting: "pay:<person>:<date>" or "payment:<payment>:<date>".
	Key     string  `json:"key"`
	Date    string  `json:"date"`
	Person  string  `json:"person,omitempty"`
	Payment string  `json:"payment,omitempty"`
	Amount  float64 `json:"amount"`
	// In is money into checking; Outside one between other accounts.
	In      bool `json:"in,omitempty"`
	Outside bool `json:"outside,omitempty"`
	// Typed marks one dated the day its balance was typed in, so in it.
	Typed bool `json:"typed,omitempty"`
	// Waiting is one the household said is not in the balances yet: it comes today.
	Waiting bool `json:"waiting,omitempty"`
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
	// another account. Out is what the payments took, Saved the part of it
	// that went into savings, an investment, or retirement.
	In    float64 `json:"in"`
	Out   float64 `json:"out"`
	Saved float64 `json:"saved"`
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
	// Late marks one dated before today that is waiting (Plan.Waiting): it comes today.
	Late bool `json:"late,omitempty"`
	// Saved marks one into savings, an investment, or retirement: kept, not spent.
	Saved bool `json:"saved,omitempty"`
}

// Saving reports whether money into an account of this kind is kept, not spent.
func Saving(kind string) bool { return kind == Savings || kind == Investment || kind == Retirement }

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

// horizon is how far ahead paychecks and payments are read, and how far
// back a balance typed in is read from; chartDays how many days the chart shows.
const (
	horizon   = 400
	chartDays = 93
)

// event is one paycheck or payment on its day.
type event struct {
	day     time.Time // when it is counted: its own day, or today while it waits
	was     time.Time // its own day
	key     string
	waiting bool
	person  *Earner
	why     string // a paycheck moved early: why
	due     time.Time
	pay     *Payment
	amt     float64 // a payment's amount
}

// side is what an event does to one account: money in (or less owed) when positive.
type side struct {
	account string
	amount  float64
}

// Project reads the plan forward, a day at a time: from the day each
// balance was typed in up to today (what has happened since), then
// periods paychecks after the current stretch, and the chart's days, from
// the same balances.
func Project(p Plan, today time.Time, periods int) View {
	loc := today.Location()
	today = time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, loc)
	end := today.AddDate(0, 0, horizon)
	v := View{Plan: p, Today: dateOf(today), Since: []Past{}, Periods: []Period{}, Paydays: []Payday{}, Days: []Day{}}
	for _, a := range p.Accounts {
		if a.Kind == Checking {
			v.Checking = a.ID
			break
		}
	}
	kind := map[string]string{}
	bal := map[string]float64{}
	// The day each balance was typed in: its own, the plan's, or today when
	// neither says; never after today, nor more than a horizon before.
	typed := map[string]time.Time{}
	start := today
	for _, a := range p.Accounts {
		kind[a.ID] = a.Kind
		bal[a.ID] = a.Balance
		if a.Kind == Card {
			bal[a.ID] = a.Owed()
		}
		t, said := today, false
		for _, s := range []string{a.Updated, p.Updated} {
			if d, err := day(s, loc); err == nil {
				t, said = d, true
				break
			}
		}
		if t.After(today) {
			t = today
		}
		if t.Before(today.AddDate(0, 0, -horizon)) {
			t = today.AddDate(0, 0, -horizon)
		}
		typed[a.ID] = t
		if t.Before(start) {
			start = t
		}
		if said && (a.Kind == Checking || a.Kind == Card) && (v.Typed == "" || dateOf(t) < v.Typed) {
			v.Typed = dateOf(t)
		}
	}
	// counts says whether an event's day is in an account's balance from
	// now on: after the day it was typed in, or any day for one waiting.
	counts := func(e *event, account string) bool {
		t, ok := typed[account]
		return e.waiting || !ok || e.was.After(t)
	}
	waiting := map[string]bool{}
	for _, k := range p.Waiting {
		waiting[k] = true
	}
	events := events(p, v.Checking, start, today, end, bal, typed, waiting)

	// What each does, to which accounts.
	sides := func(e *event) []side {
		if e.person != nil {
			to := e.person.Account
			if to == "" {
				to = v.Checking
			}
			out := []side{{to, e.person.Net}}
			for _, ded := range e.person.Deductions {
				if ded.Account != "" {
					out = append(out, side{ded.Account, ded.Amount})
				}
			}
			return out
		}
		from := e.pay.From
		if from == "" {
			from = v.Checking
		}
		out := []side{{from, -e.amt}}
		if e.pay.To != "" {
			out = append(out, side{e.pay.To, e.amt})
		}
		if e.pay.Card != "" && e.pay.Card != e.pay.To {
			out = append(out, side{e.pay.Card, e.amt})
		}
		return out
	}

	// Since: each one on or before today that a balance is taken to hold,
	// and each waiting.
	for i := range events {
		e := &events[i]
		if e.was.After(today) {
			break
		}
		past := Past{Key: e.key, Date: dateOf(e.was), Waiting: e.waiting, Typed: true}
		listed := e.waiting
		for _, s := range sides(e) {
			t, ok := typed[s.account]
			if !ok || e.waiting {
				continue
			}
			if e.was.Equal(t) {
				listed = true
			} else if t.Before(e.was) && e.was.Before(today) {
				listed, past.Typed = true, false
			}
		}
		if !listed {
			continue
		}
		if e.waiting {
			past.Typed = false
		}
		if e.person != nil {
			to := e.person.Account
			past.Person, past.Amount = e.person.ID, cents(e.person.Net)
			past.In = to == "" || to == v.Checking
			past.Outside = !past.In
		} else {
			from := e.pay.From
			past.Payment, past.Amount = e.pay.ID, cents(e.amt)
			past.In = from != "" && from != v.Checking && e.pay.To == v.Checking
			past.Outside = from != "" && from != v.Checking && !past.In
		}
		v.Since = append(v.Since, past)
	}

	// Checking's paydays ahead: a period starts at each.
	checks := 0
	for i := range events {
		e := &events[i]
		if e.person != nil && !e.day.Before(today) && counts(e, v.Checking) && (e.person.Account == "" || e.person.Account == v.Checking) {
			checks++
		}
	}

	// Each day: its paychecks, then its payments, then a day's interest.
	// Before today only what a balance does not hold yet counts. From today
	// a paycheck into checking closes the period before it and opens its
	// own, until there are periods after now; with none ahead, now runs a
	// month, so the payments still show. The chart goes on to its last day.
	var per *Period
	open := func(k string, pd *Payday, carried float64) {
		per = &Period{Now: pd == nil, Start: k, Pay: pd, Carried: cents(carried), Rows: []Row{}}
	}
	shut := func(d time.Time) {
		if per == nil {
			return
		}
		per.Last = dateOf(d.AddDate(0, 0, -1))
		per.In, per.Out, per.Saved = cents(per.In), cents(per.Out), cents(per.Saved)
		per.Left = cents(bal[v.Checking])
		per.Accounts = rounded(bal)
		v.Periods = append(v.Periods, *per)
		per = nil
	}
	monthOn := today.AddDate(0, 1, 0)
	next := 0
	for d := start; d.Before(end); d = d.AddDate(0, 0, 1) {
		k := dateOf(d)
		ahead := !d.Before(today)
		if d.Equal(today) {
			v.Start = rounded(bal)
		}
		var todays []*event
		for ; next < len(events) && !events[next].day.After(d); next++ {
			todays = append(todays, &events[next])
		}
		carried := bal[v.Checking] // before the day's paychecks
		// The day's paychecks: a payday, when anything of them counts. One
		// into checking closes the period before it, then they land.
		var pd *Payday
		into := false
		for _, e := range todays {
			if e.person == nil || !ahead {
				continue
			}
			counted := false
			for _, s := range sides(e) {
				counted = counted || counts(e, s.account)
			}
			if !counted {
				continue
			}
			if pd == nil {
				pd = &Payday{Date: k}
			}
			pd.People = append(pd.People, e.person.ID)
			pd.Total += e.person.Net
			if to := e.person.Account; (to == "" || to == v.Checking) && counts(e, v.Checking) {
				pd.Amount += e.person.Net
				into = true
			}
			if e.why != "" {
				pd.Moved = append(pd.Moved, Moved{Person: e.person.ID, From: dateOf(e.due), Why: e.why})
			}
		}
		if pd != nil {
			pd.Amount, pd.Total = cents(pd.Amount), cents(pd.Total)
			if len(v.Paydays) < periods {
				v.Paydays = append(v.Paydays, *pd)
			}
		}
		if into {
			shut(d)
		}
		for _, e := range todays {
			if e.person == nil {
				continue
			}
			for _, s := range sides(e) {
				if counts(e, s.account) {
					move(bal, kind, s.account, s.amount)
				}
			}
		}
		var ev []Event
		if ahead {
			if into {
				if len(v.Periods) <= periods {
					open(k, pd, carried)
				}
				ev = append(ev, Event{People: pd.People, Amount: pd.Amount})
			} else if d.Equal(today) {
				open(k, nil, carried)
			} else if checks == 0 && d.Equal(monthOn) {
				shut(d)
			}
			if per != nil && into {
				per.In += pd.Amount
			}
			if per == nil && len(v.Days) >= chartDays && len(v.Paydays) >= periods {
				break
			}
		}
		// The day's payments.
		for _, e := range todays {
			if e.pay == nil {
				continue
			}
			r, event, counted := pay(e, sides(e), bal, kind, v.Checking, func(a string) bool { return counts(e, a) })
			if !counted || !ahead {
				continue
			}
			r.Late = e.waiting && e.was.Before(today)
			if event != nil {
				ev = append(ev, *event)
			}
			if per == nil {
				continue
			}
			if r.Into {
				per.In += r.Amount
			} else if !r.Outside {
				per.Out += r.Amount
				if r.Saved {
					per.Saved += r.Amount
				}
			}
			per.Rows = append(per.Rows, r)
		}
		for _, a := range p.Accounts {
			if a.Rate > 0 && !Owed(a.Kind) && (ahead || d.After(typed[a.ID])) {
				bal[a.ID] += bal[a.ID] * a.Rate / 100 / 365
			}
		}
		if ahead && len(v.Days) < chartDays {
			v.Days = append(v.Days, Day{Date: k, Balance: cents(bal[v.Checking]), Events: ev})
		}
	}
	return v
}

// events are the paychecks (moved before a weekend or holiday) and
// payments from start to end, by the day each counts, paychecks first on
// a day and then the largest payment. One waiting (by its key, or a
// paycheck on Plan.NotYet's day) counts today. A card's first payment
// after its balance was typed in is what it owed then; the later ones the
// usual amount.
func events(p Plan, checking string, start, today, end time.Time, bal map[string]float64, typed map[string]time.Time, waiting map[string]bool) []event {
	var out []event
	add := func(e event) {
		e.day = e.was
		if e.waiting = waiting[e.key] && !e.was.After(today); e.waiting {
			e.day = today
		}
		out = append(out, e)
	}
	for i := range p.People {
		e := &p.People[i]
		for _, due := range e.Schedule.Dates(start.AddDate(0, 0, -10), end) {
			d, why := BankDayIn(due, p.Holidays)
			if d.Before(start) {
				continue
			}
			ev := event{was: d, key: "pay:" + e.ID + ":" + dateOf(d), person: e, why: why, due: due}
			add(ev)
			if p.NotYet == dateOf(d) && !d.After(today) {
				out[len(out)-1].waiting, out[len(out)-1].day = true, today
			}
		}
	}
	for i := range p.Payments {
		x := &p.Payments[i]
		first := true
		for _, d := range x.Schedule.Dates(start, end) {
			amt := x.Amount
			if t, ok := typed[x.Card]; x.Card != "" && first && (!ok || d.After(t)) {
				amt, first = bal[x.Card], false
			}
			// Nothing to pay (a card paid off, an amount left at 0): no row.
			if amt <= 0 {
				continue
			}
			add(event{was: d, key: "payment:" + x.ID + ":" + dateOf(d), pay: x, amt: amt})
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		a, b := out[i], out[j]
		if !a.day.Equal(b.day) {
			return a.day.Before(b.day)
		}
		if (a.person != nil) != (b.person != nil) {
			return a.person != nil
		}
		return a.amt > b.amt
	})
	return out
}

// pay moves one payment's sides that count: its row, its event on the
// chart when checking is in it, and whether anything counted at all.
func pay(e *event, sides []side, bal map[string]float64, kind map[string]string, checking string, counts func(string) bool) (Row, *Event, bool) {
	counted, inChecking := false, false
	for _, s := range sides {
		if !counts(s.account) {
			continue
		}
		move(bal, kind, s.account, s.amount)
		counted = true
		if s.account == checking && checking != "" {
			inChecking = true
		}
	}
	from := e.pay.From
	if from == "" {
		from = checking
	}
	r := Row{Date: dateOf(e.was), Payment: e.pay.ID, Amount: cents(e.amt), Estimate: e.pay.Estimate, After: cents(bal[checking]), Saved: Saving(kind[e.pay.To])}
	switch {
	case from == checking && (inChecking || checking == ""):
		return r, &Event{Payment: e.pay.ID, Amount: -r.Amount}, counted
	case e.pay.To == checking && inChecking:
		r.Into = true
		return r, &Event{Payment: e.pay.ID, Amount: r.Amount}, counted
	}
	r.Outside, r.After = true, 0
	return r, nil, counted
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

func cents(x float64) float64 { return math.Round(x*100) / 100 }

func rounded(m map[string]float64) map[string]float64 {
	out := make(map[string]float64, len(m))
	for k, v := range m {
		out[k] = cents(v)
	}
	return out
}
