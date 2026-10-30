// Package finance is the household's money plan: who gets paid and when,
// the accounts, and the payments that repeat. It is typed in by hand (no
// bank connection) and kept in the homelab folder, so the nightly backup
// takes it off-site with the other records, encrypted. Project reads it
// forward: each paycheck, what it pays, and what every account holds after.
package finance

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// Account kinds. Cards and loans hold what is owed; the rest what is there.
const (
	Checking   = "checking"
	Savings    = "savings"
	Card       = "card"
	Investment = "investment"
	Retirement = "retirement"
	Loan       = "loan"
	Home       = "home"
	Car        = "car"
	Other      = "other"
)

var kinds = map[string]bool{Checking: true, Savings: true, Card: true, Investment: true, Retirement: true, Loan: true, Home: true, Car: true, Other: true}

// Owed reports whether an account of this kind holds a debt.
func Owed(kind string) bool { return kind == Card || kind == Loan }

// Plan is everything the household typed in.
type Plan struct {
	People   []Earner  `json:"people"`
	Accounts []Account `json:"accounts"`
	Payments []Payment `json:"payments"`
	// Cushion is the least checking should hold; a paycheck that leaves less is flagged.
	Cushion float64 `json:"cushion"`
	// Updated is the day the balances were last typed in (YYYY-MM-DD): an
	// account's own Updated, when it has one, says when its balance was.
	Updated string `json:"updated,omitempty"`
	// Currency is how amounts are written, an ISO 4217 code (USD when empty).
	Currency string `json:"currency,omitempty"`
	// Holidays are the bank holidays a payday moves before: US (when
	// empty), UK (England and Wales), or None (weekends only).
	Holidays string `json:"holidays,omitempty"`
	// Waiting are paychecks and payments dated on or before today that the
	// balances do not have yet, by key (Past.Key): each comes today. Any
	// other one dated on the day its balance was typed in is taken to be in
	// it, and one dated after that and before today to have happened.
	Waiting []string `json:"waiting,omitempty"`
	// NotYet is a payday whose checks were not in the balances that day
	// (YYYY-MM-DD): what Waiting was before it. It is still read.
	NotYet string `json:"notYet,omitempty"`
}

// Holiday calendars a payday can follow.
const (
	US       = "us"
	UK       = "uk"
	Weekends = "none"
)

var currency = regexp.MustCompile(`^[A-Z]{3}$`)

// Earner is someone who gets paid.
type Earner struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Schedule Schedule `json:"schedule"`
	// Net is the take-home pay on each check.
	Net float64 `json:"net"`
	// Gross and the deductions are the pay stub, when typed in.
	Gross      float64     `json:"gross,omitempty"`
	Deductions []Deduction `json:"deductions,omitempty"`
	// Account is where the check lands (the first checking account when empty).
	Account string `json:"account,omitempty"`
}

// Deduction is a line on the pay stub. One with an account (a 401(k))
// adds to it on each paycheck.
type Deduction struct {
	Name    string  `json:"name"`
	Amount  float64 `json:"amount"`
	Account string  `json:"account,omitempty"`
}

// Account is a bank account, a card, an investment, a loan, or a thing owned.
type Account struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Kind string `json:"kind"`
	// Institution names the bank or brand, for its logo ("chase", "toyota").
	Institution string `json:"institution,omitempty"`
	// Balance is what is there, or for a card or loan what is owed; for a
	// home or car, what it is worth.
	Balance float64 `json:"balance"`
	// Pending is a card's charges not posted yet; they are owed too.
	Pending float64 `json:"pending,omitempty"`
	// Rate is the yearly interest in percent: a savings account earns it;
	// a loan, and a card not paid in full each time, are charged it.
	Rate float64 `json:"rate,omitempty"`
	// Original is a loan's starting amount, for how much is paid.
	Original float64 `json:"original,omitempty"`
	// Loan is the loan against a home or car, by its ID.
	Loan string `json:"loan,omitempty"`
	// Detail is a few words: the last four digits, a car's year and model, an address.
	Detail string `json:"detail,omitempty"`
	// Updated is the day the balance was last typed in (YYYY-MM-DD).
	Updated string `json:"updated,omitempty"`
}

// Owed is what a card or loan account is owed now (pending included).
func (a Account) Owed() float64 { return a.Balance + a.Pending }

// Payment is something that comes out on a schedule: a bill, a
// subscription, a card's payment, a transfer to savings.
type Payment struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Amount   float64  `json:"amount"`
	Schedule Schedule `json:"schedule"`
	// Kind is its category: home, utilities, car, subscriptions, loans, cards, spending, savings, other.
	Kind string `json:"kind,omitempty"`
	// Institution names the brand, for its logo ("netflix").
	Institution string `json:"institution,omitempty"`
	// Estimate marks an amount that changes (electric): about this much.
	Estimate bool `json:"estimate,omitempty"`
	// From is the account it comes out of (the first checking account when
	// empty), or a card it is charged to: the card owes it, and pays it.
	From string `json:"from,omitempty"`
	// To is an account it goes into: savings or a Roth IRA grow, a loan's debt shrinks.
	To string `json:"to,omitempty"`
	// Card is a card whose whole balance it pays: what the card owes on the
	// day. Amount is then the card's other spending, which the plan does not
	// list, from one payment to the next.
	Card string `json:"card,omitempty"`
}

// Path is the plan in the homelab folder; the nightly backup copies data/*.json.
func Path(root string) string { return filepath.Join(root, "data", "finance.json") }

