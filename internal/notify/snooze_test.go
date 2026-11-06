package notify

import (
	"testing"
	"time"
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
