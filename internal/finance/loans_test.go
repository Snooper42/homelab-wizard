package finance

import (
	"math"
	"testing"
)

// A balance read to zero: at 6% and $200 a month, $10,000 takes 58 months
// (the last one short); with no interest, the balance over the payment;
// a payment no more than the interest never gets there.
func TestAmortize(t *testing.T) {
	months, interest, path, ok := amortize(10000, 6, 200)
	if !ok || months != 58 || len(path) != 58 || path[57] != 0 || path[0] != 9850 {
		t.Fatalf("6%%: %d months, path %v…, ok %v", months, path[:2], ok)
	}
	// What was paid less the $10,000 borrowed: 57 whole payments, and the last month's balance with its interest.
	if last := path[56] * 1.005; math.Abs(interest-(57*200+last-10000)) > 0.02 {
		t.Errorf("interest %v", interest)
	}
	if months, interest, path, ok := amortize(1000, 0, 100); !ok || months != 10 || interest != 0 || path[9] != 0 {
		t.Errorf("no interest: %d, %v, %v", months, interest, path)
	}
	if _, _, _, ok := amortize(10000, 24, 200); ok {
		t.Error("$200 a month on $10,000 at 24% (its interest) was paid off")
	}
	if _, _, _, ok := amortize(10000, 6, 0); ok {
		t.Error("nothing paid, paid off")
	}
	if _, _, _, ok := amortize(1e9, 1, 1e6+10); ok {
		t.Error("read past fifty years")
	}
}

// Each loan from today's balance and the payments into it: the car loan
// at $412 a month, with and without interest; one paid off; one with no
// payment never is.
func TestLoansNow(t *testing.T) {
	p := household()
	p.Updated = "2026-10-28"
	p.Accounts = append(p.Accounts, Account{ID: "paid", Name: "Old loan", Kind: Loan}, Account{ID: "student", Name: "Student loan", Kind: Loan, Balance: 5000, Rate: 4})
	today := date("2026-11-02")
	v := Project(p, today, 4)
	if len(v.Loans) != 3 {
		t.Fatalf("loans %+v", v.Loans)
	}
	car := v.Loans[0]
	if car.Account != "carloan" || car.Balance != 11240 || car.Monthly != 412 || car.Months != 28 || car.Date != "2029-03" || car.Interest != 0 || car.Never || len(car.Path) != 28 {
		t.Errorf("car loan: %+v", car)
	}
	if paid := v.Loans[1]; paid.Months != 0 || paid.Never || paid.Date != "" {
		t.Errorf("paid off: %+v", paid)
	}
	if student := v.Loans[2]; !student.Never || student.Monthly != 0 {
		t.Errorf("no payment: %+v", student)
	}
	// At 6.5%, the same payments take longer and cost interest (from today's balance, its interest since Oct 28 in it).
	p.Accounts[4].Rate = 6.5
	car = Project(p, today, 4).Loans[0]
	months, interest, _, _ := amortize(car.Balance, 6.5, 412)
	if car.Balance <= 11240 || car.Months != months || car.Months <= 28 || car.Interest != interest || car.Interest <= 0 || car.Rate != 6.5 {
		t.Errorf("car loan at 6.5%%: %+v, want %d months and %v", car, months, interest)
	}
	if v := Project(household(), today, 4); len(v.Loans) != 1 {
		t.Errorf("household loans: %+v", v.Loans)
	}
}

// A month on is counted from the month's first day: Oct 30 and four months
// is February (Feb 30 would roll into March), and twelve a year on.
func TestMonthsOn(t *testing.T) {
	for _, c := range []struct {
		from string
		n    int
		want string
	}{{"2026-10-30", 4, "2027-02"}, {"2026-10-30", 28, "2029-02"}, {"2026-01-31", 1, "2026-02"}, {"2026-11-02", 12, "2027-11"}, {"2026-12-15", 0, "2026-12"}} {
		if got := monthsOn(date(c.from), c.n).Format("2006-01"); got != c.want {
			t.Errorf("%s + %d months: %s, want %s", c.from, c.n, got, c.want)
		}
	}
}

// A card with a rate paid down by a payment into it carries a balance and
// is read to zero with the loans; one paid off whole, or with no rate, is not.
func TestCardsCarryingABalance(t *testing.T) {
	p := household()
	p.Updated = "2026-10-28"
	p.Accounts[2].Rate = 24.99
	today := date("2026-11-02")
	// The visa's payment pays it off whole: it carries nothing.
	if v := Project(p, today, 4); len(v.Loans) != 1 {
		t.Fatalf("a card paid off whole read as carried: %+v", v.Loans)
	}
	p.Payments[3] = Payment{ID: "visapay", Name: "Chase Freedom", Amount: 150, To: "visa", Schedule: Schedule{Every: Monthly, Start: "2026-01-21"}}
	v := Project(p, today, 4)
	if len(v.Loans) != 2 || v.Loans[0].Account != "visa" || v.Loans[0].Monthly != 150 || v.Loans[0].Never || v.Loans[0].Interest <= 0 {
		t.Fatalf("the visa carried: %+v", v.Loans)
	}
	p.Accounts[2].Rate = 0
	if v := Project(p, today, 4); len(v.Loans) != 1 {
		t.Errorf("a card with no rate read as carried: %+v", v.Loans)
	}
	p.Accounts[2].Rate, p.Accounts[2].PaidEach = 24.99, true
	if v := Project(p, today, 4); len(v.Loans) != 1 {
		t.Errorf("a card paid off each paycheck read as carried: %+v", v.Loans)
	}
}
