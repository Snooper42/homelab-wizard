package finance

import (
	"fmt"
	"math"
	"regexp"
	"strings"
)

// An account may be kept in a currency of its own (a euro account, a
// pension in pounds): its balance, what is pending, a loan's original, a
// card's spending, its history, and its transactions are all in that
// currency. Finances reads ahead in the plan's currency, each such amount
// at the plan's Rates: how much of the plan's currency one of that currency
// is, typed in by the household. No rate is ever fetched from the
// internet; the plan as saved keeps every amount as it was typed.

// currencyCode is an ISO 4217 code: three letters.
var currencyCode = regexp.MustCompile(`^[A-Z]{3}$`)

// home is the plan's own currency: its Currency, or USD when it has none.
func (p Plan) home() string {
	if c := strings.ToUpper(strings.TrimSpace(p.Currency)); c != "" {
		return c
	}
	return "USD"
}

// cleanCurrencies tidies each account's currency (none when it is the
// plan's) and the rates: codes in capitals, a rate for every currency an
// account is kept in, each more than nothing. A rate no account uses is
// kept, so an account moved back to it finds it.
func cleanCurrencies(p *Plan) error {
	home := p.home()
	rates := map[string]float64{}
	for code, r := range p.Rates {
		code = strings.ToUpper(strings.TrimSpace(code))
		if !currencyCode.MatchString(code) {
			return fmt.Errorf("a rate for %q, which is no currency (three letters, as EUR)", code)
		}
		if code == home {
			continue
		}
		if !(r > 0) || math.IsInf(r, 0) {
			return fmt.Errorf("the rate for %s is %v: type how many %s one %s is", code, r, home, code)
		}
		rates[code] = r
	}
	for i := range p.Accounts {
		a := &p.Accounts[i]
		a.Currency = strings.ToUpper(strings.TrimSpace(a.Currency))
		if a.Currency == home {
			a.Currency = ""
		}
		if a.Currency == "" {
			continue
		}
		if !currencyCode.MatchString(a.Currency) {
			return fmt.Errorf("%s: %q is no currency (three letters, as EUR)", a.Name, a.Currency)
		}
		if rates[a.Currency] == 0 {
			return fmt.Errorf("%s is in %s: type how many %s one %s is", a.Name, a.Currency, home, a.Currency)
		}
	}
	p.Rates = nil
	if len(rates) > 0 {
		p.Rates = rates
	}
	return nil
}

// rateOf is how much of the plan's currency one of an account's is: 1 for
// the plan's own.
func (p Plan) rateOf(a Account) float64 {
	if a.Currency == "" {
		return 1
	}
	if r := p.Rates[a.Currency]; r > 0 {
		return r
	}
	return 1
}

// inHome is the plan with every account's amounts in the plan's currency,
// for reading ahead; the accounts keep their currency's name.
func (p Plan) inHome() Plan {
	if len(p.Rates) == 0 {
		return p
	}
	accounts := make([]Account, len(p.Accounts))
	for i, a := range p.Accounts {
		r := p.rateOf(a)
		if r != 1 {
			a.Balance, a.Pending, a.Original, a.Spend = cents(a.Balance*r), cents(a.Pending*r), cents(a.Original*r), cents(a.Spend*r)
			h := make([]Point, len(a.History))
			for j, x := range a.History {
				h[j] = Point{Date: x.Date, Amount: cents(x.Amount * r)}
			}
			a.History = h
		}
		accounts[i] = a
	}
	p.Accounts = accounts
	return p
}

// inHome is the ledger with each transaction on an account kept in another
// currency in the plan's, parts and all.
func (l Ledger) inHome(p Plan) Ledger {
	if len(p.Rates) == 0 {
		return l
	}
	rate := map[string]float64{}
	for _, a := range p.Accounts {
		rate[a.ID] = p.rateOf(a)
	}
	out := make([]Transaction, len(l.Transactions))
	for i, t := range l.Transactions {
		if r := rate[t.Account]; r != 0 && r != 1 {
			t.Amount = cents(t.Amount * r)
			if len(t.Splits) > 0 {
				s := make([]Split, len(t.Splits))
				for j, x := range t.Splits {
					x.Amount = cents(x.Amount * r)
					s[j] = x
				}
				t.Splits = s
			}
		}
		out[i] = t
	}
	l.Transactions = out
	return l
}
