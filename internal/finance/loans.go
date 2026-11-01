package finance

import (
	"fmt"
	"math"
	"time"
)

// Payoff is a loan read to zero: what it owes today, what is paid toward
// it a month (the payments that go To it, a month on average over the
// year ahead), and at its rate, the month it is paid off, the interest
// still to pay, and its balance at the end of each month until then.
type Payoff struct {
	Account string  `json:"account"`
	Balance float64 `json:"balance"`
	Rate    float64 `json:"rate,omitempty"`
	Monthly float64 `json:"monthly"`
	// Months to pay it off, and the month that is (YYYY-MM); none when it
	// is paid off already, or never will be at this payment.
	Months int    `json:"months,omitempty"`
	Date   string `json:"date,omitempty"`
	// Interest is what is still to pay on it, at its rate, as paid.
	Interest float64 `json:"interest,omitempty"`
	// Never says the payment does not keep up with the interest (or there
	// is none): at this pace it is never paid off.
	Never bool `json:"never,omitempty"`
	// Path is its balance at the end of each month to zero.
	Path []float64 `json:"path,omitempty"`
}

// monthsOn is the month n months on from a day's (its first day): Oct 30
// and four months is February, not the March that Feb 30 would roll into.
func monthsOn(d time.Time, n int) time.Time {
	return time.Date(d.Year(), d.Month()+time.Month(n), 1, 0, 0, 0, 0, d.Location())
}

// maxPayoffMonths is as far as a payoff is read: fifty years.
const maxPayoffMonths = 600

// amortize reads a balance to zero at a yearly rate (percent) and a
// payment a month: the months it takes, the interest paid on the way, and
// the balance after each month. ok is false when the payment never gets
// there (no more than the interest, or past maxPayoffMonths).
func amortize(balance, rate, monthly float64) (months int, interest float64, path []float64, ok bool) {
	r := rate / 100 / 12
	b := balance
	for b > 0.005 {
		if months >= maxPayoffMonths || monthly <= b*r+0.005 {
			return months, cents(interest), path, false
		}
		in := b * r
		interest += in
		b = math.Max(0, b+in-monthly)
		months++
		path = append(path, cents(b))
	}
	return months, cents(interest), path, true
}

// loansNow reads each loan to zero from today's balance (start, in the
// plan's currency) and the payments that go into it.
func loansNow(p Plan, start map[string]float64, today time.Time) []Payoff {
	var out []Payoff
	yearOn := today.AddDate(1, 0, 0)
	for _, a := range p.Accounts {
		if a.Kind != Loan {
			continue
		}
		bal, ok := start[a.ID]
		if !ok {
			bal = a.Balance
		}
		paid := 0.0
		for _, x := range p.Payments {
			if x.To == a.ID {
				paid += x.Amount * float64(len(p.Dates(x.Schedule, today, yearOn)))
			}
		}
		pay := Payoff{Account: a.ID, Balance: cents(bal), Rate: a.Rate, Monthly: cents(paid / 12)}
		if pay.Balance > 0.005 {
			months, interest, path, done := amortize(pay.Balance, a.Rate, pay.Monthly)
			if done {
				at := monthsOn(today, months)
				pay.Months, pay.Date, pay.Interest, pay.Path = months, fmt.Sprintf("%04d-%02d", at.Year(), at.Month()), interest, path
			} else {
				pay.Never = true
			}
		}
		out = append(out, pay)
	}
	return out
}
