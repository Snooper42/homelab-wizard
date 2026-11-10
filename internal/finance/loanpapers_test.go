package finance

import (
	"math"
	"testing"
)

// A car loan as its papers state it: $6,997.69 financed at 8.38%, 36
// payments of $221.28, a $968.39 finance charge. The first payment
// carries the days before it, so the 36 come to the papers to the cent.
func TestPapersCarLoan(t *testing.T) {
	p := household()
	car := Account{ID: "new", Name: "Car loan", Kind: Loan, Original: 6997.69, Rate: 8.38, FirstDue: "2026-12-09", Payment: 221.28, Term: 36, Charge: 968.39}
	rows, made, owed, ok := papers(p, car, date("2026-11-09"))
	if !ok || made != 0 || owed != 6997.69 || len(rows) != 36 {
		t.Fatalf("before the first: %d rows, %d made, owes %v, ok %v", len(rows), made, owed, ok)
	}
	paid := 0.0
	for _, x := range rows {
		paid += x.Payment
	}
	if interestOf(rows) != 968.39 || cents(paid) != 7966.08 || rows[35].Payment != 221.28 || rows[35].After != 0 || rows[35].Date != "2029-11-09" {
		t.Errorf("in all: %v interest, %v paid, last %+v", interestOf(rows), cents(paid), rows[35])
	}
	// A month's interest at 8.38% is $48.87; the first has the odd days on top.
	if rows[0].Interest <= 48.87 || rows[1].Interest >= rows[0].Interest || cents(rows[0].Principal+rows[0].Interest) != 221.28 {
		t.Errorf("first: %+v, second %+v", rows[0], rows[1])
	}
	// On Feb 23 three have fallen due: what it owes is what is left after the third.
	if _, made, owed, _ := papers(p, car, date("2027-02-23")); made != 3 || owed != rows[2].After {
		t.Errorf("Feb 23: %d made, owes %v", made, owed)
	}
	// On a payment's own day it is not yet taken off: the day's payment does that.
	if _, made, _, _ := papers(p, car, date("2027-01-09")); made != 1 {
		t.Errorf("Jan 9: %d made", made)
	}
	// With no charge on the papers, plain months: less interest, the same 36.
	car.Charge = 0
	if rows, _, _, _ := papers(p, car, date("2026-11-09")); len(rows) != 36 || interestOf(rows) >= 968.39 {
		t.Errorf("plain: %d rows, %v", len(rows), interestOf(rows))
	}
}

// A mortgage at no interest, $1,240 a month on $192,000 from May 2022:
// each payment due takes $1,240 off, three by Feb 23 if the first is Dec 9.
func TestPapersNoInterest(t *testing.T) {
	p := household()
	home := Account{ID: "home", Kind: Loan, Original: 192000, FirstDue: "2022-05-01", Payment: 1240}
	rows, made, owed, ok := papers(p, home, date("2026-11-09"))
	if !ok || made != 55 || owed != 192000-55*1240 || len(rows) != 155 || rows[154].Payment != 1040 || rows[154].Date != "2035-03-01" || interestOf(rows) != 0 {
		t.Fatalf("%d rows, %d made, owes %v; last %+v", len(rows), made, owed, rows[len(rows)-1])
	}
	home.FirstDue, home.Original = "2026-12-09", 7000
	if _, made, owed, _ := papers(p, home, date("2027-02-23")); made != 3 || owed != 7000-3*1240 {
		t.Errorf("Feb 23: %d made, owes %v", made, owed)
	}
	// What is left, not a whole payment, is the last.
	if rows, _, _, _ := papers(p, home, date("2027-02-23")); len(rows) != 6 || rows[5].Payment != 800 {
		t.Errorf("last: %+v", rows[len(rows)-1])
	}
}

// A loan not read from its papers: no first day, nothing borrowed, no
// payment, or one that never keeps up. With no payment of its own, the
// plan's payments into it a month are its payment.
func TestPapersNot(t *testing.T) {
	p := household()
	today := date("2026-11-09")
	for _, a := range []Account{
		{ID: "a", Kind: Loan, Original: 1000, Payment: 100},
		{ID: "b", Kind: Loan, FirstDue: "2026-01-01", Payment: 100},
		{ID: "c", Kind: Card, Original: 1000, FirstDue: "2026-01-01", Payment: 100},
		{ID: "d", Kind: Loan, Original: 1000, FirstDue: "2026-01-01"},
		{ID: "e", Kind: Loan, Original: 100000, FirstDue: "2026-01-01", Payment: 100, Rate: 6},
		{ID: "f", Kind: Loan, Original: 1000, FirstDue: "Jan 1", Payment: 100},
	} {
		if _, _, _, ok := papers(p, a, today); ok {
			t.Errorf("%s read from papers", a.ID)
		}
	}
	a := Account{ID: "carloan", Kind: Loan, Original: 24000, FirstDue: "2022-01-15"}
	if rows, _, _, ok := papers(p, a, today); !ok || rows[0].Payment != 412 {
		t.Errorf("the plan's $412: %v", rows[:1])
	}
}

