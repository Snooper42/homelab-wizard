package finance

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

// Reminders are what Finances tells the household through the homelab's
// ntfy, each kind on one day only so a nightly run sends it once: a bill
// or card due tomorrow; three days before a paycheck that will leave
// checking under the cushion; a yearly payment renewing in a week; and,
// weekly from the seventh day, balances not typed in since. A kind named
// in Plan.Quiet is not sent.
const (
	RemindDue      = "due"
	RemindCushion  = "cushion"
	RemindRenewal  = "renewal"
	RemindBalances = "balances"
)

// RemindKinds are the kinds, in the order Finances lists them.
var RemindKinds = []string{RemindDue, RemindCushion, RemindRenewal, RemindBalances}

// Reminder is one message: its kind, a title, and its words.
type Reminder struct {
	Kind  string `json:"kind"`
	Title string `json:"title"`
	Body  string `json:"body"`
}

// cushionAhead is how many days before a paycheck the cushion warning comes.
const cushionAhead = 3

// renewalAhead is how many days before a yearly payment its reminder comes.
const renewalAhead = 7

// Reminders reads what to tell the household today from a view of the
// plan (ProjectWith for today). Amounts are written by money ("$15.49").
func Reminders(v View, today time.Time, money func(float64) string) []Reminder {
	quiet := map[string]bool{}
	for _, k := range v.Plan.Quiet {
		quiet[k] = true
	}
	day0 := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
	on := func(n int) string { return dateOf(day0.AddDate(0, 0, n)) }
	payments := map[string]Payment{}
	for _, x := range v.Plan.WithCards() {
		payments[x.ID] = x
	}
	var out []Reminder
	if !quiet[RemindDue] {
		var due []string
		total := 0.0
		for _, per := range v.Periods {
			for _, r := range per.Rows {
				x, ok := payments[r.Payment]
				if r.Date != on(1) || !ok || r.Saved || r.Into {
					continue
				}
				due = append(due, fmt.Sprintf("%s %s", x.Name, money(r.Amount)))
				total += r.Amount
			}
		}
		if len(due) == 1 {
			out = append(out, Reminder{RemindDue, "Due tomorrow: " + due[0], "It comes out tomorrow."})
		} else if len(due) > 1 {
			out = append(out, Reminder{RemindDue, fmt.Sprintf("%d payments due tomorrow, %s", len(due), money(total)), strings.Join(due, ", ") + "."})
		}
	}
	if !quiet[RemindCushion] && v.Plan.Cushion > 0 {
		for _, per := range v.Periods {
			if per.Pay == nil || per.Pay.Date != on(cushionAhead) || per.Left >= v.Plan.Cushion {
				continue
			}
			out = append(out, Reminder{RemindCushion, fmt.Sprintf("Checking under %s after the paycheck in %d days", money(v.Plan.Cushion), cushionAhead),
				fmt.Sprintf("After the paycheck on %s and its bills, checking is %s, under your %s cushion.", day0.AddDate(0, 0, cushionAhead).Format("Mon, Jan 2"), money(per.Left), money(v.Plan.Cushion))})
		}
	}
	if !quiet[RemindRenewal] {
		var names []string
		for id, next := range v.Next {
			if x, ok := payments[id]; ok && x.Schedule.Every == Yearly && next == on(renewalAhead) {
				names = append(names, fmt.Sprintf("%s (%s)", x.Name, money(x.Amount)))
			}
		}
		sort.Strings(names)
		if len(names) > 0 {
			out = append(out, Reminder{RemindRenewal, "Renewing in a week: " + strings.Join(names, ", "), "Yearly, on " + day0.AddDate(0, 0, renewalAhead).Format("Mon, Jan 2") + ". Cancel before then if you no longer use it."})
		}
	}
	if !quiet[RemindBalances] {
		if last, err := day(lastTyped(v.Plan), today.Location()); err == nil {
			if days := int(day0.Sub(last).Hours()/24 + 0.5); days >= 7 && days%7 == 0 {
				out = append(out, Reminder{RemindBalances, fmt.Sprintf("Balances last updated %d days ago", days), "Finances reads ahead from them: Update balances when you can."})
			}
		}
	}
	return out
}

// lastTyped is the last day any balance was typed in: the plan's, or an
// account's own, whichever is later; empty with none.
func lastTyped(p Plan) string {
	last := p.Updated
	for _, a := range p.Accounts {
		if a.Updated > last {
			last = a.Updated
		}
	}
	return last
}