// Load reads the plan; none yet is an empty plan.
func Load(path string) (Plan, error) {
	var p Plan
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return p, nil
	}
	if err != nil {
		return p, err
	}
	return p, json.Unmarshal(data, &p)
}

// Save checks the plan and writes it, readable by its owner only: it is
// the household's money. The file is replaced whole, so a write that
// fails partway leaves the last one.
func Save(path string, p Plan) (Plan, error) {
	p, err := Clean(p)
	if err != nil {
		return p, err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return p, err
	}
	data, _ := json.MarshalIndent(p, "", "  ")
	tmp := path + ".new"
	if err := os.WriteFile(tmp, append(data, '\n'), 0o600); err != nil {
		return p, err
	}
	return p, os.Rename(tmp, path)
}

var notID = regexp.MustCompile(`[^a-z0-9]+`)

// Clean trims names, gives anything without an ID one, and says what is
// wrong: a name left empty, an unknown kind or schedule, an account that
// does not exist.
func Clean(p Plan) (Plan, error) {
	used := map[string]bool{}
	id := func(have, name, prefix string) string {
		if have != "" && !used[have] {
			used[have] = true
			return have
		}
		base := strings.Trim(notID.ReplaceAllString(strings.ToLower(name), "-"), "-")
		if base == "" {
			base = prefix
		}
		out := base
		for i := 2; used[out]; i++ {
			out = fmt.Sprintf("%s-%d", base, i)
		}
		used[out] = true
		return out
	}
	for i := range p.Accounts {
		a := &p.Accounts[i]
		a.Name = strings.TrimSpace(a.Name)
		if a.Name == "" {
			return p, fmt.Errorf("an account has no name")
		}
		if !kinds[a.Kind] {
			return p, fmt.Errorf("%s: unknown kind %q", a.Name, a.Kind)
		}
		a.ID = id(a.ID, a.Name, "account")
	}
	accounts := map[string]Account{}
	for _, a := range p.Accounts {
		accounts[a.ID] = a
	}
	known := func(what, ref string, want ...string) error {
		if ref == "" {
			return nil
		}
		a, ok := accounts[ref]
		if !ok {
			return fmt.Errorf("%s: no account %q", what, ref)
		}
		if len(want) > 0 && !contains(want, a.Kind) {
			return fmt.Errorf("%s: %s is not a %s", what, a.Name, strings.Join(want, " or "))
		}
		return nil
	}
	for _, a := range p.Accounts {
		if err := known(a.Name, a.Loan, Loan); err != nil {
			return p, err
		}
	}
	for i := range p.People {
		e := &p.People[i]
		e.Name = strings.TrimSpace(e.Name)
		if e.Name == "" {
			return p, fmt.Errorf("someone who gets paid has no name")
		}
		if err := e.Schedule.check(e.Name); err != nil || e.Schedule.Every == Paycheck {
			if err == nil {
				err = fmt.Errorf("%s: paid with each paycheck is no schedule", e.Name)
			}
			return p, err
		}
		if err := known(e.Name, e.Account); err != nil {
			return p, err
		}
		for _, d := range e.Deductions {
			if err := known(e.Name+"'s "+d.Name, d.Account); err != nil {
				return p, err
			}
		}
		e.ID = id(e.ID, e.Name, "person")
	}
	paid := map[string]bool{}
	for _, e := range p.People {
		paid[e.ID] = true
	}
	for i := range p.Payments {
		x := &p.Payments[i]
		x.Name = strings.TrimSpace(x.Name)
		if x.Name == "" {
			return p, fmt.Errorf("a payment has no name")
		}
		if err := x.Schedule.check(x.Name); err != nil {
			return p, err
		}
		if x.Schedule.Every == Paycheck && !paid[x.Schedule.Person] {
			return p, fmt.Errorf("%s: no one %q is paid", x.Name, x.Schedule.Person)
		}
		for _, err := range []error{known(x.Name, x.From), known(x.Name, x.To), known(x.Name, x.Card, Card)} {
			if err != nil {
				return p, err
			}
		}
		if x.Card != "" && x.Card == x.From {
			return p, fmt.Errorf("%s: a card cannot pay itself off", x.Name)
		}
		x.ID = id(x.ID, x.Name, "payment")
	}
	if p.Cushion < 0 {
		p.Cushion = 0
	}
	if p.Holidays != "" && p.Holidays != US && p.Holidays != UK && p.Holidays != Weekends {
		return p, fmt.Errorf("unknown bank holidays %q", p.Holidays)
	}
	p.Currency = strings.ToUpper(strings.TrimSpace(p.Currency))
	if p.Currency != "" && !currency.MatchString(p.Currency) {
		return p, fmt.Errorf("unknown currency %q", p.Currency)
	}
	return p, nil
}

// Dates are the days a schedule comes from from through to: its own, or
// with each paycheck, the days that person is paid (moved before a weekend
// or holiday).
func (p Plan) Dates(s Schedule, from, to time.Time) []time.Time {
	if s.Every != Paycheck {
		return s.Dates(from, to)
	}
	var out []time.Time
	for _, e := range p.People {
		if e.ID != s.Person {
			continue
		}
		for _, due := range e.Schedule.Dates(from.AddDate(0, 0, -10), to) {
			if d, _ := BankDayIn(due, p.Holidays); !d.Before(from) && !d.After(to) {
				out = append(out, d)
			}
		}
	}
	return out
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

// day reads a YYYY-MM-DD date at midnight in loc.
func day(s string, loc *time.Location) (time.Time, error) {
	return time.ParseInLocation("2006-01-02", s, loc)
}

// dateOf is t's day, YYYY-MM-DD.
func dateOf(t time.Time) string { return t.Format("2006-01-02") }
