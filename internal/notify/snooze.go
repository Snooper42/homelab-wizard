package notify

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"
	"unicode"

	"github.com/Snooper42/homelab-wizard/internal/history"
	"github.com/Snooper42/homelab-wizard/internal/lockedfile"
)

// Snoozing an alert: one check the watchdog still runs and shows, but does
// not alert about until a time (an hour, a day), for a failure you already
// know of. Kept in data/alerts-snoozed.json, check name → until.

// SnoozePath is where the snoozes are kept.
func SnoozePath(root string) string { return filepath.Join(root, "data", "alerts-snoozed.json") }

// Snoozes are the snoozed checks and when each wakes; one past its time
// stays until the watchdog has seen it (Woken), so a check still failing
// then is alerted about.
type Snoozes map[string]time.Time

// LoadSnoozes reads the snoozes; none kept (or a record that does not
// read) is none.
func LoadSnoozes(root string) Snoozes {
	s := Snoozes{}
	if data, err := os.ReadFile(SnoozePath(root)); err == nil {
		_ = json.Unmarshal(data, &s)
	}
	return s
}

// Active says the check is snoozed now.
func (s Snoozes) Active(check string, now time.Time) bool {
	until, ok := s[check]
	return ok && now.Before(until)
}

// Asleep is the snoozes still running now, for Status.
func (s Snoozes) Asleep(now time.Time) map[string]time.Time {
	out := map[string]time.Time{}
	for k, v := range s {
		if now.Before(v) {
			out[k] = v
		}
	}
	return out
}

// Snooze snoozes check until then, under the record's lock. A zero time
// wakes it now: it stays until the watchdog's next run takes it (Woken),
// so a check still failing is alerted about then, as at a snooze's end.
func Snooze(root, check string, until time.Time) error {
	if until.IsZero() {
		until = time.Now()
	}
	return change(root, func(s Snoozes) { s[check] = until.Truncate(time.Second) })
}

// SnoozeHours snoozes check for hours from now, as Snooze… on Status
// does from the app or a phone: up to a week, 0 to wake it now. A check
// is a name the watchdog gives (an app, "disk /"): not empty, not long,
// no control characters.
func SnoozeHours(root, check string, hours int) error {
	if hours < 0 || hours > 24*7 {
		return fmt.Errorf("a snooze is up to a week, not %d hours", hours)
	}
	if check == "" || len(check) > 128 {
		return errors.New("that isn't one of the watchdog's checks")
	}
	for _, c := range check {
		if unicode.IsControl(c) {
			return errors.New("that isn't one of the watchdog's checks")
		}
	}
	return Snooze(root, check, snoozeUntil(hours))
}

// snoozeUntil is when a snooze of hours from now ends; zero for 0 (now).
func snoozeUntil(hours int) time.Time {
	if hours <= 0 {
		return time.Time{}
	}
	return time.Now().Add(time.Duration(hours) * time.Hour)
}

// SnoozeHoursBy is SnoozeHours, and marks the newest open alert about
// check in the computer's record of alerts with who snoozed it (this
// computer, a phone by its name), until when; 0 takes the mark off.
func SnoozeHoursBy(root, check string, hours int, who string) error {
	if err := SnoozeHours(root, check, hours); err != nil {
		return err
	}
	history.SnoozeAlertIn(root, check, snoozeUntil(hours), who)
	return nil
}

// Woken takes out the snoozes whose time has come and returns them: the
// watchdog alerts about any of them that still fails.
func Woken(root string, now time.Time) ([]string, error) {
	var woken []string
	err := change(root, func(s Snoozes) {
		for k, v := range s {
			if !now.Before(v) {
				woken = append(woken, k)
				delete(s, k)
			}
		}
	})
	return woken, err
}

func change(root string, fn func(Snoozes)) error {
	path := SnoozePath(root)
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	return lockedfile.Update(path, 0o600, func(old []byte) ([]byte, bool) {
		s := Snoozes{}
		_ = json.Unmarshal(old, &s)
		fn(s)
		data, err := json.MarshalIndent(s, "", "  ")
		if err != nil {
			return nil, false
		}
		return append(data, '\n'), true
	})
}
