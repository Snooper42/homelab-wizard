package finance

import (
	"strings"
	"testing"
	"time"
)

// The calendar: a day's event for each payday and bill, money into
// savings left out; amounts only when asked for; text escaped, long lines
// folded, every line ending in CRLF.
func TestICS(t *testing.T) {
	p := household()
	p.Updated = "2026-10-28"
	p.Payments = append(p.Payments, Payment{ID: "long", Name: "Water, sewer; and the city's trash pickup for the whole of the street and the block", Amount: 120, Schedule: Schedule{Every: Monthly, Start: "2026-01-03"}})
	today := date("2026-11-02")
	v := ProjectWith(p, Ledger{}, today, 4)
	stamp := time.Date(2026, 11, 2, 4, 0, 0, 0, time.UTC)
	cal := string(ICS(v, false, stamp, usd))
	for _, want := range []string{"BEGIN:VCALENDAR\r\nVERSION:2.0\r\n", "X-WR-CALNAME:Paydays and bills\r\n", "UID:payday-2026-11-06@finances.homelab\r\nDTSTAMP:20261102T040000Z\r\nDTSTART;VALUE=DATE:20261106\r\nDTEND;VALUE=DATE:20261107\r\nSUMMARY:Alex paid\r\n",
		"UID:mortgage-2026-12-01@finances.homelab", "SUMMARY:Mortgage\r\n", "SUMMARY:Water\\, sewer\\; and the city's trash pickup for the whole of the st\r\n reet and the block\r\n", "END:VCALENDAR\r\n"} {
		if !strings.Contains(cal, want) {
			t.Errorf("no %q in\n%s", want, cal)
		}
	}
	if strings.Contains(cal, "SUMMARY:Savings") || strings.Contains(cal, "$") {
		t.Errorf("a transfer into savings, or an amount, in\n%s", cal)
	}
	for _, line := range strings.Split(strings.TrimSuffix(cal, "\r\n"), "\r\n") {
		if len(line) > 75 || strings.Contains(line, "\n") {
			t.Errorf("a line too long or broken: %q", line)
		}
	}
	cal = string(ICS(v, true, stamp, usd))
	if !strings.Contains(cal, "SUMMARY:Mortgage $1845.00\r\n") || !strings.Contains(cal, "SUMMARY:Alex paid $2150.00\r\n") {
		t.Errorf("amounts missing in\n%s", cal)
	}
	// Two paid on one day are one event naming both.
	p.People[1].Schedule = Schedule{Every: Monthly, Start: "2026-01-06"}
	if cal := string(ICS(ProjectWith(p, Ledger{}, today, 4), false, stamp, usd)); !strings.Contains(cal, "SUMMARY:Alex and Jordan paid\r\n") {
		t.Errorf("two on a day:\n%s", cal)
	}
}

// A calendar link's key is long and only letters and digits; none turns
// the feed off, and its amounts with it.
func TestCalendarKey(t *testing.T) {
	p := household()
	p.CalendarKey, p.CalendarAmounts = strings.Repeat("aZ9", 11), true
	if got, err := Clean(p); err != nil || got.CalendarKey != p.CalendarKey || !got.CalendarAmounts {
		t.Fatalf("kept %q %v, %v", got.CalendarKey, got.CalendarAmounts, err)
	}
	for _, k := range []string{"short", strings.Repeat("a", 31), strings.Repeat("a", 129), strings.Repeat("a", 31) + "/", strings.Repeat("ab", 20) + "?x=1"} {
		p.CalendarKey = k
		if _, err := Clean(p); err == nil {
			t.Errorf("%q kept", k)
		}
	}
	p.CalendarKey = ""
	if got, _ := Clean(p); got.CalendarAmounts {
		t.Error("amounts with no feed")
	}
}
