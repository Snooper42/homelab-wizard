package history

// The alerts the computer sent (unison-handoff.md section 4, item 6): each
// kept 90 days beside the record of what was done, with when its problem
// cleared and who snoozed it, so the app and the phones can list them long
// after ntfy (which keeps 12 hours) has let them go. An alert that could
// carry an amount of money (Finances' reminders, the weekly summary) is
// kept only as a plain line the sender gives (notify.Message.Kept).

import (
	"errors"
	"os"
	"slices"
	"strings"
	"time"
)

// Alert is one alert as the record keeps it.
type Alert struct {
	ID int64     `json:"id"`
	At time.Time `json:"at"`
	// Topic is ntfy's topic it went to (tunnel-watchdog, duplicati-alerts…).
	Topic    string `json:"topic"`
	Title    string `json:"title"`
	Body     string `json:"body,omitempty"`
	Priority int    `json:"priority,omitempty"`
	// Checks are the watchdog's checks a down alert is about; it is
	// cleared once none of them fails. Other alerts have none.
	Checks []string `json:"checks,omitempty"`
	// ClearedAt is when its problem cleared; nil while it hasn't.
	ClearedAt *time.Time `json:"clearedAt,omitempty"`
	// SnoozedUntil and SnoozedBy: its check snoozed (Snooze… on Status),
	// until when and by whom (this computer, a phone by its name).
	SnoozedUntil *time.Time `json:"snoozedUntil,omitempty"`
	SnoozedBy    string     `json:"snoozedBy,omitempty"`
}

const (
	// MaxAlerts is the most kept (the newest), whatever their age.
	MaxAlerts = 5000
	// The longest title and body kept; a longer one is cut.
	maxAlertTitle = 200
	maxAlertBody  = 2000
	// alertsShown is the most Alerts gives at once.
	alertsShown = 200
)

// AddAlert keeps a (its ID and, when unset, At are filled in), then lets
// go of what's past the limits.
func (d *DB) AddAlert(a Alert) error {
	if a.At.IsZero() {
		a.At = time.Now()
	}
	a.Title = clean(a.Title, maxAlertTitle)
	if a.Title == "" {
		return errors.New("an alert needs its title")
	}
	var checks []string
	for _, c := range a.Checks {
		if c = clean(c, 80); c != "" {
			checks = append(checks, c)
		}
	}
	if _, err := d.db.Exec(`INSERT INTO alerts (at, topic, title, body, priority, checks) VALUES (?, ?, ?, ?, ?, ?)`,
		a.At.UnixMilli(), clean(a.Topic, 80), a.Title, cleanLines(a.Body, maxAlertBody), a.Priority, strings.Join(checks, "\n")); err != nil {
		return err
	}
	return d.trimAlerts(time.Now())
}

// trimAlerts lets go of alerts older than Keep, and all but the newest
// MaxAlerts.
func (d *DB) trimAlerts(now time.Time) error {
	if _, err := d.db.Exec(`DELETE FROM alerts WHERE at < ?`, now.Add(-Keep).UnixMilli()); err != nil {
		return err
	}
	_, err := d.db.Exec(`DELETE FROM alerts WHERE id <= (SELECT id FROM alerts ORDER BY id DESC LIMIT 1 OFFSET ?)`, MaxAlerts)
	return err
}

// openAlerts are the alerts about checks that haven't cleared, newest first.
func (d *DB) openAlerts() (map[int64][]string, []int64, error) {
	rows, err := d.db.Query(`SELECT id, checks FROM alerts WHERE cleared_at = 0 AND checks != '' AND at >= ? ORDER BY id DESC`, time.Now().Add(-Keep).UnixMilli())
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	checks := map[int64][]string{}
	var ids []int64
	for rows.Next() {
		var id int64
		var list string
		if err := rows.Scan(&id, &list); err != nil {
			return nil, nil, err
		}
		checks[id] = strings.Split(list, "\n")
		ids = append(ids, id)
	}
	return checks, ids, rows.Err()
}

