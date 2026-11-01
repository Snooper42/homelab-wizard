package main

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/finance"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// Amounts as Finances' screen writes them, in the plan's currency.
func TestMoneyIn(t *testing.T) {
	for _, c := range []struct {
		code string
		n    float64
		want string
	}{
		{"", 0, "$0.00"}, {"USD", 1234.5, "$1,234.50"}, {"usd", -12, "−$12.00"}, {"EUR", 1234567.891, "€1,234,567.89"},
		{"GBP", 999.999, "£1,000.00"}, {"CHF", 5, "CHF 5.00"}, {"USD", 100, "$100.00"}, {"USD", 100000, "$100,000.00"},
	} {
		if got := moneyIn(c.code)(c.n); got != c.want {
			t.Errorf("%s %v: %q, want %q", c.code, c.n, got, c.want)
		}
	}
}

// From the nightly job: no plan, nothing; with one, today's reminders,
// once a day; and the weekly summary's Finances lines.
func TestSendFinanceReminders(t *testing.T) {
	root, _ := repoCopy(t)
	out := &bytes.Buffer{}
	h, err := newHomelab(&ui.UI{Out: out}, root)
	if err != nil {
		t.Fatal(err)
	}
	oct31 := time.Date(2026, 10, 31, 3, 30, 0, 0, time.Local)
	h.sendFinanceReminders(context.Background(), oct31)
	if strings.Contains(out.String(), "Finances") || h.financeLines(oct31) != nil {
		t.Fatalf("with no plan: %s", out)
	}
	plan := finance.Plan{Updated: "2026-10-30",
		Accounts: []finance.Account{{Name: "Checking", Kind: finance.Checking, Balance: 5000}},
		People:   []finance.Earner{{Name: "Alex", Net: 2000, Schedule: finance.Schedule{Every: finance.Biweekly, Start: "2026-11-06"}}},
		Payments: []finance.Payment{{Name: "Mortgage", Amount: 1845, Schedule: finance.Schedule{Every: finance.Monthly, Start: "2026-01-01"}}}}
	if _, err := finance.Save(finance.Path(root), plan); err != nil {
		t.Fatal(err)
	}
	h.sendFinanceReminders(context.Background(), oct31)
	h.sendFinanceReminders(context.Background(), oct31.Add(time.Hour))
	if n := strings.Count(out.String(), "Finances: Due tomorrow: Mortgage $1,845.00"); n != 1 {
		t.Fatalf("sent %d times:\n%s", n, out)
	}
	if data, err := os.ReadFile(filepath.Join(h.logsDir(), "finance-reminders.json")); err != nil || !strings.Contains(string(data), "2026-10-31") {
		t.Errorf("the day sent: %s %v", data, err)
	}
	lines := h.financeLines(oct31)
	if len(lines) < 2 || !strings.HasPrefix(lines[0], "Finances: the paycheck on Fri, Nov 6 leaves checking at $") || lines[1] != "Before it: Mortgage $1,845.00" {
		t.Errorf("the weekly lines: %q", lines)
	}
}
