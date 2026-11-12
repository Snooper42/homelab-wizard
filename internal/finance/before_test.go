package finance

import (
	"slices"
	"testing"
)

// Before is checking's paydays before today, newest first, for the
// Dashboard's period bar to step back into (a past period runs from one to
// the day before the next, and the screen reads it from the ledger). The
// household's: Alex every two weeks from Nov 6, Jordan on the 26th. Sep
// 26, 2026 is a Saturday, so Jordan's is paid Friday the 25th, the day of
// Alex's too: one payday, both people, the move said.
func TestBeforeIsTheLastPaydaysIntoChecking(t *testing.T) {
	p := household()
	v := Project(p, date("2026-10-30"), 4)
	if len(v.Before) != pastPaydays {
		t.Fatalf("%d paydays before today, want %d: %+v", len(v.Before), pastPaydays, v.Before)
	}
	var days []string
	for _, pd := range v.Before[:4] {
		days = append(days, pd.Date)
	}
	if want := []string{"2026-10-26", "2026-10-23", "2026-10-09", "2026-09-25"}; !slices.Equal(days, want) {
		t.Fatalf("the paydays before Oct 30: %v, want %v", days, want)
	}
	if got := v.Before[0]; !slices.Equal(got.People, []string{"jordan"}) || got.Amount != 2400 {
		t.Errorf("Oct 26: %+v", got)
	}
	both := v.Before[3]
	if !slices.Equal(both.People, []string{"alex", "jordan"}) || both.Amount != 4550 || len(both.Moved) != 1 || both.Moved[0].Person != "jordan" || both.Moved[0].From != "2026-09-26" {
		t.Errorf("Sep 25, both paid, Jordan's a day early: %+v", both)
	}
	for _, pd := range v.Before {
		if pd.Date >= v.Today {
			t.Errorf("%s is not before today", pd.Date)
		}
	}
}

// Someone paid only into savings starts no period, ahead or before; and
// today's own paycheck is now's, not before.
func TestBeforeLeavesOutChecksIntoOtherAccountsAndToday(t *testing.T) {
	p := household()
	p.People[1].Account = "sav"
	v := Project(p, date("2026-10-23"), 4)
	for _, pd := range v.Before {
		if slices.Contains(pd.People, "jordan") {
			t.Errorf("a check into savings starts a past period: %+v", pd)
		}
		if pd.Date == "2026-10-23" {
			t.Errorf("today's paycheck is before today: %+v", pd)
		}
	}
	if len(v.Before) == 0 || v.Before[0].Date != "2026-10-09" {
		t.Errorf("the last payday before Oct 23: %+v", v.Before)
	}
}
