package finance

import (
	"fmt"
	"time"
)

// How often a paycheck or payment comes.
const (
	Once        = "once"
	Weekly      = "week"
	Biweekly    = "2 weeks"
	TwiceMonth  = "twice a month"
	Monthly     = "month"
	Quarterly   = "3 months"
	Yearly      = "year"
	maxSchedule = 4000 // dates a schedule makes at most, a guard against a runaway loop
)

var everies = map[string]bool{Once: true, Weekly: true, Biweekly: true, TwiceMonth: true, Monthly: true, Quarterly: true, Yearly: true}

// Schedule is when something comes: from Start, every so often. A monthly
// one comes on Start's day of the month (the last day in a shorter month),
// a yearly one on Start's day each year, twice a month on Start's day and
// Day2.
type Schedule struct {
	Every string `json:"every"`
	Start string `json:"start"` // YYYY-MM-DD
	Day2  int    `json:"day2,omitempty"`
}

func (s Schedule) check(what string) error {
	if !everies[s.Every] {
		return fmt.Errorf("%s: unknown schedule %q", what, s.Every)
	}
	if _, err := day(s.Start, time.UTC); err != nil {
		return fmt.Errorf("%s: no start date", what)
	}
	if s.Every == TwiceMonth && (s.Day2 < 1 || s.Day2 > 31) {
		return fmt.Errorf("%s: twice a month needs its second day", what)
	}
	return nil
}

// Dates are the days it comes from from through to, both included, never
// before Start.
func (s Schedule) Dates(from, to time.Time) []time.Time {
	start, err := day(s.Start, from.Location())
	if err != nil || to.Before(from) {
		return nil
	}
	var out []time.Time
	keep := func(d time.Time) {
		if !d.Before(from) && !d.After(to) && !d.Before(start) {
			out = append(out, d)
		}
	}
	switch s.Every {
	case Once:
		keep(start)
	case Weekly, Biweekly:
		step := 7
		if s.Every == Biweekly {
			step = 14
		}
		d := start
		if from.After(start) {
			// Jump to the first date on or after from.
			n := int(from.Sub(start).Hours()/24) / step
			d = start.AddDate(0, 0, n*step)
		}
		for i := 0; !d.After(to) && i < maxSchedule; i++ {
			keep(d)
			d = d.AddDate(0, 0, step)
		}
	default:
		months := map[string]int{TwiceMonth: 1, Monthly: 1, Quarterly: 3, Yearly: 12}[s.Every]
		first := 0
		if from.After(start) {
			// Months from Start to from, less one so the first date is not skipped.
			first = ((from.Year()-start.Year())*12 + int(from.Month()-start.Month()) - 1) / months
			if first < 0 {
				first = 0
			}
		}
		for i := first; i < first+maxSchedule; i++ {
			y, m := start.Year(), start.Month()+time.Month(i*months)
			d := onDay(y, m, start.Day(), from.Location())
			if d.After(to) {
				break
			}
			keep(d)
			if s.Every == TwiceMonth {
				keep(onDay(y, m, s.Day2, from.Location()))
			}
		}
		sortDates(out)
	}
	return out
}

// onDay is day d of month m (the month's last day when it has fewer).
func onDay(y int, m time.Month, d int, loc *time.Location) time.Time {
	first := time.Date(y, m, 1, 0, 0, 0, 0, loc)
	last := first.AddDate(0, 1, -1).Day()
	if d > last {
		d = last
	}
	return time.Date(first.Year(), first.Month(), d, 0, 0, 0, 0, loc)
}

func sortDates(ds []time.Time) {
	for i := 1; i < len(ds); i++ {
		for j := i; j > 0 && ds[j].Before(ds[j-1]); j-- {
			ds[j], ds[j-1] = ds[j-1], ds[j]
		}
	}
}

// Holiday is the bank holiday on d's day, or "": the days the Federal
// Reserve banks close. One on a Sunday is kept on the Monday after; one on
// a Saturday is not moved (the banks open the Friday before).
func Holiday(d time.Time) string {
	y, m, n := d.Date()
	wd := d.Weekday()
	nth := func(month time.Month, weekday time.Weekday, k int) bool {
		return m == month && wd == weekday && (n-1)/7 == k-1
	}
	last := func(month time.Month, weekday time.Weekday) bool {
		return m == month && wd == weekday && n+7 > time.Date(y, month+1, 0, 0, 0, 0, 0, d.Location()).Day()
	}
	fixed := func(month time.Month, date int) bool {
		if m == month && n == date && wd != time.Saturday && wd != time.Sunday {
			return true
		}
		// On a Sunday: the Monday after.
		return wd == time.Monday && d.AddDate(0, 0, -1).Month() == month && d.AddDate(0, 0, -1).Day() == date
	}
	switch {
	case fixed(time.January, 1):
		return "New Year's Day"
	case nth(time.January, time.Monday, 3):
		return "Martin Luther King Jr. Day"
	case nth(time.February, time.Monday, 3):
		return "Presidents' Day"
	case last(time.May, time.Monday):
		return "Memorial Day"
	case fixed(time.June, 19):
		return "Juneteenth"
	case fixed(time.July, 4):
		return "Independence Day"
	case nth(time.September, time.Monday, 1):
		return "Labor Day"
	case nth(time.October, time.Monday, 2):
		return "Columbus Day"
	case fixed(time.November, 11):
		return "Veterans Day"
	case nth(time.November, time.Thursday, 4):
		return "Thanksgiving"
	case fixed(time.December, 25):
		return "Christmas"
	}
	return ""
}

// BankDay is d, or the business day before it when the banks are closed
// that day: when a paycheck lands.
func BankDay(d time.Time) (time.Time, string) {
	why := ""
	for i := 0; i < 10; i++ {
		h := Holiday(d)
		if d.Weekday() != time.Saturday && d.Weekday() != time.Sunday && h == "" {
			break
		}
		if why == "" {
			why = h
			if why == "" {
				why = "weekend"
			}
		}
		d = d.AddDate(0, 0, -1)
	}
	return d, why
}
