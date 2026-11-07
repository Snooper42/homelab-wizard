package finance

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"
)

// moneyIn is checking at $1,000 typed in on Nov 7, a paycheck of $2,000
// every other Friday from Nov 6, a mortgage of $1,800 on the 1st, and a
// share of it, $900, sent by someone outside the household on the 15th.
func moneyIn() Plan {
	return Plan{
		People: []Earner{{ID: "sam", Name: "Sam", Net: 2000, Schedule: Schedule{Every: Biweekly, Start: "2026-11-06"}}},
		Accounts: []Account{
			{ID: "chk", Name: "Checking", Kind: Checking, Balance: 1000, Updated: "2026-11-07"},
			{ID: "sav", Name: "Savings", Kind: Savings, Balance: 5000, Updated: "2026-11-07"},
		},
		Payments: []Payment{
			{ID: "mortgage", Name: "Mortgage", Amount: 1800, Kind: "home", Schedule: Schedule{Every: Monthly, Start: "2026-01-01"}},
			{ID: "share", Name: "Mortgage share", Amount: 900, Kind: "home", Payer: "Jamie", Schedule: Schedule{Every: Monthly, Start: "2026-01-15"}},
		},
	}
}

// Money in from someone outside the household lands in checking on its
// day: it adds, takes nothing from any account, and starts no pay period.
func TestMoneyInFromOutside(t *testing.T) {
	v := Project(moneyIn(), date("2026-11-07"), Ahead)
	now := v.Periods[0]
	if !now.Now || now.Last != "2026-11-19" || now.In != 900 || now.Out != 0 || now.Left != 1900 {
		t.Fatalf("now: in %v, out %v, left %v, last %s", now.In, now.Out, now.Left, now.Last)
	}
	if r := now.Rows; len(r) != 1 || r[0].Payment != "share" || !r[0].Into || r[0].Outside || r[0].Amount != 900 || r[0].After != 1900 || r[0].Date != "2026-11-15" {
		t.Fatalf("now's rows: %+v", r)
	}
	// No period of its own: the next is the paycheck's.
	if p := v.Periods[1]; p.Pay == nil || p.Pay.Date != "2026-11-20" || p.Carried != 1900 {
		t.Fatalf("the next period: %+v", p)
	}
	if v.AfterPay == nil || v.AfterPay.Result != 3900 {
		t.Fatalf("after the paycheck: %+v", v.AfterPay)
	}
	for _, d := range v.Days {
		if d.Date == "2026-11-15" && (d.Balance != 1900 || len(d.Events) != 1 || d.Events[0].Amount != 900) {
			t.Fatalf("Nov 15: %+v", d)
		}
	}
	// Savings is not touched.
	if v.Periods[1].Accounts["sav"] != 5000 {
		t.Fatalf("savings: %v", v.Periods[1].Accounts["sav"])
	}
	// The calendar feed names it, and who it is from.
	ics := string(ICS(v, true, time.Date(2026, 11, 7, 0, 0, 0, 0, time.UTC), func(n float64) string { return fmt.Sprintf("$%.0f", n) }))
	if !strings.Contains(ics, "SUMMARY:Mortgage share from Jamie $900") {
		t.Fatalf("calendar:\n%s", ics)
	}
}

// Into savings, it grows savings and leaves checking as it was.
func TestMoneyInToSavings(t *testing.T) {
	p := moneyIn()
	p.Payments[1].To = "sav"
	v := Project(p, date("2026-11-07"), Ahead)
	if now := v.Periods[0]; now.In != 0 || now.Left != 1000 || now.Accounts["sav"] != 5900 || len(now.Rows) != 1 || !now.Rows[0].Outside {
		t.Fatalf("into savings: %+v", now)
	}
}

// A share on the day the balances were typed in is taken as there already
// when the household says so, as a bill is; on its own it is counted.
func TestMoneyInSince(t *testing.T) {
	p := moneyIn()
	p.Accounts[0].Updated = "2026-11-15"
	v := Project(p, date("2026-11-16"), Ahead)
	if s := v.Since; len(s) != 1 || s[0].Payment != "share" || !s[0].In || v.Start["chk"] != 1900 {
		t.Fatalf("since: %+v, start %v", s, v.Start["chk"])
	}
}

// Who pays it is optional: a plan without it loads as it was. One from
// outside comes out of no account of the household's, so it has no From
// or card to pay.
func TestCleanPayer(t *testing.T) {
	var p Plan
	if err := json.Unmarshal([]byte(`{"accounts":[{"id":"chk","name":"Checking","kind":"checking","balance":1}],"payments":[{"id":"rent","name":"Rent","amount":10,"schedule":{"every":"month","start":"2026-01-01"}}]}`), &p); err != nil {
		t.Fatal(err)
	}
	c, err := Clean(p)
	if err != nil || c.Payments[0].Payer != "" {
		t.Fatalf("clean: %v %+v", err, c.Payments)
	}
	if b, _ := json.Marshal(c.Payments[0]); strings.Contains(string(b), "payer") {
		t.Fatalf("an empty payer is written: %s", b)
	}
	q := moneyIn()
	q.Payments[1].Payer = "  Jamie "
	if c, err := Clean(q); err != nil || c.Payments[1].Payer != "Jamie" {
		t.Fatalf("clean: %v %+v", err, c.Payments[1])
	}
	q.Payments[1].From = "sav"
	if _, err := Clean(q); err == nil || !strings.Contains(err.Error(), "Jamie") {
		t.Fatalf("from Jamie and out of savings: %v", err)
	}
}
