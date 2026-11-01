package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/finance"
	"github.com/Snooper42/homelab-wizard/internal/notify"
)

// currencySigns are the signs Finances writes amounts with; another code
// is written before the amount ("CHF 12.00").
var currencySigns = map[string]string{"USD": "$", "CAD": "CA$", "AUD": "A$", "NZD": "NZ$", "EUR": "€", "GBP": "£", "JPY": "¥", "INR": "₹", "MXN": "MX$"}

// moneyIn writes an amount as Finances' screen does, in a plan's currency:
// "$1,234.56", "−$12.00".
func moneyIn(code string) func(float64) string {
	code = strings.ToUpper(code)
	if code == "" {
		code = "USD"
	}
	sign, ok := currencySigns[code]
	if !ok {
		sign = code + " "
	}
	return func(n float64) string {
		minus := ""
		if n < -0.005 {
			minus, n = "−", -n
		}
		whole := fmt.Sprintf("%.2f", n)
		units, cents := whole[:len(whole)-3], whole[len(whole)-3:]
		var b strings.Builder
		for i, c := range units {
			if i > 0 && (len(units)-i)%3 == 0 {
				b.WriteByte(',')
			}
			b.WriteRune(c)
		}
		return minus + sign + b.String() + cents
	}
}

// financeView is Finances read forward for today, and its money writer;
// ok is false with no plan typed in yet.
func (h *homelab) financeView(now time.Time) (finance.View, func(float64) string, bool) {
	path := finance.Path(h.root)
	if _, err := os.Stat(path); err != nil {
		return finance.View{}, nil, false
	}
	p, err := finance.Load(path)
	if err != nil {
		h.ui.Warn("reading Finances: %v", err)
		return finance.View{}, nil, false
	}
	l, err := finance.LoadLedger(finance.LedgerPath(h.root))
	if err != nil {
		l = finance.Ledger{}
	}
	return finance.ProjectWith(p, l, now, finance.Ahead), moneyIn(p.Currency), true
}

// sendFinanceReminders sends what Finances has to tell the household today
// (finance.Reminders), from the nightly job: to the weekly summary's
// topic, which the household's phones follow already, once a day.
func (h *homelab) sendFinanceReminders(ctx context.Context, now time.Time) {
	state := filepath.Join(h.logsDir(), "finance-reminders.json")
	var last struct {
		Day string `json:"day"`
	}
	if data, err := os.ReadFile(state); err == nil {
		_ = json.Unmarshal(data, &last)
	}
	today := now.Format("2006-01-02")
	if last.Day == today {
		return // sent already today
	}
	v, money, ok := h.financeView(now)
	if !ok {
		return
	}
	for _, r := range finance.Reminders(v, now, money) {
		h.ui.Info("Finances: %s", r.Title)
		h.alert(ctx, digestTopic, notify.Message{Title: r.Title, Body: r.Body, Priority: 3, Tags: []string{"moneybag"}})
	}
	last.Day = today
	if data, err := json.Marshal(last); err == nil {
		_ = os.MkdirAll(filepath.Dir(state), 0o755)
		_ = os.WriteFile(state, data, 0o644)
	}
}

// financeLines are Finances' lines for the weekly summary; none with no plan.
func (h *homelab) financeLines(now time.Time) []string {
	v, money, ok := h.financeView(now)
	if !ok {
		return nil
	}
	return finance.WeekLines(v, now, money)
}
