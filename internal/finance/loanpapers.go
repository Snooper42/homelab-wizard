package finance

import (
	"math"
	"time"
)

// Installment is one payment of a loan read from its papers: the day it
// is due, what it is, what of it pays the loan down and what is interest,
// and what is owed once it is paid.
type Installment struct {
	Date      string  `json:"date"`
	Payment   float64 `json:"payment"`
	Principal float64 `json:"principal"`
	Interest  float64 `json:"interest"`
	After     float64 `json:"after"`
}

// fromPapers is a loan whose balance is read from its papers: one with
// what it started at and the day its first payment was due.
func fromPapers(a Account, loc *time.Location) (time.Time, bool) {
	if a.Kind != Loan || a.Original <= 0 {
		return time.Time{}, false
	}
	t, err := day(a.FirstDue, loc)
	return t, err == nil
}

// dueOn is a loan's k-th payment day after its first (0 is the first):
// the same day of the month, or the month's last when it has fewer days
// (a loan due the 31st is due Feb 28).
func dueOn(first time.Time, k int) time.Time {
	m := monthsOn(first, k)
	last := monthsOn(first, k+1).AddDate(0, 0, -1).Day()
	return time.Date(m.Year(), m.Month(), min(first.Day(), last), 0, 0, 0, 0, first.Location())
}

// paidBefore is how many of a loan's payments fell due before a day.
func paidBefore(first, today time.Time) int {
	n := 0
	for n < maxPayoffMonths && dueOn(first, n).Before(today) {
		n++
	}
	return n
}

// papersMonthly is what goes to a loan read from its papers each month:
// its own payment, or else what the plan pays into it a month over the
// year ahead.
func papersMonthly(p Plan, a Account, today time.Time) float64 {
	if a.Payment > 0 {
		return cents(a.Payment)
	}
	paid, yearOn := 0.0, today.AddDate(1, 0, 0)
	for _, x := range p.Payments {
		if x.To == a.ID {
			paid += x.Amount * float64(len(p.Dates(x.Schedule, today, yearOn)))
		}
	}
	return cents(paid / 12)
}

// installments are a loan's payments from the first to the last: each
// month the interest at the yearly rate (percent) on what is owed, to the
// cent, with odd more on the first, then the payment, the last only what
// is left. A few cents left by rounding go in with the payment before
// them, as the lender's last payment takes them. None when the payment
// does not keep up with the interest, or it runs past maxPayoffMonths.
func installments(first time.Time, original, rate, monthly, odd float64) ([]Installment, bool) {
	r := rate / 100 / 12
	b := cents(original)
	var out []Installment
	for k := 0; b > 0.005; k++ {
		if k >= maxPayoffMonths {
			return nil, false
		}
		in := cents(b * r)
		if k == 0 {
			in = cents(in + odd)
		}
		pay := math.Min(monthly, cents(b+in))
		if pay <= in {
			return nil, false
		}
		b = cents(b + in - pay)
		if b > 0 && b < 0.05 {
			pay, b = cents(pay+b), 0
		}
		out = append(out, Installment{Date: dateOf(dueOn(first, k)), Payment: pay, Principal: cents(pay - in), Interest: in, After: b})
	}
	return out, true
}

// interestOf is the interest on a loan's payments in all.
func interestOf(rows []Installment) float64 {
	t := 0.0
	for _, x := range rows {
		t += x.Interest
	}
	return cents(t)
}

// oddDays is the interest the first payment carries for the days before
// it, beyond a month's, found from the finance charge the papers state:
// the amount, to the cent, that brings the interest in all nearest it.
// None when the papers say no charge, or less than plain months give.
func oddDays(first time.Time, original, rate, monthly, charge float64) float64 {
	of := func(odd float64) float64 {
		rows, ok := installments(first, original, rate, monthly, odd)
		if !ok {
			return math.Inf(1)
		}
		return interestOf(rows)
	}
	if rate <= 0 || charge <= of(0)+0.005 {
		return 0
	}
	lo, hi := 0.0, math.Max(0, math.Min(charge, monthly-original*rate/1200-0.01))
	for range 60 {
		mid := (lo + hi) / 2
		if of(mid) < charge {
			lo = mid
		} else {
			hi = mid
		}
	}
	a, b := math.Floor(lo*100)/100, math.Ceil(hi*100)/100
	if math.Abs(of(a)-charge) <= math.Abs(of(b)-charge) {
		return a
	}
	return b
}

// papers reads a loan from its papers: each payment, how many fell due
// before today, and what it owes at the start of today. ok is false for
// a loan not read from them, or one whose payment never pays it off.
func papers(p Plan, a Account, today time.Time) (rows []Installment, made int, owed float64, ok bool) {
	first, ok := fromPapers(a, today.Location())
	if !ok {
		return nil, 0, 0, false
	}
	monthly := papersMonthly(p, a, today)
	if monthly <= 0 {
		return nil, 0, 0, false
	}
	odd := 0.0
	if a.Term > 0 && a.Charge > 0 {
		odd = oddDays(first, a.Original, a.Rate, monthly, a.Charge)
	}
	rows, ok = installments(first, a.Original, a.Rate, monthly, odd)
	if !ok {
		return nil, 0, 0, false
	}
	made = min(paidBefore(first, today), len(rows))
	owed = cents(a.Original)
	if made > 0 {
		owed = rows[made-1].After
	}
	return rows, made, owed, true
}
