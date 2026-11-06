package updates

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/lockedfile"
)

// An update window per app: an app the nightly update takes only on some
// days (Immich on Sundays, when no one is adding photos). The nightly run on
// another day leaves it out, as it leaves a held one. Kept in
// data/update-days.json ({"immich": ["sun"]}), beside the other records
// the homelab writes itself, not in .env; an app not in it is updated every
// night. homelab update <app> by name updates it whatever the day.

// DaysPath is where each app's update days are kept.
func DaysPath(root string) string { return filepath.Join(root, "data", "update-days.json") }

var dayNames = []string{"sun", "mon", "tue", "wed", "thu", "fri", "sat"}

// ParseDays reads days such as "sun", "sat+sun", "saturday,sunday", or
// "weekend"; "every" (or "") is every day, returned as none.
func ParseDays(s string) ([]time.Weekday, error) {
	s = strings.ToLower(strings.TrimSpace(s))
	switch s {
	case "", "every", "any", "daily", "nightly":
		return nil, nil
	case "weekend", "weekends":
		return []time.Weekday{time.Saturday, time.Sunday}, nil
	}
	var out []time.Weekday
	for _, f := range strings.FieldsFunc(s, func(r rune) bool { return r == '+' || r == ',' || r == ' ' }) {
		// sun, sund, sunday, sundays; tue, tues, tuesday
		i := slices.IndexFunc(dayNames, func(d string) bool {
			full := strings.ToLower(time.Weekday(slices.Index(dayNames, d)).String())
			return len(f) >= 3 && (strings.HasPrefix(full, f) || f == full+"s")
		})
		if i < 0 {
			return nil, fmt.Errorf("%q is not a day (sun, mon, … sat, or weekend)", f)
		}
		if d := time.Weekday(i); !slices.Contains(out, d) {
			out = append(out, d)
		}
	}
	slices.SortFunc(out, func(a, b time.Weekday) int { return int(dayOrder(a)) - int(dayOrder(b)) })
	if len(out) == 7 {
		return nil, nil
	}
	return out, nil
}

// dayOrder puts Monday first and Sunday last, as a week reads.
func dayOrder(d time.Weekday) int { return (int(d) + 6) % 7 }

// LoadDays reads each app's update days; none kept (or a record that does
// not read) is every night for every app.
func LoadDays(path string) map[string][]time.Weekday {
	raw := map[string][]string{}
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &raw)
	}
	out := map[string][]time.Weekday{}
	for id, names := range raw {
		if d, err := ParseDays(strings.Join(names, "+")); err == nil && len(d) > 0 {
			out[id] = d
		}
	}
	return out
}

// DueOn says whether the nightly update takes app on day.
func DueOn(days map[string][]time.Weekday, app string, day time.Weekday) bool {
	d, ok := days[app]
	return !ok || slices.Contains(d, day)
}

// SaveDays gives app its update days (none: every night), under the
// record's lock, so a change made at the same moment (the computer and a
// phone) is not lost; the other apps' are kept as they were.
func SaveDays(path, app string, days []time.Weekday) error {
	return lockedfile.Update(path, 0o644, func(old []byte) ([]byte, bool) {
		raw := map[string][]string{}
		_ = json.Unmarshal(old, &raw)
		delete(raw, app)
		if len(days) > 0 && len(days) < 7 {
			raw[app] = DayNames(days)
		}
		if len(raw) == 0 {
			return nil, true
		}
		data, _ := json.MarshalIndent(raw, "", "  ")
		return append(data, '\n'), true
	})
}

// DaysText says days as a sentence would: "Sundays", "Saturdays and
// Sundays", "Mondays, Wednesdays and Fridays"; "every night" for none.
func DaysText(days []time.Weekday) string {
	if len(days) == 0 {
		return "every night"
	}
	names := make([]string, len(days))
	for i, d := range days {
		names[i] = d.String() + "s"
	}
	if len(names) == 1 {
		return names[0]
	}
	return strings.Join(names[:len(names)-1], ", ") + " and " + names[len(names)-1]
}

// DayNames are days as .env writes them ("sun", "sat"), for the app's page.
func DayNames(days []time.Weekday) []string {
	out := make([]string, len(days))
	for i, d := range days {
		out[i] = dayNames[d]
	}
	return out
}
