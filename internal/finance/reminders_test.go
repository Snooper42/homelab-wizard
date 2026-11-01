package finance

import (
	"fmt"
	"strings"
	"testing"
)

func usd(n float64) string { return fmt.Sprintf("$%.2f", n) }

// sent is the reminders' kinds, in order.
func sent(rs []Reminder) string {
	var out []string
	for _, r := range rs {
		out = append(out, r.Kind)
	}
	return strings.Join(out, ",")
}

// Each reminder on its one day: the mortgage due tomorrow; the paycheck
// three days off leaving checking under the cushion; a yearly payment a
// week off; balances seven days old (and fourteen), not eight. A kind the
// household turned off is not sent.
func TestReminders(t *testing.T) {
	plan := func() Plan {
		p := household()
		p.Updated = "2026-10-27"
		p.Payments = append(p.Payments, Payment{ID: "claude", Name: "Claude Pro", Amount: 200, Kind: "subscriptions", Schedule: Schedule{Every: Yearly, Start: "2025-11-10"}})
		return p
	}
	at := func(p Plan, day string) []Reminder {
		today := date(day)
		return Reminders(ProjectWith(p, Ledger{}, today, 4), today, usd)
	}

	// Oct 31: the mortgage comes out on Nov 1.
	rs := at(plan(), "2026-10-31")
	if sent(rs) != "due" || rs[0].Title != "Due tomorrow: Mortgage $1845.00" {
		t.Fatalf("Oct 31: %+v", rs)
	}
	// Two on one day are one message with their total.
	p := plan()
	p.Payments = append(p.Payments, Payment{ID: "hoa", Name: "HOA", Amount: 310, Schedule: Schedule{Every: Monthly, Start: "2026-01-01"}})
	if rs := at(p, "2026-10-31"); len(rs) != 1 || rs[0].Title != "2 payments due tomorrow, $2155.00" || rs[0].Body != "Mortgage $1845.00, HOA $310.00." {
		t.Errorf("two due: %+v", rs)
	}
	// Nov 3: balances a week old, Claude Pro renews Nov 10, and Alex's Nov 6 paycheck leaves checking under a high cushion.
	p = plan()
	p.Cushion = 1e6
	rs = at(p, "2026-11-03")
	if sent(rs) != "cushion,renewal,balances" {
		t.Fatalf("Nov 3: %+v", rs)
	}
	if !strings.Contains(rs[0].Body, "After the paycheck on Fri, Nov 6 and its bills, checking is $") || rs[1].Title != "Renewing in a week: Claude Pro ($200.00)" || rs[2].Title != "Balances last updated 7 days ago" {
		t.Errorf("Nov 3 says %+v", rs)
	}
	// Under a cushion it stays above: no warning.
	if rs := at(plan(), "2026-11-03"); sent(rs) != "renewal,balances" {
		t.Errorf("a low cushion: %+v", rs)
	}
	// Eight days old: nothing; fourteen: again.
	if rs := at(plan(), "2026-11-04"); sent(rs) != "" {
		t.Errorf("Nov 4: %+v", rs)
	}
	if rs := at(plan(), "2026-11-10"); !strings.Contains(sent(rs), "balances") {
		t.Errorf("Nov 10: %+v", rs)
	}
	// Turned off, not sent.
	p = plan()
	p.Quiet = []string{RemindDue}
	if rs := at(p, "2026-10-31"); len(rs) != 0 {
		t.Errorf("due turned off: %+v", rs)
	}
}

// The reminders turned off are kinds Finances knows, each once, in order.
func TestCleanQuiet(t *testing.T) {
	p := household()
	p.Quiet = []string{"balances", "due", "balances"}
	got, err := Clean(p)
	if err != nil || strings.Join(got.Quiet, ",") != "due,balances" {
		t.Fatalf("kept %v, %v", got.Quiet, err)
	}
	p.Quiet = []string{"birthdays"}
	if _, err := Clean(p); err == nil || !strings.Contains(err.Error(), `no reminder "birthdays"`) {
		t.Errorf("an unknown reminder: %v", err)
	}
}

// The weekly summary's lines: the next paycheck and what it leaves, the
// biggest bills before it, and net worth with its change since a week ago
// (savings $6,000 on Oct 20, by its history).
func TestWeekLines(t *testing.T) {
	p := household()
	p.Updated = "2026-10-28"
	p.Accounts[1].History = []Point{{Date: "2026-10-20", Amount: 6000}}
	today := date("2026-10-29")
	v := ProjectWith(p, Ledger{}, today, 4)
	lines := WeekLines(v, today, usd)
	if len(lines) != 3 || !strings.HasPrefix(lines[0], "Finances: the paycheck on Fri, Nov 6 leaves checking at $") || lines[1] != "Before it: Mortgage $1845.00, Groceries $200.00" {
		t.Fatalf("lines %q", lines)
	}
	net := 0.0
	for _, a := range p.Accounts {
		if a.Kind == Card || a.Kind == Loan {
			net -= v.Start[a.ID]
		} else {
			net += v.Start[a.ID]
		}
	}
	if want := fmt.Sprintf("Net worth %s, up %s since last week", usd(net), usd(v.Start["sav"]-6000)); lines[2] != want {
		t.Errorf("net worth %q, want %q", lines[2], want)
	}
	// No history a week back: no change said.
	p.Accounts[1].History = nil
	if lines := WeekLines(ProjectWith(p, Ledger{}, today, 4), today, usd); !strings.HasPrefix(lines[2], "Net worth ") || strings.Contains(lines[2], "since") {
		t.Errorf("no history: %q", lines[2])
	}
	if lines := WeekLines(ProjectWith(Plan{}, Ledger{}, today, 4), today, usd); len(lines) != 0 {
		t.Errorf("an empty plan: %q", lines)
	}
}
