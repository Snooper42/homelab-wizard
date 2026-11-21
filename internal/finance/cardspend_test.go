package finance

import (
	"math"
	"testing"
)

// A card paid off with each paycheck and no spending typed in: what goes on
// it between paychecks is read from the ledger (the owner, Nov 20: later
// payoffs on Bills read the typed guess, not what was spent): three
// months of its charges less refunds, a day at a time, times the days
// between paychecks. A planned payment's charge, a payment into it and a
// day ahead don't count; one typed in still wins.
func TestCardSpendFromTheLedger(t *testing.T) {
	today := date("2026-10-31")
	p := household()
	p.Payments = p.Payments[:3] // no card payment of its own
	p.Accounts[2].PaidEach = true
	p, err := Clean(p)
	if err != nil {
		t.Fatal(err)
	}
	var txs []Transaction
	for d := date("2026-08-02"); !d.After(date("2026-10-25")); d = d.AddDate(0, 0, 7) {
		txs = append(txs, Transaction{ID: "c" + dateOf(d), Date: dateOf(d), Account: "visa", Amount: -100, Payee: "Corner Shop"})
	}
	txs = append(txs,
		Transaction{ID: "old", Date: "2026-07-20", Account: "visa", Amount: -999, Payee: "Before the three months"},
		Transaction{ID: "planned", Date: "2026-10-10", Account: "visa", Amount: -500, Payee: "Groceries", Payment: "food"},
		Transaction{ID: "payoff", Date: "2026-10-23", Account: "chk", Amount: -800, To: "visa"},
		Transaction{ID: "refund", Date: "2026-10-12", Account: "visa", Amount: 40, Payee: "Corner Shop"},
		Transaction{ID: "ahead", Date: "2026-11-05", Account: "visa", Amount: -300, Payee: "Not yet"},
	)
	l := Ledger{Transactions: txs}
	pays := p.Dates(Schedule{Every: Paycheck}, today, today.AddDate(1, 0, 0))
	between := pays[len(pays)-1].Sub(pays[0]).Hours() / 24 / float64(len(pays)-1)
	// 13 charges of 100 less the 40 refunded, over the 91 days to today.
	want := cents(1260.0 / 91 * between)

	v := ProjectWith(p, l, today, 4)
	if got := v.CardSpend["visa"]; math.Abs(got-want) > 0.01 {
		t.Fatalf("worked out %v, want %v (%v days between paychecks)", got, want, between)
	}
	paid := payoffs(v)
	// The first pays today's balance; each after it, what the ledger says.
	if math.Abs(paid["2026-11-06"]-1324.65) > 0.01 || math.Abs(paid["2026-11-20"]-want) > 0.01 || math.Abs(paid["2026-11-25"]-want) > 0.01 {
		t.Errorf("payoffs %v, want %v after the first", paid, want)
	}
	if v.Plan.Accounts[2].Spend != 0 {
		t.Error("the plan the screen keeps changed")
	}

	// Typed in, it wins; the worked-out figure is still there to show.
	p.Accounts[2].Spend = 400
	v = ProjectWith(p, l, today, 4)
	if paid := payoffs(v); math.Abs(paid["2026-11-20"]-400) > 0.01 || math.Abs(v.CardSpend["visa"]-want) > 0.01 {
		t.Errorf("typed: payoffs %v, worked out %v", paid, v.CardSpend)
	}
	p.Accounts[2].Spend = 0

	// Under two weeks of its own transactions: too little to go on.
	short := Ledger{Transactions: []Transaction{{ID: "a", Date: "2026-10-25", Account: "visa", Amount: -100}}}
	if v := ProjectWith(p, short, today, 4); len(v.CardSpend) != 0 || payoffs(v)["2026-11-20"] != 0 {
		t.Errorf("a week of transactions: %v, payoffs %v", v.CardSpend, payoffs(v))
	}
	// A card not paid off with each paycheck has none.
	p.Accounts[2].PaidEach = false
	if v := ProjectWith(p, l, today, 4); len(v.CardSpend) != 0 {
		t.Errorf("not paid each paycheck: %v", v.CardSpend)
	}
}

// payoffs is each day's payoff of the visa card in v's periods.
func payoffs(v View) map[string]float64 {
	out := map[string]float64{}
	for _, per := range v.Periods {
		for _, r := range per.Rows {
			if r.Payment == CardID("visa") {
				out[r.Date] = r.Amount
			}
		}
	}
	return out
}
