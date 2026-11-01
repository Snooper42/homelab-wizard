package finance

import (
	"fmt"
	"math"
	"strings"
	"time"
)

// Budget is how much a category may take each month, or each pay period
// (from one payday into checking to the next). A group's budget counts
// its own categories too. With Rollover, what was left last time (or
// spent beyond it) is added to this time's.
type Budget struct {
	Category string  `json:"category"`
	Amount   float64 `json:"amount"`
	// Per is "month" (the default) or "paycheck".
	Per      string `json:"per,omitempty"`
	Rollover bool   `json:"rollover,omitempty"`
}

// BudgetNow is a budget in the month or pay period today is in.
type BudgetNow struct {
	Category string `json:"category"`
	Per      string `json:"per"`
	Start    string `json:"start"` // its first day
	Last     string `json:"last"`  // its last day
	// Amount is what it may take this time: the budget, and what rolled over.
	Amount float64 `json:"amount"`
	Rolled float64 `json:"rolled,omitempty"`
	Spent  float64 `json:"spent"`
	Left   float64 `json:"left"`
	// Pace is what would be spent by today at an even pace through it.
	Pace float64 `json:"pace"`
}

// cleanBudgets keeps one budget per category (whatever its case), each
// for more than nothing, a month or a paycheck.
func cleanBudgets(in []Budget) ([]Budget, error) {
	if len(in) == 0 {
		return nil, nil
	}
	seen := map[string]string{} // by name in lower case: as first written
	out := make([]Budget, 0, len(in))
	for _, b := range in {
		b.Category, b.Amount = strings.TrimSpace(b.Category), cents(b.Amount)
		if b.Category == "" {
			return nil, fmt.Errorf("a budget has no category")
		}
		if first, ok := seen[strings.ToLower(b.Category)]; ok {
			return nil, fmt.Errorf("%s has two budgets", first)
		}
		seen[strings.ToLower(b.Category)] = b.Category
		if b.Amount <= 0 {
			return nil, fmt.Errorf("%s: a budget is more than nothing", b.Category)
		}
		switch b.Per {
		case "", "month":
			b.Per = ""
		case Paycheck:
		default:
			return nil, fmt.Errorf("%s: a budget is a month's or a paycheck's, not %q", b.Category, b.Per)
		}
		out = append(out, b)
	}
	return out, nil
}

// budgetsNow is each budget in the month, or the pay period, today is in:
// what was spent in its category (and, for a group, its own categories),
// money out less refunds, splits by their parts, transfers never.
func budgetsNow(p Plan, cats []Category, l Ledger, today time.Time) []BudgetNow {
	if len(p.Budgets) == 0 {
		return nil
	}
	// Each category's group, to count a group's own with it.
	group := map[string]string{}
	for _, c := range cats {
		group[strings.ToLower(c.Name)] = strings.ToLower(c.Parent)
	}
	in := func(cat, budget string) bool {
		cat, budget = strings.ToLower(cat), strings.ToLower(budget)
		return cat != "" && (cat == budget || group[cat] == budget)
	}
	spent := func(budget string, from, to string) float64 {
		sum := 0.0
		for _, t := range l.Transactions {
			if t.To != "" || t.Date < from || t.Date > to {
				continue
			}
			if len(t.Splits) > 0 {
				for _, sp := range t.Splits {
					if in(sp.Category, budget) {
						sum -= sp.Amount
					}
				}
			} else if in(t.Category, budget) {
				sum -= t.Amount
			}
		}
		return cents(sum)
	}
	var out []BudgetNow
	for _, b := range p.Budgets {
		start, last, prevStart, prevLast := budgetSpan(p, b.Per, today)
		n := BudgetNow{Category: b.Category, Per: b.Per, Start: dateOf(start), Last: dateOf(last), Amount: b.Amount}
		if n.Per == "" {
			n.Per = "month"
		}
		if b.Rollover && !prevStart.IsZero() {
			n.Rolled = cents(b.Amount - spent(b.Category, dateOf(prevStart), dateOf(prevLast)))
			n.Amount = cents(n.Amount + n.Rolled)
		}
		n.Spent = spent(b.Category, n.Start, n.Last)
		n.Left = cents(n.Amount - n.Spent)
		days := last.Sub(start).Hours()/24 + 1
		gone := today.Sub(start).Hours()/24 + 1
		n.Pace = cents(math.Max(0, n.Amount) * math.Min(1, gone/days))
		out = append(out, n)
	}
	return out
}

// budgetSpan is the month, or the pay period, today is in, and the one
// before it: a pay period runs from a payday into checking to the day
// before the next. With no paydays, a paycheck's budget is a month's.
func budgetSpan(p Plan, per string, today time.Time) (start, last, prevStart, prevLast time.Time) {
	if per == Paycheck {
		pays := p.Dates(Schedule{Every: Paycheck}, today.AddDate(0, 0, -70), today.AddDate(0, 0, 70))
		var before, after []time.Time
		for _, d := range pays {
			if d.After(today) {
				after = append(after, d)
			} else {
				before = append(before, d)
			}
		}
		if len(before) > 0 && len(after) > 0 {
			start, last = before[len(before)-1], after[0].AddDate(0, 0, -1)
			if len(before) > 1 {
				prevStart, prevLast = before[len(before)-2], start.AddDate(0, 0, -1)
			}
			return
		}
	}
	start = time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, today.Location())
	last = start.AddDate(0, 1, -1)
	prevStart, prevLast = start.AddDate(0, -1, 0), start.AddDate(0, 0, -1)
	return
}
