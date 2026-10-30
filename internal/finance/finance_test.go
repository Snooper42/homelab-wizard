package finance

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

func date(s string) time.Time {
	d, err := day(s, time.UTC)
	if err != nil {
		panic(err)
	}
	return d
}

// household is two earners, a checking account, a card, savings, a 401(k), and a car loan.
func household() Plan {
	return Plan{
		Cushion: 500,
		People: []Earner{
			{ID: "alex", Name: "Alex", Net: 2150, Schedule: Schedule{Every: Biweekly, Start: "2026-11-06"}, Gross: 3050,
				Deductions: []Deduction{{Name: "401(k)", Amount: 183, Account: "k401"}, {Name: "Medical", Amount: 118}}},
			{ID: "jordan", Name: "Jordan", Net: 2400, Schedule: Schedule{Every: Monthly, Start: "2026-01-26"}},
		},
		Accounts: []Account{
			{ID: "chk", Name: "Chase Checking", Kind: Checking, Balance: 2512.40},
			{ID: "sav", Name: "Savings", Kind: Savings, Balance: 6500, Rate: 3.2},
			{ID: "visa", Name: "Chase Freedom", Kind: Card, Balance: 1240.55, Pending: 84.10},
			{ID: "k401", Name: "401(k)", Kind: Retirement, Balance: 38500},
			{ID: "carloan", Name: "Car loan", Kind: Loan, Balance: 11240, Original: 24000},
			{ID: "rav4", Name: "RAV4", Kind: Car, Balance: 18500, Loan: "carloan"},
		},
		Payments: []Payment{
			{ID: "mortgage", Name: "Mortgage", Amount: 1845, Schedule: Schedule{Every: Monthly, Start: "2026-01-01"}},
			{ID: "food", Name: "Groceries", Amount: 200, Schedule: Schedule{Every: Weekly, Start: "2026-10-31"}},
			{ID: "save", Name: "Savings", Amount: 200, To: "sav", Schedule: Schedule{Every: Biweekly, Start: "2026-11-06"}},
			{ID: "visapay", Name: "Chase Freedom", Amount: 900, Card: "visa", Schedule: Schedule{Every: Monthly, Start: "2026-01-21"}},
			{ID: "car", Name: "Car payment", Amount: 412, To: "carloan", Schedule: Schedule{Every: Monthly, Start: "2026-01-15"}},
		},
	}
}

func TestProject(t *testing.T) {
	v := Project(household(), date("2026-10-30").Add(15*time.Hour), 12)
	if v.Today != "2026-10-30" || v.Checking != "chk" {
		t.Fatalf("today %s, checking %s", v.Today, v.Checking)
	}
	now := v.Periods[0]
	// Until Alex's first check: groceries on the 31st and the mortgage on the 1st.
	if !now.Now || now.Start != "2026-10-30" || now.Last != "2026-11-05" || len(now.Rows) != 2 || now.Left != 467.40 || now.Out != 2045 || now.In != 0 {
		t.Fatalf("now: %+v", now)
	}
	alex := v.Periods[1]
	if alex.Pay == nil || alex.Pay.Date != "2026-11-06" || alex.In != 2150 || alex.Carried != 467.40 {
		t.Fatalf("Alex's first check: %+v", alex)
	}
	// The 401(k) deduction grows it; the savings transfer moves money and earns interest.
	if alex.Accounts["k401"] != 38683 || alex.Accounts["sav"] < 6700 || alex.Accounts["sav"] > 6720 {
		t.Fatalf("accounts after Alex's check: %+v", alex.Accounts)
	}
	// The car payment shrinks the loan.
	if alex.Accounts["carloan"] != 10828 {
		t.Fatalf("car loan: %v", alex.Accounts["carloan"])
	}
	// The card's next payment is what it owes now, pending included; the next the usual amount.
	var paid []float64
	for _, p := range v.Periods {
		for _, r := range p.Rows {
			if r.Payment == "visapay" {
				paid = append(paid, r.Amount)
			}
		}
	}
	if len(paid) < 2 || paid[0] != 1324.65 || paid[1] != 900 {
		t.Fatalf("card payments: %v", paid)
	}
	// Each period ends with checking as the rows leave it.
	for _, p := range v.Periods {
		if n := len(p.Rows); n > 0 && p.Rows[n-1].After != p.Left {
			t.Fatalf("%s: last row %v, left %v", p.Start, p.Rows[n-1].After, p.Left)
		}
		if got := cents(p.Carried + p.In - p.Out); got != p.Left {
			t.Fatalf("%s: carried %v + in %v - out %v != %v", p.Start, p.Carried, p.In, p.Out, p.Left)
		}
	}
	// Paydays move before weekends and holidays: Jordan's 26th of November is
	// Thanksgiving, December's a Saturday before Christmas; Alex's 1 January
	// is New Year's Day.
	moved := map[string]string{}
	for _, p := range v.Periods[1:] {
		for _, m := range p.Pay.Moved {
			moved[m.From] = p.Pay.Date + " " + m.Why
		}
	}
	for from, want := range map[string]string{"2026-11-26": "2026-11-25 Thanksgiving", "2026-12-26": "2026-12-24 weekend", "2027-01-01": "2026-12-31 New Year's Day"} {
		if moved[from] != want {
			t.Errorf("%s moved to %q, want %q", from, moved[from], want)
		}
	}
	if len(v.Periods) != 13 {
		t.Fatalf("%d periods", len(v.Periods))
	}
	// The chart: checking each day, the paycheck and payments on it.
	if len(v.Days) != chartDays || v.Days[0].Date != "2026-10-30" || v.Days[1].Balance != 2312.40 || v.Days[7].Balance != alex.Rows[0].After {
		t.Fatalf("days: %+v %+v %+v", v.Days[0], v.Days[1], v.Days[7])
	}
	if ev := v.Days[7].Events; len(ev) < 2 || ev[0].People[0] != "alex" || ev[0].Amount != 2150 || ev[1].Amount >= 0 {
		t.Fatalf("Nov 6 events: %+v", ev)
	}
}

