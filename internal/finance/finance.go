// Package finance is the household's money plan: who gets paid and when,
// the accounts, and the payments that repeat. It is typed in by hand (no
// bank connection) and kept in the homelab folder, so the nightly backup
// takes it off-site with the other records, encrypted. Project reads it
// forward: each paycheck, what it pays, and what every account holds after.
package finance

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

// Account kinds. Cards and loans hold what is owed; the rest what is there.
// A home, a car, and collectibles (cards, jewelry, art) are worth what is
// typed in, and no payment comes out of them or goes into them.
const (
	Checking    = "checking"
	Savings     = "savings"
	Card        = "card"
	Investment  = "investment"
	Retirement  = "retirement"
	Loan        = "loan"
	Home        = "home"
	Car         = "car"
	Collectible = "collectible"
	Other       = "other"
)

var kinds = map[string]bool{Checking: true, Savings: true, Card: true, Investment: true, Retirement: true, Loan: true, Home: true, Car: true, Collectible: true, Other: true}

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
	// Rates are how much of Currency one of another currency is, by its
	// code ({"EUR": 1.08}), typed in: for an account kept in that one.
	Rates map[string]float64 `json:"rates,omitempty"`
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
	// Logos are the household's own images for a brand, by its key ("chase"),
	// or for a payment or account with none, by "name:" and its name in
	// lower case: a small PNG, JPEG, or WebP as a data URL, made on the
	// device from a file picked there, so no logo is ever fetched.
	Logos map[string]string `json:"logos,omitempty"`
	// Categories are what transactions are sorted into, each named once,
	// some under a group (Groceries under Food), each with an icon. None
	// typed in, the screen offers DefaultCategories.
	Categories []Category `json:"categories,omitempty"`
	// Budgets are how much a category may take a month or a paycheck.
	Budgets []Budget `json:"budgets,omitempty"`
	// Goals are money put by for something, from shares of the accounts.
	Goals []Goal `json:"goals,omitempty"`
	// Rev is the file as it was read (never written to it): Save refuses
	// a plan read before another device saved, so one edit cannot quietly
	// undo another. Empty skips the check.
	Rev string `json:"rev,omitempty"`
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
	// History is the balance on each day one was typed in, oldest first:
	// what was there, or for a card or loan what was owed (pending
	// included). Clean keeps it, from Updated and the balance.
	History []Point `json:"history,omitempty"`
	// PaidEach is a card paid off in full with each paycheck into
	// checking, whoever is paid; Spend is about how much goes on it
	// between paychecks. The payoff is a payment of its own as Finances
	// reads ahead (Plan.WithCards), never one saved in the plan.
	PaidEach bool    `json:"paidEach,omitempty"`
	Spend    float64 `json:"spend,omitempty"`
	// Currency is the one it is kept in, when not the plan's (EUR): its
	// amounts, and its transactions', are in it (currency.go).
	Currency string `json:"currency,omitempty"`
	// Bought is what a car cost, BoughtOn the day, and Holds how well it
	// keeps its value ("holds", "fast", or none for most cars): Finances
	// reads its worth today from them (cars.go).
	Bought   float64 `json:"bought,omitempty"`
	BoughtOn string  `json:"boughtOn,omitempty"`
	Holds    string  `json:"holds,omitempty"`
}

// Point is an amount on a day (YYYY-MM-DD).
type Point struct {
	Date   string  `json:"date"`
	Amount float64 `json:"amount"`
}

// keptDays is how many days of an account's History are kept: ten years of daily updates.
const keptDays = 3660

// record puts the account's balance on its Updated day in its History,
// in place of what that day had.
func (a *Account) record() {
	if _, err := day(a.Updated, time.UTC); err != nil {
		return
	}
	amount := a.Balance
	if a.Kind == Card {
		amount = a.Owed()
	}
	pt := Point{a.Updated, amount}
	at := sort.Search(len(a.History), func(i int) bool { return a.History[i].Date >= a.Updated })
	switch {
	case at < len(a.History) && a.History[at].Date == a.Updated:
		a.History[at] = pt
	default:
		a.History = append(a.History, Point{})
		copy(a.History[at+1:], a.History[at:])
		a.History[at] = pt
	}
	if n := len(a.History); n > keptDays {
		a.History = a.History[n-keptDays:]
	}
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
	// Type is what a subscription is for: streaming, software, cloud,
	// gaming, news, fitness, food, phone, or other. Empty, the screen
	// suggests one from its brand or name. One this version does not know
	// is kept as it is, so a newer one's choice survives a save here.
	Type string `json:"type,omitempty"`
}

// Path is the plan in the homelab folder; the nightly backup copies data/*.json.
func Path(root string) string { return filepath.Join(root, "data", "finance.json") }

// Load reads the plan; none yet is an empty plan.
func Load(path string) (Plan, error) {
	var p Plan
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		p.Rev = noFile
		return p, nil
	}
	if err != nil {
		return p, err
	}
	err = json.Unmarshal(data, &p)
	p.Rev = rev(data)
	return p, err
}

// noFile is the Rev of a plan read before there was a file.
const noFile = "new"

