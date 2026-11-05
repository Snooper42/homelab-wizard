package updates

import (
	"fmt"
	"slices"
	"strings"
	"time"
)

// An update window per app: an app the nightly update takes only on some
// days (Immich on Sundays, when no one is adding photos). The nightly run on
// another day leaves it out, as it leaves a held one. Kept in .env as
// UPDATE_DAYS=immich:sun,nextcloud:sat+sun; an app not listed is updated
// every night. homelab update <app> by name updates it whatever the day.

// DaysKey is the .env key holding each app's update days.
const DaysKey = "UPDATE_DAYS"

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

// Days is each app's update days, from .env values; an app not in it is
// updated every night.
func Days(env map[string]string) map[string][]time.Weekday {
	out := map[string][]time.Weekday{}
	for _, part := range strings.Split(env[DaysKey], ",") {
		id, days, ok := strings.Cut(strings.TrimSpace(part), ":")
		if !ok || strings.TrimSpace(id) == "" {
			continue
		}
		if d, err := ParseDays(days); err == nil && len(d) > 0 {
			out[strings.TrimSpace(id)] = d
		}
	}
	return out
}

// DueOn says whether the nightly update takes app on day.
func DueOn(env map[string]string, app string, day time.Weekday) bool {
	d, ok := Days(env)[app]
	return !ok || slices.Contains(d, day)
}

// SetDays gives app its update days (none: every night) and returns the new
// value for DaysKey, the other apps' kept as they were.
func SetDays(env map[string]string, app string, days []time.Weekday) string {
	all := Days(env)
	delete(all, app)
	if len(days) > 0 && len(days) < 7 {
		all[app] = days
	}
	ids := make([]string, 0, len(all))
	for id := range all {
		ids = append(ids, id)
	}
	slices.Sort(ids)
	var parts []string
	for _, id := range ids {
		var names []string
		for _, d := range all[id] {
			names = append(names, dayNames[d])
		}
		parts = append(parts, id+":"+strings.Join(names, "+"))
	}
	return strings.Join(parts, ",")
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
