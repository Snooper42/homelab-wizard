package finance

import (
	"reflect"
	"testing"
)

// working is a household with checking typed in a few days ago, a bill
// since then, one before payday, one on payday, a coffee in the ledger,
// and a paycheck every other Friday.
func working() (Plan, Ledger) {
	p := Plan{
		People: []Earner{{ID: "sam", Name: "Sam", Net: 2000, Schedule: Schedule{Every: Biweekly, Start: "2026-10-30"}}},
		Accounts: []Account{
			{ID: "chk", Name: "Checking", Kind: Checking, Balance: 1000, Updated: "2026-11-03"},
		},
		Payments: []Payment{
			{ID: "phone", Name: "Phone", Amount: 100, Schedule: Schedule{Every: Monthly, Start: "2026-01-05"}},
			{ID: "power", Name: "Electric", Amount: 150, Schedule: Schedule{Every: Monthly, Start: "2026-01-09"}},
			{ID: "water", Name: "Water", Amount: 50, Schedule: Schedule{Every: Monthly, Start: "2026-01-13"}},
		},
	}
	l := Ledger{Transactions: []Transaction{{ID: "t1", Date: "2026-11-06", Account: "chk", Amount: -20, Payee: "Coffee"}}}
	return p, l
}

// Checking now and checking once the next paycheck is in each say how
// they were reached: the balance they start from, each row in and out,
// and the result, so the household can hold them next to their own sums.
func TestWorking(t *testing.T) {
	p, l := working()
	v := ProjectWith(p, l, date("2026-11-07"), Ahead)

	now := v.CheckingNow
	want := &Working{Date: "2026-11-07", From: "2026-11-03", Start: 1000, Result: 880, Steps: []Step{
		{Date: "2026-11-05", Payment: "phone", Amount: -100, After: 900},
		{Date: "2026-11-06", Transaction: "t1", Name: "Coffee", Amount: -20, After: 880},
	}}
	if !reflect.DeepEqual(now, want) {
		t.Fatalf("checking now:\n got %+v\nwant %+v", now, want)
	}
	if now.Result != v.Start["chk"] {
		t.Fatalf("checking now is %v, the day's start %v", now.Result, v.Start["chk"])
	}

	// Payday is the 13th: the bill due that day comes out of this paycheck,
	// after it lands, so it is not in the figure.
	pay := v.AfterPay
	want = &Working{Date: "2026-11-13", From: "2026-11-07", Start: 880, Result: 2730, Steps: []Step{
		{Date: "2026-11-09", Payment: "power", Amount: -150, After: 730},
		{Date: "2026-11-13", People: []string{"sam"}, Amount: 2000, After: 2730},
	}}
	if !reflect.DeepEqual(pay, want) {
		t.Fatalf("after the paycheck:\n got %+v\nwant %+v", pay, want)
	}
	// It is the next period's start with its paycheck in.
	next := v.Periods[1]
	if got := cents(next.Carried + next.Pay.Amount); got != pay.Result || next.Pay.Date != pay.Date {
		t.Fatalf("period %s: carried %v + %v, want %v", next.Start, next.Carried, next.Pay.Amount, pay.Result)
	}
}

// With no paycheck ahead there is no figure for after it; checking now still says how.
func TestWorkingWithoutPaychecks(t *testing.T) {
	p, l := working()
	p.People = nil
	v := ProjectWith(p, l, date("2026-11-07"), Ahead)
	if v.AfterPay != nil {
		t.Fatalf("after a paycheck that never comes: %+v", v.AfterPay)
	}
	if v.CheckingNow == nil || v.CheckingNow.Result != 880 {
		t.Fatalf("checking now: %+v", v.CheckingNow)
	}
}

// A balance typed in today has nothing since: checking now is it.
func TestWorkingTypedToday(t *testing.T) {
	p, _ := working()
	p.Accounts[0].Updated = "2026-11-07"
	v := Project(p, date("2026-11-07"), Ahead)
	if w := v.CheckingNow; w == nil || len(w.Steps) != 0 || w.Start != 1000 || w.Result != 1000 || w.From != "2026-11-07" {
		t.Fatalf("checking now: %+v", w)
	}
}