func TestProjectSkipsNothingToPay(t *testing.T) {
	p := household()
	p.Accounts[2].Balance, p.Accounts[2].Pending = 0, 0 // the card is paid off
	p.Payments = append(p.Payments, Payment{ID: "free", Name: "Free trial", Schedule: Schedule{Every: Monthly, Start: "2026-01-02"}})
	v := Project(p, date("2026-10-30"), 8)
	var visa []float64
	for _, per := range v.Periods {
		for _, r := range per.Rows {
			if r.Payment == "free" {
				t.Fatal("a payment of nothing has a row")
			}
			if r.Payment == "visapay" {
				visa = append(visa, r.Amount)
			}
		}
	}
	// November's card payment is skipped (nothing owed); December's is the usual amount.
	if len(visa) == 0 || visa[0] != 900 {
		t.Fatalf("card payments: %v", visa)
	}
}

func TestProjectWithoutPaychecks(t *testing.T) {
	p := household()
	p.People = nil
	v := Project(p, date("2026-10-30"), 12)
	if len(v.Periods) != 1 || v.Periods[0].Last != "2026-11-29" || len(v.Periods[0].Rows) == 0 {
		t.Fatalf("periods: %+v", v.Periods)
	}
	// A paycheck into another account leaves checking alone.
	p = household()
	p.People[0].Account = "sav"
	v = Project(p, date("2026-10-30"), 2)
	if v.Periods[1].In != 0 || v.Periods[1].Accounts["sav"] < 8850 {
		t.Fatalf("into savings: %+v", v.Periods[1])
	}
	if v := Project(Plan{}, date("2026-10-30"), 3); v.Checking != "" || len(v.Periods) != 1 || len(v.Days) != chartDays {
		t.Fatalf("empty plan: %+v", v)
	}
}

func TestSchedule(t *testing.T) {
	cases := []struct {
		s    Schedule
		from string
		to   string
		want string
	}{
		{Schedule{Every: Monthly, Start: "2026-01-31"}, "2026-01-15", "2026-04-30", "2026-01-31 2026-02-28 2026-03-31 2026-04-30"},
		{Schedule{Every: TwiceMonth, Start: "2026-01-01", Day2: 15}, "2026-02-10", "2026-03-20", "2026-02-15 2026-03-01 2026-03-15"},
		{Schedule{Every: Quarterly, Start: "2025-01-10"}, "2026-01-01", "2026-12-31", "2026-01-10 2026-04-10 2026-07-10 2026-10-10"},
		{Schedule{Every: Yearly, Start: "2024-03-03"}, "2026-01-01", "2027-12-31", "2026-03-03 2027-03-03"},
		{Schedule{Every: Once, Start: "2026-05-01"}, "2026-01-01", "2026-12-31", "2026-05-01"},
		{Schedule{Every: Once, Start: "2025-05-01"}, "2026-01-01", "2026-12-31", ""},
		{Schedule{Every: Weekly, Start: "2026-10-31"}, "2026-11-03", "2026-11-21", "2026-11-07 2026-11-14 2026-11-21"},
		{Schedule{Every: Biweekly, Start: "2026-11-06"}, "2026-10-01", "2026-12-05", "2026-11-06 2026-11-20 2026-12-04"},
		{Schedule{Every: Biweekly, Start: "2026-01-02"}, "2026-11-01", "2026-11-30", "2026-11-06 2026-11-20"},
		{Schedule{Every: Monthly, Start: "bad"}, "2026-01-01", "2026-12-31", ""},
	}
	for _, c := range cases {
		var got []string
		for _, d := range c.s.Dates(date(c.from), date(c.to)) {
			got = append(got, dateOf(d))
		}
		if strings.Join(got, " ") != c.want {
			t.Errorf("%+v from %s: %v, want %s", c.s, c.from, got, c.want)
		}
	}
}

