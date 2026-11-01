package finance

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

// The calendar feed: the paydays and bills ahead as an iCalendar file a
// phone's calendar subscribes to (homelab serve's /finances.ics, by the
// plan's CalendarKey). Each is a day's event; a bill names its amount only
// when the household said so (CalendarAmounts), as a calendar is often
// shared or glanced at by others.

// icsText escapes words for an iCalendar value: backslashes, commas,
// semicolons, and line breaks.
func icsText(s string) string {
	return strings.NewReplacer(`\`, `\\`, ",", `\,`, ";", `\;`, "\r\n", `\n`, "\n", `\n`).Replace(s)
}

// icsFold breaks a line longer than 75 bytes, as iCalendar wants, each
// further piece starting with a space, never inside a character.
func icsFold(line string) string {
	var b strings.Builder
	n := 0
	for _, r := range line {
		size := len(string(r))
		if n+size > 75 {
			b.WriteString("\r\n ")
			n = 1
		}
		b.WriteRune(r)
		n += size
	}
	return b.String()
}

// ICS is the plan read ahead as a calendar: a day's event for each payday
// and each bill (not money moved into savings or into checking), dated
// stamp, with amounts written by money when amounts is on.
func ICS(v View, amounts bool, stamp time.Time, money func(float64) string) []byte {
	names := map[string]string{}
	for _, x := range v.Plan.WithCards() {
		names[x.ID] = x.Name
	}
	people := map[string]string{}
	for _, e := range v.Plan.People {
		people[e.ID] = e.Name
	}
	type event struct{ uid, day, title string }
	var events []event
	for _, p := range v.Paydays {
		var who []string
		for _, id := range p.People {
			if n := people[id]; n != "" {
				who = append(who, n)
			}
		}
		title := "Payday"
		if len(who) > 0 {
			title = strings.Join(who, " and ") + " paid"
		}
		if amounts {
			title += " " + money(p.Total)
		}
		events = append(events, event{"payday-" + p.Date, p.Date, title})
	}
	for _, per := range v.Periods {
		for _, r := range per.Rows {
			name, ok := names[r.Payment]
			if !ok || r.Saved || r.Into {
				continue
			}
			title := name
			if amounts {
				title += " " + money(r.Amount)
				if r.Estimate {
					title += " (about)"
				}
			}
			events = append(events, event{r.Payment + "-" + r.Date, r.Date, title})
		}
	}
	sort.SliceStable(events, func(i, j int) bool { return events[i].day < events[j].day })
	lines := []string{"BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Homelab Wizard//Finances//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
		"X-WR-CALNAME:Paydays and bills", "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H"}
	seen := map[string]bool{}
	for _, e := range events {
		d, err := day(e.day, time.UTC)
		if err != nil || seen[e.uid] {
			continue
		}
		seen[e.uid] = true
		lines = append(lines, "BEGIN:VEVENT",
			"UID:"+e.uid+"@finances.homelab",
			"DTSTAMP:"+stamp.UTC().Format("20060102T150405Z"),
			"DTSTART;VALUE=DATE:"+d.Format("20060102"),
			"DTEND;VALUE=DATE:"+d.AddDate(0, 0, 1).Format("20060102"),
			icsFold("SUMMARY:"+icsText(e.title)),
			"TRANSP:TRANSPARENT",
			"END:VEVENT")
	}
	lines = append(lines, "END:VCALENDAR")
	return []byte(strings.Join(lines, "\r\n") + "\r\n")
}

// CalendarKeyOK is the shape of a calendar link's key: long, random, and
// only letters and digits, so it can sit in a URL as it is.
func CalendarKeyOK(k string) bool {
	if len(k) < 32 || len(k) > 128 {
		return false
	}
	for _, c := range k {
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9') {
			return false
		}
	}
	return true
}

// calendarError says what is wrong with a key typed in or sent.
func calendarError(k string) error {
	if k != "" && !CalendarKeyOK(k) {
		return fmt.Errorf("a calendar link's key is 32 to 128 letters and digits")
	}
	return nil
}
