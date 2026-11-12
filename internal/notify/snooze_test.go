package notify

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/history"
)

// TestSnooze: a check snoozed until a time is asleep until then; one whose
// time came is handed to the watchdog once (Woken) and is gone; a zero
// time wakes it at once.
func TestSnooze(t *testing.T) {
	root := t.TempDir()
	now := time.Date(2026, 11, 6, 14, 0, 0, 0, time.UTC)
	if s := LoadSnoozes(root); len(s) != 0 || s.Active("vaultwarden", now) {
		t.Fatalf("none kept: %v", s)
	}
	if err := Snooze(root, "crowdsec bouncer", now.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if err := Snooze(root, "disk /", now.Add(24*time.Hour)); err != nil {
		t.Fatal(err)
	}
	s := LoadSnoozes(root)
	if !s.Active("crowdsec bouncer", now) || s.Active("crowdsec bouncer", now.Add(time.Hour)) || s.Active("vaultwarden", now) {
		t.Fatalf("active: %v", s)
	}
	if a := s.Asleep(now.Add(2 * time.Hour)); len(a) != 1 || a["disk /"].IsZero() {
		t.Fatalf("asleep two hours on: %v", a)
	}
	woken, err := Woken(root, now.Add(2*time.Hour))
	if err != nil || len(woken) != 1 || woken[0] != "crowdsec bouncer" {
		t.Fatalf("woken: %v %v", woken, err)
	}
	if again, _ := Woken(root, now.Add(2*time.Hour)); len(again) != 0 {
		t.Fatalf("woken twice: %v", again)
	}
	// Woken early: no longer asleep, and the watchdog's next run takes it.
	if err := Snooze(root, "disk /", time.Time{}); err != nil {
		t.Fatal(err)
	}
	later := time.Now().Add(time.Second)
	if s := LoadSnoozes(root); s.Active("disk /", later) || len(s.Asleep(later)) != 0 {
		t.Fatalf("after waking it: %v", s)
	}
	if woken, _ := Woken(root, later); len(woken) != 1 || woken[0] != "disk /" {
		t.Fatalf("woken early, then: %v", woken)
	}
}

// TestSnoozeHours: Snooze… from the app or a phone, by hours: an hour or a
// day from now, 0 wakes it; more than a week, fewer than none, and a name
// that isn't one of the watchdog's checks are refused, and nothing changes.
func TestSnoozeHours(t *testing.T) {
	root := t.TempDir()
	if err := SnoozeHours(root, "disk /", 1); err != nil {
		t.Fatal(err)
	}
	until := LoadSnoozes(root)["disk /"]
	if d := time.Until(until); d < 59*time.Minute || d > 61*time.Minute {
		t.Fatalf("an hour, not %v", d)
	}
	if err := SnoozeHours(root, "disk /", 24*7); err != nil {
		t.Fatal(err)
	}
	if err := SnoozeHours(root, "disk /", 0); err != nil {
		t.Fatal(err)
	}
	if LoadSnoozes(root).Active("disk /", time.Now().Add(time.Second)) {
		t.Error("0 hours left it snoozed")
	}
	for _, bad := range []struct {
		check string
		hours int
	}{{"disk /", -1}, {"disk /", 24*7 + 1}, {"", 1}, {strings.Repeat("a", 129), 1}, {"disk\n/", 1}} {
		if err := SnoozeHours(root, bad.check, bad.hours); err == nil {
			t.Errorf("snoozed %q for %d hours", bad.check, bad.hours)
		}
	}
	if s := LoadSnoozes(root); len(s) != 1 {
		t.Errorf("a refused snooze changed the record: %v", s)
	}
}

// A snooze from the app or a phone marks the newest open alert about the
// check in the computer's record with who snoozed it, until when; a wrong
// one marks nothing.
func TestSnoozeHoursByMarksTheAlert(t *testing.T) {
	root := t.TempDir()
	history.RecordAlert(root, history.Alert{Title: "Homelab: something is down", Checks: []string{"immich"}})
	if err := SnoozeHoursBy(root, "immich", 25*24*7, "Sam's iPhone"); err == nil {
		t.Fatal("a snooze past a week passed")
	}
	if got, _ := history.AlertsIn(root, 0); got[0].SnoozedBy != "" {
		t.Fatalf("a refused snooze marked the alert: %+v", got[0])
	}
	if err := SnoozeHoursBy(root, "immich", 2, "Sam's iPhone"); err != nil {
		t.Fatal(err)
	}
	got, _ := history.AlertsIn(root, 0)
	if got[0].SnoozedBy != "Sam's iPhone" || got[0].SnoozedUntil == nil || got[0].SnoozedUntil.Sub(time.Now()) < 119*time.Minute {
		t.Fatalf("who and until when: %+v", got[0])
	}
	if !LoadSnoozes(root).Active("immich", time.Now()) {
		t.Fatal("not snoozed")
	}
	_ = SnoozeHoursBy(root, "immich", 0, history.ThisComputer)
	if got, _ := history.AlertsIn(root, 0); got[0].SnoozedBy != "" {
		t.Fatalf("woken, still marked: %+v", got[0])
	}
}

// The snoozes are a short list, not a store anything can fill (N42): a
// phone allowed changes could send SnoozeCheck name after name, each kept
// for up to a week. Past maxSnoozes a new name is refused; one already
// there can still be changed or woken, and the record stays as it was.
func TestSnoozesAreAShortList(t *testing.T) {
	root := t.TempDir()
	for i := range maxSnoozes {
		if err := SnoozeHours(root, fmt.Sprintf("check %d", i), 2); err != nil {
			t.Fatalf("snooze %d: %v", i, err)
		}
	}
	if err := SnoozeHours(root, "one more", 2); err == nil {
		t.Fatal("a snooze past the list's end was kept")
	}
	if got := len(LoadSnoozes(root)); got != maxSnoozes {
		t.Fatalf("%d snoozes kept, want %d", got, maxSnoozes)
	}
	if err := SnoozeHours(root, "check 3", 24); err != nil {
		t.Errorf("one already snoozed can't be changed: %v", err)
	}
	if err := SnoozeHours(root, "check 4", 0); err != nil {
		t.Errorf("one already snoozed can't be woken: %v", err)
	}
}
