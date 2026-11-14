package main

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/finance"
	"github.com/Snooper42/homelab-wizard/internal/notify"
)

// moneyIn writes an amount as Finances' screen does (finance.MoneyIn).
var moneyIn = finance.MoneyIn

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
	return finance.ProjectWith(p, l, now, finance.Ahead), finance.AlertMoney(p), true
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
		h.alert(ctx, digestTopic, reminderAlert(r))
	}
	last.Day = today
	h.noteSent(state, "Finances' reminders", last)
}

// financeLines are Finances' lines for the weekly summary; none with no
// plan. After the plan's, what the transactions say went out this week.
func (h *homelab) financeLines(now time.Time) []string {
	v, money, ok := h.financeView(now)
	if !ok {
		return nil
	}
	lines := finance.WeekLines(v, now, money)
	if l, err := finance.LoadLedger(finance.LedgerPath(h.root)); err == nil {
		if spent := finance.SpentLine(v.Plan, l, now, money); spent != "" {
			lines = append(lines, spent)
		}
	}
	return lines
}

// financeCalendar is Finances' calendar feed for a link's key: the plan's
// key, compared in constant time, or nothing; none set, no feed.
func (h *homelab) financeCalendar(key string) ([]byte, bool) {
	p, err := finance.Load(finance.Path(h.root))
	if err != nil || p.CalendarKey == "" || subtle.ConstantTimeCompare([]byte(key), []byte(p.CalendarKey)) != 1 {
		return nil, false
	}
	l, err := finance.LoadLedger(finance.LedgerPath(h.root))
	if err != nil {
		l = finance.Ledger{}
	}
	now := time.Now()
	return finance.ICS(finance.ProjectWith(p, l, now, finance.Ahead), p.CalendarAmounts, now, moneyIn(p.Currency)), true
}

// reminderAlert is a Finances reminder as an alert; the record of alerts
// keeps only its plain line, since its title and body can carry amounts.
func reminderAlert(r finance.Reminder) notify.Message {
	return notify.Message{Title: r.Title, Body: r.Body, Priority: 3, Tags: []string{"moneybag"}, Kept: "A Finances reminder"}
}
