package finance

import (
	"fmt"
	"strings"
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
	Paycheck    = "paycheck" // with each of someone's paychecks (Schedule.Person), or with every one into checking (no Person)
	maxSchedule = 4000       // dates a schedule makes at most, a guard against a runaway loop
)

var everies = map[string]bool{Once: true, Weekly: true, Biweekly: true, TwiceMonth: true, Monthly: true, Quarterly: true, Yearly: true, Paycheck: true}

// Schedule is when something comes: from Start, every so often. A monthly
// one comes on Start's day of the month (the last day in a shorter month),
// a yearly one on Start's day each year, twice a month on Start's day and
// Day2. A payment with each paycheck comes on the days Person is paid,
// or with no Person on each payday into checking, whoever is paid
// (Plan.Dates).
type Schedule struct {
	Every  string `json:"every"`
	Start  string `json:"start"` // YYYY-MM-DD
	Day2   int    `json:"day2,omitempty"`
	Person string `json:"person,omitempty"`
}

func (s Schedule) check(what string) error {
	if !everies[s.Every] {
		return fmt.Errorf("%s: unknown schedule %q", what, s.Every)
	}
	if s.Every == Paycheck {
		// No one named: with each paycheck into checking, whoever is paid.
		return nil
	}
	if _, err := day(s.Start, time.UTC); err != nil {
		return fmt.Errorf("%s: no start date", what)
	}
	if s.Every == TwiceMonth && (s.Day2 < 1 || s.Day2 > 31) {
		return fmt.Errorf("%s: twice a month needs its second day", what)
	}
	if start, _ := day(s.Start, time.UTC); s.Every == TwiceMonth && s.Day2 == start.Day() {
		return fmt.Errorf("%s: twice a month needs a second day that is not the first", what)
	}
	return nil
}

// Dates are the days it comes from from through to, both included, never
// before Start. With each paycheck it has none of its own: Plan.Dates has them.
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
			// The 30th and 31st are one day in February: it comes once.
			if d2 := onDay(y, m, s.Day2, from.Location()); s.Every == TwiceMonth && !d2.Equal(d) {
				keep(d2)
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

// HolidayIn is the bank holiday on d's day in a calendar (US, UK, or
// Weekends for none), or "".
func HolidayIn(d time.Time, calendar string) string {
	switch calendar {
	case UK:
		return ukHolidays(d.Year(), d.Location())[dateOf(d)]
	case Weekends:
		return ""
	}
	return Holiday(d)
}

// ukHolidays are England and Wales' bank holidays in a year, by day: one
// on a weekend is kept on the next weekday.
func ukHolidays(y int, loc *time.Location) map[string]string {
	at := func(m time.Month, d int) time.Time { return time.Date(y, m, d, 0, 0, 0, 0, loc) }
	weekend := func(d time.Time) bool { return d.Weekday() == time.Saturday || d.Weekday() == time.Sunday }
	nextWeekday := func(d time.Time, taken map[string]string) time.Time {
		for weekend(d) || taken[dateOf(d)] != "" {
			d = d.AddDate(0, 0, 1)
		}
		return d
	}
	firstMonday := func(m time.Month) time.Time {
		d := at(m, 1)
		for d.Weekday() != time.Monday {
			d = d.AddDate(0, 0, 1)
		}
		return d
	}
	lastMonday := func(m time.Month) time.Time {
		d := at(m+1, 0)
		for d.Weekday() != time.Monday {
			d = d.AddDate(0, 0, -1)
		}
		return d
	}
	easter := easterSunday(y, loc)
	out := map[string]string{}
	out[dateOf(nextWeekday(at(time.January, 1), out))] = "New Year's Day"
	out[dateOf(easter.AddDate(0, 0, -2))] = "Good Friday"
	out[dateOf(easter.AddDate(0, 0, 1))] = "Easter Monday"
	out[dateOf(firstMonday(time.May))] = "Early May bank holiday"
	out[dateOf(lastMonday(time.May))] = "Spring bank holiday"
	out[dateOf(lastMonday(time.August))] = "Summer bank holiday"
	out[dateOf(nextWeekday(at(time.December, 25), out))] = "Christmas"
	out[dateOf(nextWeekday(at(time.December, 26), out))] = "Boxing Day"
	return out
}

// easterSunday is Easter in year y (the Gregorian computus).
func easterSunday(y int, loc *time.Location) time.Time {
	a, b, c := y%19, y/100, y%100
	d, e := b/4, b%4
	f := (b + 8) / 25
	g := (b - f + 1) / 3
	h := (19*a + b - d - g + 15) % 30
	i, k := c/4, c%4
	l := (32 + 2*e + 2*i - h - k) % 7
	m := (a + 11*h + 22*l) / 451
	month := (h + l - 7*m + 114) / 31
	day := (h+l-7*m+114)%31 + 1
	return time.Date(y, time.Month(month), day, 0, 0, 0, 0, loc)
}

// BankDay is d, or the business day before it when the banks are closed
// that day: when a paycheck lands (US bank holidays).
func BankDay(d time.Time) (time.Time, string) { return BankDayIn(d, US) }

// BankDayIn is BankDay with a calendar's holidays.
func BankDayIn(d time.Time, calendar string) (time.Time, string) {
	// Every reason it moved, in order: "the weekend and Christmas".
	var why []string
	add := func(r string) {
		if len(why) == 0 || why[len(why)-1] != r {
			why = append(why, r)
		}
	}
	for i := 0; i < 10; i++ {
		h := HolidayIn(d, calendar)
		weekend := d.Weekday() == time.Saturday || d.Weekday() == time.Sunday
		if !weekend && h == "" {
			break
		}
		if h != "" {
			add(h)
		} else {
			add("the weekend")
		}
		d = d.AddDate(0, 0, -1)
	}
	if n := len(why); n > 1 {
		return d, strings.Join(why[:n-1], ", ") + " and " + why[n-1]
	}
	return d, strings.Join(why, "")
}
