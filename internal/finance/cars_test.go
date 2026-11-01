package finance

import (
	"math"
	"strings"
	"testing"
)

// A car's share of its price: its first year's drop taken evenly through
// the year, each year's after, by how it holds its value, never below a tenth.
func TestCarFactor(t *testing.T) {
	near := func(a, b float64) bool { return math.Abs(a-b) < 1e-9 }
	for _, c := range []struct {
		class string
		years float64
		want  float64
	}{
		{"", 0, 1}, {"", -1, 1}, {"", 0.5, 0.9}, {"", 1, 0.8}, {"", 2, 0.8 * 0.88}, {"", 3, 0.8 * 0.88 * 0.88},
		{"holds", 1, 0.88}, {"holds", 2, 0.88 * 0.92}, {"fast", 2, 0.75 * 0.84}, {"", 30, 0.1}, {"what", 1, 0.8},
	} {
		if got := carFactor(c.class, c.years); !near(got, c.want) {
			t.Errorf("%q after %v years: %v, want %v", c.class, c.years, got, c.want)
		}
	}
}

// A purchase is a car's alone, at a price not below nothing, on a day,
// held as Finances knows how.
func TestCleanCar(t *testing.T) {
	p := household()
	p.Accounts[1].Bought, p.Accounts[1].BoughtOn, p.Accounts[1].Holds = 5000, "2024-01-01", "fast"
	p.Accounts[5].Bought, p.Accounts[5].BoughtOn, p.Accounts[5].Holds = 30000, "2024-11-02", "holds"
	got, err := Clean(p)
	if err != nil || got.Accounts[1].Bought != 0 || got.Accounts[1].BoughtOn != "" || got.Accounts[1].Holds != "" || got.Accounts[5].Bought != 30000 || got.Accounts[5].Holds != "holds" {
		t.Fatalf("cleaned %+v %+v %v", got.Accounts[1], got.Accounts[5], err)
	}
	for _, c := range []struct {
		set  func(a *Account)
		want string
	}{
		{func(a *Account) { a.Bought = -1 }, "RAV4: type what it cost without a minus"},
		{func(a *Account) { a.BoughtOn = "last spring" }, `RAV4: no date "last spring"`},
		{func(a *Account) { a.Holds = "slowly" }, `RAV4: "slowly" is not how a car holds its value`},
	} {
		p := household()
		c.set(&p.Accounts[5])
		if _, err := Clean(p); err == nil || !strings.Contains(err.Error(), c.want) {
			t.Errorf("%v, want %q", err, c.want)
		}
	}
}

// Read ahead, a car with its purchase is worth its price at its age, or
// what was typed in since, fallen from that day on; the plan keeps what
// was typed. One with no purchase is as typed.
func TestCarNow(t *testing.T) {
	today := date("2026-11-02")
	near := func(a, b float64) bool { return math.Abs(a-b) < 0.02 }
	years := func(from string) float64 { return today.Sub(date(from)).Hours() / 24 / 365.25 }

	p := household()
	p.Accounts[5].Bought, p.Accounts[5].BoughtOn = 30000, "2024-11-02"
	v := Project(p, today, 4)
	if want := cents(30000 * carFactor("", years("2024-11-02"))); !near(v.Start["rav4"], want) || v.Plan.Accounts[5].Balance != 18500 {
		t.Errorf("from its price: %v, want %v; kept %v", v.Start["rav4"], want, v.Plan.Accounts[5].Balance)
	}
	// $18,500 typed in on Oct 1: a month's fall from there.
	p.Accounts[5].Updated = "2026-10-01"
	v = Project(p, today, 4)
	bought := date("2024-11-02")
	ratio := carFactor("", today.Sub(bought).Hours()/24/365.25) / carFactor("", date("2026-10-01").Sub(bought).Hours()/24/365.25)
	if want := cents(18500 * ratio); !near(v.Start["rav4"], want) || v.Start["rav4"] >= 18500 {
		t.Errorf("from what was typed: %v, want %v", v.Start["rav4"], want)
	}
	// Typed in before it was bought: read from its price.
	p.Accounts[5].Updated = "2024-01-01"
	if v := Project(p, today, 4); !near(v.Start["rav4"], cents(30000*carFactor("", years("2024-11-02")))) {
		t.Errorf("typed before the purchase: %v", v.Start["rav4"])
	}
	// Never below a tenth of its price, typed in low or not.
	p.Accounts[5].Updated, p.Accounts[5].Balance, p.Accounts[5].BoughtOn = "2026-10-01", 100, "1990-01-01"
	if v := Project(p, today, 4); v.Start["rav4"] != 3000 {
		t.Errorf("an old car: %v, want 3000", v.Start["rav4"])
	}
	// No purchase, no reading: as typed.
	if v := Project(household(), today, 4); v.Start["rav4"] != 18500 {
		t.Errorf("no purchase: %v", v.Start["rav4"])
	}
}