// rev names a version of the file: the start of its SHA-256.
func rev(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:8])
}

var saving sync.Mutex

// ErrChanged is a save of a plan read before another device saved its own.
var ErrChanged = errors.New("Finances were changed on another device after this was read. The latest is shown now: check your change and save it again")

// Save checks the plan and writes it, readable by its owner only: it is
// the household's money. The file is replaced whole, so a write that
// fails partway leaves the last one. A plan whose Rev is not the file's
// is refused with ErrChanged; the plan saved comes back with its new Rev.
func Save(path string, p Plan) (Plan, error) {
	p, err := Clean(p)
	if err != nil {
		return p, err
	}
	was := p.Rev
	p.Rev = ""
	data, _ := json.MarshalIndent(p, "", "  ")
	p.Rev, err = write(path, was, data)
	if err != nil {
		p.Rev = was
	}
	return p, err
}

// write replaces a Finances file with data, owner-only, when the file is
// still the one read (its rev was), or with no rev to check; it returns
// the new rev. The computer's app and the phones' server each save;
// within one, a save is checked and written before the next is.
func write(path, was string, data []byte) (string, error) {
	saving.Lock()
	defer saving.Unlock()
	if was != "" {
		now := noFile
		if old, err := os.ReadFile(path); err == nil {
			now = rev(old)
		} else if !os.IsNotExist(err) {
			return "", err
		}
		if now != was {
			return "", ErrChanged
		}
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return "", err
	}
	data = append(data, '\n')
	tmp := path + ".new"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return "", err
	}
	return rev(data), os.Rename(tmp, path)
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
		// Paid off with each paycheck is a card's alone; spending is never below nothing.
		if a.Kind != Card {
			a.PaidEach, a.Spend = false, 0
		}
		a.Spend = math.Max(0, a.Spend)
		if err := cleanCar(a); err != nil {
			return p, err
		}
		a.ID = id(a.ID, a.Name, "account")
		sort.SliceStable(a.History, func(i, j int) bool { return a.History[i].Date < a.History[j].Date })
		a.record()
	}
	if err := cleanCurrencies(&p); err != nil {
		return p, err
	}
	if err := cleanGoals(&p, id); err != nil {
		return p, err
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
		if x.Schedule.Every == Paycheck && x.Schedule.Person != "" && !paid[x.Schedule.Person] {
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
		if a := accounts[x.Card]; x.Card != "" && a.PaidEach {
			return p, fmt.Errorf("%s: %s is paid off with each paycheck already; turn that off on the card, or delete this payment", x.Name, a.Name)
		}
		x.Type = strings.ToLower(strings.TrimSpace(x.Type))
		x.ID = id(x.ID, x.Name, "payment")
	}
	if p.Cushion < 0 {
		p.Cushion = 0
	}
	// An image of one's own is a small picture as a data URL, or it is dropped
	// (from a map of its own: the caller's plan stays as it was).
	var logos map[string]string
	for k, img := range p.Logos {
		if strings.TrimSpace(k) != "" && len(img) <= MaxLogo && ownLogo.MatchString(img) {
			if logos == nil {
				logos = map[string]string{}
			}
			logos[k] = img
		}
	}
	p.Logos = logos
	cats, err := cleanCategories(p.Categories)
	if err != nil {
		return p, err
	}
	p.Categories = cats
	if p.Budgets, err = cleanBudgets(p.Budgets); err != nil {
		return p, err
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
	checking := ""
	for _, a := range p.Accounts {
		if a.Kind == Checking {
			checking = a.ID
			break
		}
	}
	var out []time.Time
	seen := map[time.Time]bool{}
	for _, e := range p.People {
		// Someone's own, or with no one named, each paycheck into checking (two on a day are one day).
		if s.Person != "" && e.ID != s.Person || s.Person == "" && e.Account != "" && e.Account != checking {
			continue
		}
		for _, due := range e.Schedule.Dates(from.AddDate(0, 0, -10), to) {
			if d, _ := BankDayIn(due, p.Holidays); !d.Before(from) && !d.After(to) && !seen[d] {
				seen[d] = true
				out = append(out, d)
			}
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Before(out[j]) })
	return out
}

// MaxLogo is the most an image of one's own may take in the file: the
// screen makes it 96 pixels square, which comes to far less.
const MaxLogo = 64 << 10

// ownLogo is an image of one's own: a PNG, JPEG, or WebP data URL, nothing that can run.
var ownLogo = regexp.MustCompile(`^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$`)

// CardID is the ID of a card's payoff with each paycheck (Account.PaidEach).
func CardID(card string) string { return "card:" + card }

// WithCards is the plan's payments and, for each card paid off in full
// with each paycheck, its payoff: the card's whole balance on each payday
// into checking, its spending in between estimated at Spend.
func (p Plan) WithCards() []Payment {
	out := append([]Payment{}, p.Payments...)
	for _, a := range p.Accounts {
		if a.Kind == Card && a.PaidEach {
			out = append(out, Payment{ID: CardID(a.ID), Name: a.Name, Amount: a.Spend, Kind: "cards", Institution: a.Institution, Card: a.ID, Schedule: Schedule{Every: Paycheck}})
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
