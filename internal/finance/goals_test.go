package finance

import (
	"math"
	"strings"
	"testing"
)

// A goal needs a name, a target, a day if any, and shares of accounts
// that hold money, each more than nothing and at most all of it; no
// account is shared out past all it holds across the goals.
func TestCleanGoals(t *testing.T) {
	for _, c := range []struct {
		goals []Goal
		want  string
	}{
		{[]Goal{{Target: 100}}, "a goal has no name"},
		{[]Goal{{Name: "Trip"}}, "Trip: type how much it needs"},
		{[]Goal{{Name: "Trip", Target: 100, Date: "next June"}}, `Trip: no date "next June"`},
		{[]Goal{{Name: "Trip", Target: 100, Shares: []GoalShare{{Account: "gone", Percent: 50}}}}, `Trip: no account "gone"`},
		{[]Goal{{Name: "Trip", Target: 100, Shares: []GoalShare{{Account: "visa", Percent: 50}}}}, "Trip: Chase Freedom holds no money to put by"},
		{[]Goal{{Name: "Trip", Target: 100, Shares: []GoalShare{{Account: "sav", Percent: 50}, {Account: "sav", Percent: 10}}}}, "Trip: Savings is in it twice"},
		{[]Goal{{Name: "Trip", Target: 100, Shares: []GoalShare{{Account: "sav", Percent: 0}}}}, "more than nothing and at most 100%"},
		{[]Goal{{Name: "Trip", Target: 100, Shares: []GoalShare{{Account: "sav", Percent: 150}}}}, "more than nothing and at most 100%"},
		{[]Goal{{Name: "Trip", Target: 100, Shares: []GoalShare{{Account: "sav", Percent: 60}}}, {Name: "Car", Target: 100, Shares: []GoalShare{{Account: "sav", Percent: 50}}}}, "Savings is shared out past all it holds: 110%"},
	} {
		p := household()
		p.Goals = c.goals
		if _, err := Clean(p); err == nil || !strings.Contains(err.Error(), c.want) {
			t.Errorf("%+v: %v, want %q", c.goals, err, c.want)
		}
	}
	p := household()
	p.Goals = []Goal{{Name: " Emergency fund ", Target: 10000.004, Shares: []GoalShare{{Account: "sav", Percent: 60}, {Account: "chk", Percent: 10}}}, {Name: "Car", Target: 5000, Shares: []GoalShare{{Account: "sav", Percent: 40}}}}
	got, err := Clean(p)
	if err != nil || got.Goals[0].ID != "emergency-fund" || got.Goals[0].Name != "Emergency fund" || got.Goals[0].Target != 10000 || got.Goals[1].ID != "car" {
		t.Fatalf("cleaned %+v %v", got.Goals, err)
	}
}

// A goal today: its share of each account as it stands, what is left, a
// month's and a paycheck's need to its day, and the pace the accounts kept
// over about three months, with the month it reaches the target.
func TestGoalsNow(t *testing.T) {
	p := household()
	p.Updated = "2026-10-28"
	p.Accounts[1].History = []Point{{Date: "2026-06-01", Amount: 5000}, {Date: "2026-07-28", Amount: 5900}, {Date: "2026-09-30", Amount: 6300}}
	p.Goals = []Goal{
		{Name: "Emergency fund", Target: 10000, Date: "2027-10-28", Shares: []GoalShare{{Account: "sav", Percent: 100}}},
		{Name: "Boat", Target: 25000, Date: "2026-12-01", Shares: []GoalShare{{Account: "k401", Percent: 50}}},
		{Name: "Rainy day", Target: 40, Shares: []GoalShare{{Account: "chk", Percent: 10}}},
		{Name: "Late", Target: 40000, Date: "2026-10-01", Shares: []GoalShare{{Account: "k401", Percent: 50}}},
	}
	p, err := Clean(p)
	if err != nil {
		t.Fatal(err)
	}
	today := date("2026-11-02")
	v := Project(p, today, 4)
	near := func(a, b float64) bool { return math.Abs(a-b) < 0.02 }
	if len(v.Goals) != 4 {
		t.Fatalf("goals %+v", v.Goals)
	}

	// The emergency fund: all of savings; a pace from Jul 28 (97 days back, the reading three months ago).
	g, sav := v.Goals[0], v.Start["sav"]
	pace := (sav - 5900) / (97 / 30.44)
	if !near(g.Saved, sav) || !near(g.Left, 10000-sav) || !g.Paced || !near(g.Pace, pace) {
		t.Errorf("emergency fund: %+v (savings %v, pace %v)", g, sav, pace)
	}
	if !near(g.NeedsMonth, (10000-sav)/(360/30.44)) || g.NeedsPaycheck <= 0 {
		t.Errorf("emergency fund needs %v a month, %v a paycheck", g.NeedsMonth, g.NeedsPaycheck)
	}
	months := int(math.Ceil((10000 - sav) / pace))
	at := monthsOn(today, months)
	// At about $189 a month, the $3,500 left takes 19 months: June 2028, after its day.
	if g.Reaches != at.Format("2006-01") || !g.Behind {
		t.Errorf("emergency fund reaches %s (want %s), behind %v", g.Reaches, at.Format("2006-01"), g.Behind)
	}

	// The boat: half the 401(k), no history so no pace; three paydays before Dec 1 (Alex Nov 6 and 20, Jordan Nov 26).
	g = v.Goals[1]
	left := 25000 - v.Start["k401"]/2
	if !near(g.Left, left) || g.Paced || g.Reaches != "" || !g.Behind || !near(g.NeedsPaycheck, left/3) || !near(g.NeedsMonth, left) {
		t.Errorf("boat: %+v, left %v", g, left)
	}

	// Reached: nothing left, needed, or behind.
	g = v.Goals[2]
	if g.Left != 0 || g.NeedsMonth != 0 || g.NeedsPaycheck != 0 || g.Reaches != "" || g.Behind || !near(g.Saved, v.Start["chk"]/10) {
		t.Errorf("rainy day: %+v", g)
	}
	// Its day gone and not reached: behind, nothing a month (all of it is due).
	g = v.Goals[3]
	if g.Left <= 0 || g.NeedsMonth != 0 || !g.Behind {
		t.Errorf("late: %+v", g)
	}
	// No goals: none read.
	if v := Project(household(), today, 4); v.Goals != nil {
		t.Errorf("goals with none: %+v", v.Goals)
	}
}

// The FIRE estimate's two assumptions are kept within reason: a share to
// spend a year from 0 (the default, 4) to 20%, growth from -10 to 20%.
func TestFireAssumptions(t *testing.T) {
	p := household()
	p.Withdraw, p.Growth = 3.5, 6
	if got, err := Clean(p); err != nil || got.Withdraw != 3.5 || got.Growth != 6 {
		t.Fatalf("kept %v %v, %v", got.Withdraw, got.Growth, err)
	}
	for _, c := range []struct{ w, g float64 }{{-1, 5}, {25, 5}, {4, -11}, {4, 21}, {math.NaN(), 5}} {
		p.Withdraw, p.Growth = c.w, c.g
		if _, err := Clean(p); err == nil {
			t.Errorf("%v%% and %v%% kept", c.w, c.g)
		}
	}
}