// ClearAlerts marks cleared, at at, each open alert none of whose checks
// still fails (failing says one does).
func (d *DB) ClearAlerts(failing func(check string) bool, at time.Time) error {
	checks, ids, err := d.openAlerts()
	if err != nil {
		return err
	}
	for _, id := range ids {
		if slices.ContainsFunc(checks[id], failing) {
			continue
		}
		if _, err := d.db.Exec(`UPDATE alerts SET cleared_at = ? WHERE id = ?`, at.UnixMilli(), id); err != nil {
			return err
		}
	}
	return nil
}

// SnoozeAlert marks the newest open alert about check as snoozed until
// then, by who; a zero until (Alert again now) takes the mark off. A check
// with no open alert is nothing to mark.
func (d *DB) SnoozeAlert(check string, until time.Time, who string) error {
	checks, ids, err := d.openAlerts()
	if err != nil {
		return err
	}
	for _, id := range ids {
		if !slices.Contains(checks[id], check) {
			continue
		}
		var at int64
		if !until.IsZero() {
			at = until.UnixMilli()
		} else {
			who = ""
		}
		_, err := d.db.Exec(`UPDATE alerts SET snoozed_until = ?, snoozed_by = ? WHERE id = ?`, at, clean(who, 80), id)
		return err
	}
	return nil
}

// Alerts gives the alerts kept, newest first: at most limit (default and
// at most 200).
func (d *DB) Alerts(limit int) ([]Alert, error) {
	if limit <= 0 || limit > alertsShown {
		limit = alertsShown
	}
	rows, err := d.db.Query(`SELECT id, at, topic, title, body, priority, checks, cleared_at, snoozed_until, snoozed_by FROM alerts WHERE at >= ? ORDER BY id DESC LIMIT ?`,
		time.Now().Add(-Keep).UnixMilli(), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Alert{}
	for rows.Next() {
		var a Alert
		var at, cleared, until int64
		var checks string
		if err := rows.Scan(&a.ID, &at, &a.Topic, &a.Title, &a.Body, &a.Priority, &checks, &cleared, &until, &a.SnoozedBy); err != nil {
			return nil, err
		}
		a.At = time.UnixMilli(at)
		if checks != "" {
			a.Checks = strings.Split(checks, "\n")
		}
		if cleared > 0 {
			t := time.UnixMilli(cleared)
			a.ClearedAt = &t
		}
		if until > 0 {
			t := time.UnixMilli(until)
			a.SnoozedUntil = &t
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// cleanLines is s without control characters but its line breaks, its
// lines trimmed, at most max runes.
func cleanLines(s string, max int) string {
	lines := strings.Split(strings.ReplaceAll(s, "\r\n", "\n"), "\n")
	for i, l := range lines {
		lines[i] = clean(l, max)
	}
	s = strings.TrimSpace(strings.Join(lines, "\n"))
	if r := []rune(s); len(r) > max {
		s = string(r[:max-1]) + "…"
	}
	return s
}

// RecordAlert keeps a in root's record, best effort: an alert is sent
// whether or not its line could be kept.
func RecordAlert(root string, a Alert) {
	d, err := Open(root)
	if err != nil {
		return
	}
	defer d.Close()
	_ = d.AddAlert(a)
}

// ClearAlertsIn marks root's open alerts cleared, as DB.ClearAlerts; best
// effort, and nothing is made where nothing was kept.
func ClearAlertsIn(root string, failing func(check string) bool, at time.Time) {
	if _, err := os.Stat(Path(root)); err != nil {
		return
	}
	d, err := Open(root)
	if err != nil {
		return
	}
	defer d.Close()
	_ = d.ClearAlerts(failing, at)
}

// SnoozeAlertIn marks root's newest open alert about check snoozed, as
// DB.SnoozeAlert; best effort.
func SnoozeAlertIn(root, check string, until time.Time, who string) {
	if _, err := os.Stat(Path(root)); err != nil {
		return
	}
	d, err := Open(root)
	if err != nil {
		return
	}
	defer d.Close()
	_ = d.SnoozeAlert(check, until, who)
}

// AlertsIn is root's alerts, as DB.Alerts; none kept yet is an empty list.
func AlertsIn(root string, limit int) ([]Alert, error) {
	if _, err := os.Stat(Path(root)); os.IsNotExist(err) {
		return []Alert{}, nil
	}
	d, err := Open(root)
	if err != nil {
		return nil, err
	}
	defer d.Close()
	return d.Alerts(limit)
}