func TestHoliday(t *testing.T) {
	for d, want := range map[string]string{
		"2026-11-26": "Thanksgiving", "2026-05-25": "Memorial Day", "2026-09-07": "Labor Day", "2026-01-19": "Martin Luther King Jr. Day",
		"2026-02-16": "Presidents' Day", "2026-10-12": "Columbus Day", "2026-06-19": "Juneteenth", "2026-12-25": "Christmas",
		"2027-07-05": "Independence Day", // the 4th is a Sunday
		"2026-07-03": "",                 // the 4th is a Saturday: not moved
		"2026-11-11": "Veterans Day", "2027-01-01": "New Year's Day", "2026-11-19": "",
	} {
		if got := Holiday(date(d)); got != want {
			t.Errorf("%s: %q, want %q", d, got, want)
		}
	}
	if d, why := BankDay(date("2026-11-27")); dateOf(d) != "2026-11-27" || why != "" {
		t.Errorf("a Friday after Thanksgiving: %s %q", dateOf(d), why)
	}
}

func TestClean(t *testing.T) {
	p, err := Clean(Plan{
		Accounts: []Account{{Name: " Checking ", Kind: Checking}, {Name: "Checking", Kind: Savings}},
		People:   []Earner{{Name: "Alex", Schedule: Schedule{Every: Monthly, Start: "2026-01-01"}}},
		Payments: []Payment{{Name: "Rent!", Schedule: Schedule{Every: Monthly, Start: "2026-01-01"}, From: "checking"}},
		Cushion:  -5,
	})
	if err != nil {
		t.Fatal(err)
	}
	if p.Accounts[0].ID != "checking" || p.Accounts[0].Name != "Checking" || p.Accounts[1].ID != "checking-2" || p.People[0].ID != "alex" || p.Payments[0].ID != "rent" || p.Cushion != 0 {
		t.Fatalf("cleaned: %+v", p)
	}
	ok := Schedule{Every: Monthly, Start: "2026-01-01"}
	for want, bad := range map[string]Plan{
		"no name":            {Accounts: []Account{{Kind: Checking}}},
		"unknown kind":       {Accounts: []Account{{Name: "A", Kind: "piggy"}}},
		"is not a loan":      {Accounts: []Account{{ID: "a", Name: "A", Kind: Checking}, {Name: "Car", Kind: Car, Loan: "a"}}},
		"gets paid has no":   {People: []Earner{{Schedule: ok}}},
		"unknown schedule":   {People: []Earner{{Name: "A", Schedule: Schedule{Every: "fortnight", Start: "2026-01-01"}}}},
		"no start date":      {Payments: []Payment{{Name: "A", Schedule: Schedule{Every: Monthly}}}},
		"second day":         {Payments: []Payment{{Name: "A", Schedule: Schedule{Every: TwiceMonth, Start: "2026-01-01"}}}},
		"a payment has no":   {Payments: []Payment{{Schedule: ok}}},
		`no account "x"`:     {Payments: []Payment{{Name: "A", Schedule: ok, To: "x"}}},
		"'s 401(k): no acco": {People: []Earner{{Name: "A", Schedule: ok, Deductions: []Deduction{{Name: "401(k)", Account: "x"}}}}},
	} {
		if _, err := Clean(bad); err == nil || !strings.Contains(err.Error(), want) {
			t.Errorf("want %q, got %v", want, err)
		}
	}
}

func TestSaveLoad(t *testing.T) {
	path := Path(t.TempDir())
	if p, err := Load(path); err != nil || len(p.Accounts) != 0 {
		t.Fatalf("no file: %+v %v", p, err)
	}
	saved, err := Save(path, household())
	if err != nil {
		t.Fatal(err)
	}
	got, err := Load(path)
	if err != nil || len(got.Payments) != len(saved.Payments) || got.Accounts[2].Pending != 84.10 {
		t.Fatalf("loaded: %+v %v", got, err)
	}
	if fi, _ := os.Stat(path); runtime.GOOS != "windows" && fi.Mode().Perm() != 0o600 {
		t.Fatalf("mode %v: the household's money is for its owner only", fi.Mode().Perm())
	}
	if _, err := Save(path, Plan{Accounts: []Account{{Kind: Checking}}}); err == nil {
		t.Fatal("a bad plan saves")
	}
	if err := os.WriteFile(path, []byte("{"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(path); err == nil {
		t.Fatal("a broken file reads")
	}
	if _, err := Load(filepath.Join(path, "x")); err == nil && runtime.GOOS != "windows" {
		t.Fatal("reading under a file works")
	}
}
