package notify

import (
	"strconv"
	"strings"
	"time"
)

// Quiet hours: the night, when alerts reach the phone without a sound
// unless they are serious. Not the apps whose alerts are off (quiet.go).

// QuietHoursKey is the .env setting for the night: "22-7" (the default)
// sends what comes between 22:00 and 07:00 without a sound, unless it is
// serious (Priority 5: the vault unreachable, backups failing for days);
// "off" sounds every alert.
const QuietHoursKey = "QUIET_HOURS"

// DefaultQuietHours is the night when QUIET_HOURS is not set.
const DefaultQuietHours = "22-7"

// Serious is the priority that sounds at any hour.
const Serious = 5

// hushed is the priority an alert in the quiet hours goes out at: ntfy's
// "low", shown without a sound or a vibration.
const hushed = 2

// QuietHours reads a setting such as "22-7" into its first and last-but-one
// hour; ok is false for "off" or a setting it cannot read.
func QuietHours(v string) (from, to int, ok bool) {
	v = strings.TrimSpace(v)
	if v == "" {
		v = DefaultQuietHours
	}
	a, b, found := strings.Cut(v, "-")
	if !found {
		return 0, 0, false
	}
	from, errA := strconv.Atoi(strings.TrimSpace(a))
	to, errB := strconv.Atoi(strings.TrimSpace(b))
	if errA != nil || errB != nil || from < 0 || from > 23 || to < 0 || to > 23 || from == to {
		return 0, 0, false
	}
	return from, to, true
}

// InQuietHours says whether now falls in the quiet hours of setting v,
// which may run past midnight (22-7) or not (13-15).
func InQuietHours(v string, now time.Time) bool {
	from, to, ok := QuietHours(v)
	if !ok {
		return false
	}
	h := now.Hour()
	if from < to {
		return h >= from && h < to
	}
	return h >= from || h < to
}

// Hush sends m without a sound in the quiet hours, unless it is serious.
// It only ever lowers: an alert already quiet (min or low) is left as it is.
func Hush(m Message, v string, now time.Time) Message {
	if m.Priority >= Serious || m.Priority > 0 && m.Priority <= hushed || !InQuietHours(v, now) {
		return m
	}
	m.Priority = hushed
	return m
}
