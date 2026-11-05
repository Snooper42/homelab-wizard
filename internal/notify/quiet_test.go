package notify

import (
	"testing"
	"time"
)

func TestQuietHours(t *testing.T) {
	at := func(h, m int) time.Time { return time.Date(2026, 11, 5, h, m, 0, 0, time.Local) }
	for _, c := range []struct {
		setting string
		now     time.Time
		quiet   bool
	}{
		{"", at(23, 0), true},       // the default, 22-7
		{"", at(6, 59), true},       // still the night
		{"", at(7, 0), false},       // morning
		{"", at(21, 59), false},     // evening
		{"22-7", at(22, 0), true},   // from its first hour
		{"23-6", at(22, 30), false}, // another night
		{"13-15", at(14, 0), true},  // a nap, not past midnight
		{"13-15", at(15, 0), false},
		{"off", at(3, 0), false},
		{"late", at(3, 0), false}, // unreadable: every alert sounds
		{"22-22", at(22, 0), false},
		{"25-7", at(3, 0), false},
	} {
		if got := InQuietHours(c.setting, c.now); got != c.quiet {
			t.Errorf("%q at %s: quiet %v, want %v", c.setting, c.now.Format("15:04"), got, c.quiet)
		}
	}
}

func TestHush(t *testing.T) {
	night := time.Date(2026, 11, 5, 2, 0, 0, 0, time.Local)
	day := time.Date(2026, 11, 5, 14, 0, 0, 0, time.Local)
	for _, c := range []struct {
		priority, want int
		now            time.Time
		setting        string
	}{
		{4, 2, night, ""}, // an app down at 2 AM: no sound
		{0, 2, night, ""}, // ntfy's default would sound
		{Serious, Serious, night, ""},
		{4, 4, day, ""},      // the day is as it was
		{4, 4, night, "off"}, // quiet hours turned off
		{1, 1, night, ""},    // already silent: never raised
		{2, 2, night, ""},
	} {
		got := Hush(Message{Title: "t", Priority: c.priority}, c.setting, c.now).Priority
		if got != c.want {
			t.Errorf("priority %d at %s (%q) = %d, want %d", c.priority, c.now.Format("15:04"), c.setting, got, c.want)
		}
	}
}
