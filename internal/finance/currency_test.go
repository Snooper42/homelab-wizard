package finance

import (
	"math"
	"strings"
	"testing"
)

// An account's currency is tidied (none when it is the plan's) and needs a
// rate, typed in and more than nothing; the rates are kept by their codes
// in capitals, the plan's own left out.
func TestCleanCurrencies(t *testing.T) {
	p := household()
	p.Accounts[3].Currency = " eur "
	if _, err := Clean(p); err == nil || !strings.Contains(err.Error(), "401(k) is in EUR: type how many USD one EUR is") {
		t.Fatalf("no rate: %v", err)
	}
	p.Rates = map[string]float64{"eur": 1.08, "USD": 1, "GBP": 1.27}
	p.Accounts[0].Currency = "usd"
	got, err := Clean(p)
	if err != nil {
		t.Fatal(err)
	}
	if got.Accounts[3].Currency != "EUR" || got.Accounts[0].Currency != "" || len(got.Rates) != 2 || got.Rates["EUR"] != 1.08 || got.Rates["GBP"] != 1.27 {
		t.Fatalf("cleaned %q %q %v", got.Accounts[3].Currency, got.Accounts[0].Currency, got.Rates)
	}
	// A plan in euros: a euro account is the plan's own, a dollar one needs a rate.
	p = household()
	p.Currency, p.Accounts[0].Currency, p.Accounts[1].Currency = "EUR", "eur", "USD"
	p.Rates = map[string]float64{"USD": 0.93}
	if got, err := Clean(p); err != nil || got.Accounts[0].Currency != "" || got.Accounts[1].Currency != "USD" {
		t.Fatalf("a plan in euros: %+v %v", got.Accounts[:2], err)
	}
	for _, c := range []struct {
		rates    map[string]float64
		currency string
		want     string
	}{
		{map[string]float64{"EUR": 0}, "EUR", "the rate for EUR is 0"},
		{map[string]float64{"EUR": -1.1}, "EUR", "the rate for EUR is -1.1"},
		{map[string]float64{"EURO": 1.1}, "EUR", "which is no currency"},
		{map[string]float64{"EUR": 1.1}, "EURO", `"EURO" is no currency`},
		{map[string]float64{"EUR": math.Inf(1)}, "EUR", "the rate for EUR"},
	} {
		p := household()
		p.Rates, p.Accounts[3].Currency = c.rates, c.currency
		if _, err := Clean(p); err == nil || !strings.Contains(err.Error(), c.want) {
			t.Errorf("%v, %s: %v", c.rates, c.currency, err)
		}
	}
}

// Read ahead, an account in euros counts at the rate, its history and its
// transactions too; the plan the screen keeps is as typed. A transfer
// between two currencies is refused: the same amount would not arrive.
func TestProjectInTwoCurrencies(t *testing.T) {
	p := household()
	p.Updated = "2026-10-28"
	p.Accounts[3].Currency = "EUR"
	p.Accounts[3].History = []Point{{Date: "2026-09-30", Amount: 38000}}
	p.Rates = map[string]float64{"EUR": 1.1}
	p, err := Clean(p)
	if err != nil {
		t.Fatal(err)
	}
	today := date("2026-11-02")
	near := func(a, b float64) bool { return math.Abs(a-b) < 0.02 }
	v := Project(p, today, 4)
	if !near(v.Start["k401"], 42350) || v.Plan.Accounts[3].Balance != 38500 || v.Plan.Accounts[3].History[0].Amount != 38000 {
		t.Fatalf("the 401(k) in euros: %v today, %v kept, history %v", v.Start["k401"], v.Plan.Accounts[3].Balance, v.Plan.Accounts[3].History)
	}
	one := household()
	one.Updated = p.Updated
	plain := Project(one, today, 4)
	if !near(v.Start["chk"], plain.Start["chk"]) {
		t.Errorf("checking moved with the rate: %v, plain %v", v.Start["chk"], plain.Start["chk"])
	}
	// €100 in on Oct 30, after the balance was typed: $110 more.
	w := ProjectWith(p, Ledger{Transactions: []Transaction{{Date: "2026-10-30", Account: "k401", Amount: 100, Splits: []Split{{Category: "Match", Amount: 60}, {Category: "Gain", Amount: 40}}}}}, today, 4)
	if !near(w.Start["k401"], 42460) {
		t.Errorf("€100 in: %v", w.Start["k401"])
	}
	if in := p.inHome(); in.Accounts[3].History[0].Amount != 41800 {
		t.Errorf("history in dollars: %v", in.Accounts[3].History)
	}
	if l := (Ledger{Transactions: []Transaction{{Account: "k401", Amount: 100, Splits: []Split{{Amount: 60}, {Amount: 40}}}}}).inHome(p); l.Transactions[0].Splits[0].Amount != 66 || l.Transactions[0].Amount != 110 {
		t.Errorf("a transaction in dollars: %+v", l.Transactions[0])
	}
	if _, err := CleanLedger(Ledger{Transactions: []Transaction{{Date: "2026-10-30", Account: "chk", To: "k401", Amount: -100}}}, p); err == nil || !strings.Contains(err.Error(), "two currencies") {
		t.Errorf("a transfer between two currencies: %v", err)
	}
	if _, err := CleanLedger(Ledger{Transactions: []Transaction{{Date: "2026-10-30", Account: "chk", To: "sav", Amount: -100}}}, p); err != nil {
		t.Errorf("a transfer in one currency: %v", err)
	}
	// No rates: nothing is copied or changed.
	q := household()
	if in := q.inHome(); &in.Accounts[0] != &q.Accounts[0] {
		t.Error("a plan in one currency was copied to be read")
	}
}
