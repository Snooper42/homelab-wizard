package finance

import (
	"testing"
)

// Net worth before the first balance typed in, worked back from it day by
// day through the ledger (the owner, Nov 16: transactions from Jan 1, the
// chart to go back to it without "getting all broken"): each account less
// what came in that day and plus what went out; one with no transactions
// held where it is. Made-up accounts.
func TestWorthBack(t *testing.T) {
	p := Plan{
		WorthFrom: "2026-01-01",
		Accounts: []Account{
			{ID: "chk", Name: "Checking", Kind: Checking, Balance: 1000, Updated: "2026-03-01", History: []Point{{"2026-03-01", 1000}}},
			{ID: "sav", Name: "Savings", Kind: Savings, Balance: 5000, Updated: "2026-03-01", History: []Point{{"2026-03-01", 5000}}},
			{ID: "card", Name: "Card", Kind: Card, Balance: 200, Updated: "2026-03-01", History: []Point{{"2026-03-01", 200}}},
			{ID: "house", Name: "House", Kind: Home, Balance: 100000},
			{ID: "loan", Name: "Loan", Kind: Loan, Balance: 50000, Updated: "2026-03-01", History: []Point{{"2026-03-01", 50000}}},
		},
	}
	l := Ledger{Transactions: []Transaction{
		{ID: "a", Date: "2026-02-15", Account: "chk", Amount: 2000, Payee: "Paycheck"},
		{ID: "b", Date: "2026-02-20", Account: "chk", Amount: -500, Payee: "To savings", To: "sav"},
		{ID: "c", Date: "2026-02-25", Account: "card", Amount: -50, Payee: "Groceries"},
		// On the day the balance was typed: in that balance already, so before it, not yet.
		{ID: "d", Date: "2026-03-01", Account: "chk", Amount: -30, Payee: "Coffee"},
		// After it: the real line's, not this.
		{ID: "e", Date: "2026-04-01", Account: "chk", Amount: -999, Payee: "Later"},
	}}
	est, back := worthBack(p, l, date("2026-06-01"))
	if len(est) != 59 || est[0].Date != "2026-01-01" || est[len(est)-1].Date != "2026-02-28" {
		t.Fatalf("from Jan 1 to the day before Mar 1: %d points, %v … %v", len(est), est[0], est[len(est)-1])
	}
	at := map[string]float64{}
	for _, x := range est {
		at[x.Date] = x.Amount
	}
	// Feb 28: the coffee undone (1030), savings 5000, the card owing 200.
	if at["2026-02-28"] != 1030+5000-200+100000-50000 {
		t.Errorf("Feb 28: %v", at["2026-02-28"])
	}
	// Feb 19: the move to savings undone on both sides (checking 1530, savings 4500), the charge undone (owing 150).
	if at["2026-02-19"] != 1530+4500-150+100000-50000 {
		t.Errorf("Feb 19: %v", at["2026-02-19"])
	}
	// Jan 1: before the paycheck, checking −470: the past is missing money in, and it says so.
	if at["2026-01-01"] != -470+4500-150+100000-50000 {
		t.Errorf("Jan 1: %v", at["2026-01-01"])
	}
	how := map[string]WorthBack{}
	for _, b := range back {
		how[b.Account] = b
	}
	if how["chk"].How != "transactions" || how["chk"].Start != -470 || how["chk"].Lowest != -470 || how["chk"].LowestOn != "2026-01-01" {
		t.Errorf("checking: %+v", how["chk"])
	}
	if how["sav"].Start != 4500 || how["card"].Start != -150 || how["card"].How != "transactions" {
		t.Errorf("savings, card: %+v %+v", how["sav"], how["card"])
	}
	if how["house"].How != "flat" || how["house"].Start != 100000 || how["loan"].How != "flat" || how["loan"].Start != -50000 {
		t.Errorf("held where they are: %+v %+v", how["house"], how["loan"])
	}
	// Each month's last day, for Net worth by month's bars: January's, and February's (the day before the first balance).
	if e := how["chk"].Ends; len(e) != 2 || e["2026-01-31"] != -470 || e["2026-02-28"] != 1030 {
		t.Errorf("checking's month ends: %v", e)
	}
	if e := how["sav"].Ends; e["2026-01-31"] != 4500 || e["2026-02-28"] != 5000 {
		t.Errorf("savings' month ends: %v", e)
	}
}

// None asked for, or from a day on or after the first balance: nothing
// worked back, and the real line stays as it was.
func TestWorthBackOnlyWhenAsked(t *testing.T) {
	p := Plan{Accounts: []Account{{ID: "chk", Name: "Checking", Kind: Checking, Balance: 1000, Updated: "2026-03-01", History: []Point{{"2026-03-01", 1000}}}}}
	if est, back := worthBack(p, Ledger{}, date("2026-06-01")); est != nil || back != nil {
		t.Fatalf("none asked: %v %v", est, back)
	}
	p.WorthFrom = "2026-03-01"
	if est, _ := worthBack(p, Ledger{}, date("2026-06-01")); est != nil {
		t.Fatalf("from the first balance itself: %v", est)
	}
	// No balance kept at all: worked back from today's.
	p = Plan{WorthFrom: "2026-05-30", Accounts: []Account{{ID: "chk", Name: "Checking", Kind: Checking, Balance: 1000}}}
	est, _ := worthBack(p, Ledger{Transactions: []Transaction{{ID: "a", Date: "2026-05-31", Account: "chk", Amount: 100}}}, date("2026-06-01"))
	if len(est) != 2 || est[0] != (Point{"2026-05-30", 900}) || est[1] != (Point{"2026-05-31", 1000}) {
		t.Fatalf("from today's balances: %v", est)
	}
	// Clean keeps a day, and refuses what isn't one.
	if _, err := Clean(Plan{WorthFrom: "Jan"}); err == nil {
		t.Fatal("a Show net worth from that isn't a day")
	}
}
