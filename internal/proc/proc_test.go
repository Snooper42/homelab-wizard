package proc

import (
	"os"
	"testing"
	"time"
)

// This process runs, and has a start time before now; one that never was
// has neither.
func TestThisProcess(t *testing.T) {
	if !Alive(os.Getpid()) {
		t.Error("this process is not running")
	}
	if Alive(1 << 30) {
		t.Error("a process that never was is running")
	}
	at, ok := Started(os.Getpid())
	if !ok {
		t.Skip("this system does not say when a process started")
	}
	if at.After(time.Now()) || time.Since(at) > 24*time.Hour {
		t.Errorf("this process started at %v", at)
	}
	if _, ok := Started(1 << 30); ok {
		t.Error("a process that never was has a start time")
	}
	if !System.Holds(os.Getpid(), time.Now()) || System.Holds(os.Getpid(), at.Add(-time.Hour)) {
		t.Error("this process holds what it wrote just now, and not what was written before it started")
	}
}

func TestHolds(t *testing.T) {
	since := time.Date(2026, 11, 6, 3, 0, 0, 0, time.UTC)
	for _, c := range []struct {
		name    string
		alive   bool
		began   time.Time
		known   bool
		since   time.Time
		pid     int
		holding bool
	}{
		{"gone", false, since.Add(-time.Hour), true, since, 7, false},
		{"started before", true, since.Add(-time.Hour), true, since, 7, true},
		{"started within the slack", true, since.Add(4 * time.Second), true, since, 7, true},
		{"started after: the ID was reused", true, since.Add(time.Minute), true, since, 7, false},
		{"start unknown", true, time.Time{}, false, since, 7, true},
		{"written when, unknown", true, since.Add(time.Hour), true, time.Time{}, 7, true},
		{"no process", true, since, true, since, 0, false},
	} {
		p := Process{Alive: func(int) bool { return c.alive }, Started: func(int) (time.Time, bool) { return c.began, c.known }}
		if got := p.Holds(c.pid, c.since); got != c.holding {
			t.Errorf("%s: holds %v, want %v", c.name, got, c.holding)
		}
	}
}