// The 31st falls on a month's last day when it has fewer.
func TestDueOn(t *testing.T) {
	first := date("2027-01-31")
	for k, want := range []string{"2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"} {
		if got := dateOf(dueOn(first, k)); got != want {
			t.Errorf("%d: %s, want %s", k, got, want)
		}
	}
	if n := paidBefore(first, date("2027-02-28")); n != 1 {
		t.Errorf("before Feb 28: %d", n)
	}
}

// What the papers say is what Finances reads: today's balance, the payoff,
// and the next payment taking its amount (with its interest) off ahead.
func TestPapersInView(t *testing.T) {
	p := household()
	p.Updated = "2026-10-28"
	for i := range p.Accounts {
		if p.Accounts[i].ID == "carloan" {
			// Typed in long ago at another figure: the papers win.
			p.Accounts[i].Balance, p.Accounts[i].Updated, p.Accounts[i].FirstDue = 999, "2025-01-01", "2022-01-15"
		}
	}
	today := date("2026-11-02")
	v := Project(p, today, 4)
	// Jan 2022 to Oct 2026: 58 payments of $412 off $24,000, no interest.
	want := 24000 - 58*412.0
	if v.Start["carloan"] != want {
		t.Fatalf("start %v, want %v", v.Start["carloan"], want)
	}
	var loan Payoff
	for _, x := range v.Loans {
		if x.Account == "carloan" {
			loan = x
		}
	}
	if loan.Balance != want || loan.Made != 58 || len(loan.Rows) != 59 || loan.Months != 1 || loan.Date != "2026-11" || len(loan.Path) != 1 || loan.Monthly != 412 {
		t.Errorf("payoff %+v", loan)
	}
	// After Nov 15's payment it is paid off.
	for _, per := range v.Periods {
		if per.Last >= "2026-11-15" && math.Abs(per.Accounts["carloan"]) > 0.005 {
			t.Errorf("after Nov 15: %v", per.Accounts["carloan"])
		}
	}
}

// A mortgage split between two people, with only one half in the plan:
// the papers say $2,000 a month, the household pays $1,000 of it from
// checking, and the other half comes from someone the plan doesn't list.
// The loan still falls by the papers' whole payment ahead, as the Loans
// card says, while checking pays only its half.
func TestPapersSplitPayment(t *testing.T) {
	p := household()
	p.Updated = "2026-10-28"
	p.Accounts = append(p.Accounts, Account{ID: "home", Name: "Mortgage", Kind: Loan, Balance: 1, Original: 200000, Rate: 6, FirstDue: "2024-01-01", Payment: 2000})
	for i := range p.Payments {
		if p.Payments[i].ID == "mortgage" {
			p.Payments[i].Amount, p.Payments[i].To = 1000, "home"
		}
	}
	v := Project(p, date("2026-11-02"), 12)
	var loan Payoff
	for _, x := range v.Loans {
		if x.Account == "home" {
			loan = x
		}
	}
	if loan.Monthly != 2000 || len(loan.Rows) == 0 || loan.Made != 35 {
		t.Fatalf("payoff %+v", loan)
	}
	// Each period ends owing what the papers say after the payments due by then.
	periods := 0
	for _, per := range v.Periods {
		want := loan.Balance
		for _, r := range loan.Rows[loan.Made:] {
			if r.Date <= per.Last {
				want = r.After
			}
		}
		if got := per.Accounts["home"]; math.Abs(got-want) > 0.005 {
			t.Errorf("period to %s: owes %v, the papers say %v", per.Last, got, want)
		}
		periods++
		// Checking pays only the household's half.
		for _, r := range per.Rows {
			if r.Payment == "mortgage" && r.Amount != 1000 {
				t.Errorf("period to %s: checking pays %v", per.Last, r.Amount)
			}
		}
	}
	if periods < 6 {
		t.Fatalf("%d periods", periods)
	}
}
