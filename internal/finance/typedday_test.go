package finance

import (
	"encoding/json"
	"testing"
)

// typedDay is checking at $1,000 typed in on Nov 10, an electric bill of
// $150 due that day, and a paycheck of $2,000 every other Friday from Nov 6.
func typedDay(updated string) Plan {
	return Plan{
		People:   []Earner{{ID: "sam", Name: "Sam", Net: 2000, Schedule: Schedule{Every: Biweekly, Start: "2026-11-06"}}},
		Accounts: []Account{{ID: "chk", Name: "Checking", Kind: Checking, Balance: 1000, Updated: updated}},
		Payments: []Payment{{ID: "power", Name: "Electric", Amount: 150, Schedule: Schedule{Every: Monthly, Start: "2026-01-10"}}},
	}
}

// A bill due the day the balances were typed in still comes out, unless
// the household says the balance has it already (Plan.InBalance).
func TestBillOnTheDayTypedComesOut(t *testing.T) {
	// Typed in today: it comes out today, after the start of the day.
	v := Project(typedDay("2026-11-10"), date("2026-11-10"), Ahead)
	if v.Start["chk"] != 1000 || v.Days[0].Balance != 850 {
		t.Fatalf("typed today: start %v, end of today %v, want 1000 and 850", v.Start["chk"], v.Days[0].Balance)
	}
	if r := v.Periods[0].Rows; len(r) != 1 || r[0].Payment != "power" || r[0].Amount != 150 || r[0].Date != "2026-11-10" {
		t.Fatalf("now's rows: %+v", r)
	}
	// It is listed, so the household can say the balance has it.
	if s := v.Since; len(s) != 1 || s[0].Key != "payment:power:2026-11-10" || !s[0].Typed || s[0].InBalance {
		t.Fatalf("since: %+v", s)
	}

	// The same as typed in the day before: it was never a question.
	if v := Project(typedDay("2026-11-09"), date("2026-11-10"), Ahead); v.Days[0].Balance != 850 {
		t.Fatalf("typed the day before: end of today %v, want 850", v.Days[0].Balance)
	}

	// Typed in two days ago: it came out that day, so checking now has it.
	v = Project(typedDay("2026-11-10"), date("2026-11-12"), Ahead)
	if v.Start["chk"] != 850 || v.CheckingNow.Result != 850 || len(v.CheckingNow.Steps) != 1 || v.CheckingNow.Steps[0].Payment != "power" {
		t.Fatalf("typed two days ago: start %v, working %+v", v.Start["chk"], v.CheckingNow)
	}

	// Said to be in the balance: nothing more comes out, and it says so.
	p := typedDay("2026-11-10")
	p.InBalance = []string{"payment:power:2026-11-10"}
	v = Project(p, date("2026-11-10"), Ahead)
	if v.Days[0].Balance != 1000 || len(v.Periods[0].Rows) != 0 {
		t.Fatalf("in the balance: end of today %v, rows %+v", v.Days[0].Balance, v.Periods[0].Rows)
	}
	if s := v.Since; len(s) != 1 || !s[0].InBalance || !s[0].Typed {
		t.Fatalf("in the balance, since: %+v", s)
	}
	// Only that day's: next month's still comes out.
	if after := v.AfterPay; after == nil || after.Result != 3000 {
		t.Fatalf("after the paycheck: %+v", after)
	}
	for _, per := range v.Periods {
		for _, r := range per.Rows {
			if r.Date == "2026-12-10" {
				return
			}
		}
	}
	t.Fatal("December's bill went too")
}

// A paycheck on the day the balances were typed in is still taken to be
// in them: balances are typed once the money is there, and counting it
// again would add a whole paycheck.
func TestPaycheckOnTheDayTypedIsInIt(t *testing.T) {
	p := typedDay("2026-11-06")
	v := Project(p, date("2026-11-06"), Ahead)
	if v.Start["chk"] != 1000 || v.Days[0].Balance != 1000 || !v.Periods[0].Now {
		t.Fatalf("payday typed: start %v, end of day %v, first period %+v", v.Start["chk"], v.Days[0].Balance, v.Periods[0])
	}
	// Still Not yet makes it come today.
	p.Waiting = []string{"pay:sam:2026-11-06"}
	if v := Project(p, date("2026-11-06"), Ahead); v.Days[0].Balance != 3000 {
		t.Fatalf("payday, not yet: end of day %v", v.Days[0].Balance)
	}
}

// A plan saved before InBalance loads and saves as it was.
func TestInBalanceOptional(t *testing.T) {
	var p Plan
	if err := json.Unmarshal([]byte(`{"accounts":[{"id":"chk","name":"Checking","kind":"checking","balance":1000,"updated":"2026-11-10"}],"waiting":["payment:power:2026-11-10"]}`), &p); err != nil {
		t.Fatal(err)
	}
	c, err := Clean(p)
	if err != nil {
		t.Fatal(err)
	}
	if c.InBalance != nil || len(c.Waiting) != 1 {
		t.Fatalf("clean: in balance %v, waiting %v", c.InBalance, c.Waiting)
	}
	b, _ := json.Marshal(c)
	var m map[string]any
	_ = json.Unmarshal(b, &m)
	if _, ok := m["inBalance"]; ok {
		t.Fatalf("an empty inBalance is written: %s", b)
	}
}
