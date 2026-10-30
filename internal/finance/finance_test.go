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
	// Of what it pays, the transfer to savings is kept, not spent; the car loan's payment is spent.
	if alex.Saved != 200 || alex.Out <= alex.Saved {
		t.Fatalf("saved %v of %v", alex.Saved, alex.Out)
	}
	for _, r := range alex.Rows {
		if r.Saved != (r.Payment == "save") {
			t.Fatalf("row %+v", r)
		}
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
	for from, want := range map[string]string{"2026-11-26": "2026-11-25 Thanksgiving", "2026-12-26": "2026-12-24 the weekend and Christmas", "2027-01-01": "2026-12-31 New Year's Day"} {
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
	// A paycheck into another account leaves checking alone, and starts no
	// period of its own: now runs to Jordan's check, the first into checking.
	p = household()
	p.People[0].Account = "sav"
	v = Project(p, date("2026-10-30"), 2)
	now := v.Periods[0]
	if !now.Now || now.Last != "2026-11-24" || now.In != 0 || now.Accounts["sav"] < 8850 || v.Periods[1].Pay.People[0] != "jordan" {
		t.Fatalf("into savings: %+v, then %+v", now, v.Periods[1])
	}
	// The Pay view still has it: nothing into checking, all of it somewhere.
	if pd := v.Paydays[0]; pd.Date != "2026-11-06" || pd.Amount != 0 || pd.Total != 2150 {
		t.Fatalf("paydays: %+v", v.Paydays)
	}
	for _, d := range v.Days {
		for _, e := range d.Events {
			if e.People != nil && e.People[0] == "alex" {
				t.Fatalf("%s: Alex's check into savings is on checking's chart", d.Date)
			}
		}
	}
	// Paid only into savings: now still runs a month.
	p.People = p.People[:1]
	if v := Project(p, date("2026-10-30"), 3); len(v.Periods) != 1 || v.Periods[0].Last != "2026-11-29" || len(v.Paydays) != 3 {
		t.Fatalf("only into savings: %+v", v.Periods)
	}
	if v := Project(Plan{}, date("2026-10-30"), 3); v.Checking != "" || len(v.Periods) != 1 || len(v.Days) != chartDays {
		t.Fatalf("empty plan: %+v", v)
	}
}

// Each period's numbers add up, and the chart agrees with them: checking on
// a period's last day is what it leaves.
func TestProjectAddsUp(t *testing.T) {
	weekly := household()
	weekly.People[0].Schedule = Schedule{Every: Weekly, Start: "2026-11-06"}
	moved := household()
	moved.Payments = append(moved.Payments,
		Payment{ID: "pull", Name: "From savings", Amount: 500, From: "sav", To: "chk", Schedule: Schedule{Every: Monthly, Start: "2026-01-02"}},
		Payment{ID: "roth", Name: "Savings to the 401(k)", Amount: 100, From: "sav", To: "k401", Schedule: Schedule{Every: Monthly, Start: "2026-01-03"}})
	for name, p := range map[string]Plan{"household": household(), "example": example(), "weekly": weekly, "moved in": moved} {
		v := Project(p, date("2026-10-30"), 12)
		if len(v.Days) != chartDays || len(v.Periods) != 13 {
			t.Fatalf("%s: %d days, %d periods", name, len(v.Days), len(v.Periods))
		}
		chart := map[string]float64{}
		for _, d := range v.Days {
			chart[d.Date] = d.Balance
		}
		for i, per := range v.Periods {
			if got := cents(per.Carried + per.In - per.Out); got != per.Left {
				t.Errorf("%s %s: carried %v + in %v - out %v = %v, left %v", name, per.Start, per.Carried, per.In, per.Out, got, per.Left)
			}
			if c, ok := chart[per.Last]; ok && c != per.Left {
				t.Errorf("%s %s: the chart has %v on %s, the period leaves %v", name, per.Start, c, per.Last, per.Left)
			}
			if i > 0 && per.Start != dateOf(date(v.Periods[i-1].Last).AddDate(0, 0, 1)) {
				t.Errorf("%s: %s starts after a gap from %s", name, per.Start, v.Periods[i-1].Last)
			}
		}
	}
}

// Money moved into checking from savings comes in: it has a row, the
// period counts it, and the chart has it.
func TestProjectMovedIn(t *testing.T) {
	p := household()
	p.Payments = append(p.Payments, Payment{ID: "pull", Name: "From savings", Amount: 500, From: "sav", To: "chk", Schedule: Schedule{Every: Once, Start: "2026-11-02"}})
	v := Project(p, date("2026-10-30"), 2)
	now := v.Periods[0]
	var row Row
	for _, r := range now.Rows {
		if r.Payment == "pull" {
			row = r
		}
	}
	if !row.Into || row.Outside || row.After != 967.40 || now.In != 500 || now.Left != 967.40 {
		t.Fatalf("moved in: %+v, now %+v", row, now)
	}
	if d := v.Days[3]; d.Date != "2026-11-02" || d.Balance != 967.40 || len(d.Events) != 1 || d.Events[0].Amount != 500 {
		t.Fatalf("the chart on Nov 2: %+v", d)
	}
	if now.Accounts["sav"] > 6010 {
		t.Fatalf("savings did not give it: %v", now.Accounts["sav"])
	}
}

// A bill charged to a card adds to what it owes, not to checking's
// payments; the card's payment pays what it owes on its day: what it owed
// when typed in and the charges since, then its other spending (the usual
// amount, a day at a time) and the charges since the last.
func TestProjectCharges(t *testing.T) {
	p := household()
	p.Payments = append(p.Payments, Payment{ID: "netflix", Name: "Netflix", Amount: 15.49, From: "visa", Schedule: Schedule{Every: Monthly, Start: "2026-01-03"}})
	v := Project(p, date("2026-10-30"), 8)
	var paid []float64
	var charged Row
	for _, per := range v.Periods {
		for _, r := range per.Rows {
			switch r.Payment {
			case "visapay":
				paid = append(paid, r.Amount)
			case "netflix":
				if charged.Payment == "" {
					charged = r
				}
			}
		}
	}
	if len(paid) < 2 || paid[0] != 1340.14 || paid[1] != 915.49 {
		t.Fatalf("card payments: %v", paid)
	}
	if !charged.Outside || charged.Date != "2026-11-03" {
		t.Fatalf("Netflix on the card: %+v", charged)
	}
	if d := v.Days[4]; d.Date != "2026-11-03" || d.Balance != v.Days[3].Balance {
		t.Fatalf("checking paid Netflix on Nov 3: %+v %+v", v.Days[3], d)
	}
	// Between payments the card owes what is spent on it: never nothing while $900 a month goes to it.
	for _, per := range v.Periods {
		if per.Start > "2026-11-21" && (per.Accounts["visa"] <= 0 || per.Accounts["visa"] > 915.49) {
			t.Fatalf("%s: the card owes %v", per.Start, per.Accounts["visa"])
		}
	}
}

// A loan is charged its rate a day at a time, so a payment pays the
// interest first; a card paid in full each time is charged none, one that
// carries a balance is.
func TestProjectInterest(t *testing.T) {
	p := Plan{
		Accounts: []Account{
			{ID: "chk", Name: "Checking", Kind: Checking, Balance: 5000},
			{ID: "mort", Name: "Mortgage", Kind: Loan, Balance: 287400, Rate: 6.5},
			{ID: "visa", Name: "Visa", Kind: Card, Balance: 1000, Rate: 24},
			{ID: "amex", Name: "Amex", Kind: Card, Balance: 1000, Rate: 24},
		},
		People: []Earner{{ID: "a", Name: "Alex", Net: 9000, Schedule: Schedule{Every: Monthly, Start: "2026-01-05"}}},
		Payments: []Payment{
			{ID: "m", Name: "Mortgage", Amount: 1845, To: "mort", Schedule: Schedule{Every: Monthly, Start: "2026-01-01"}},
			{ID: "v", Name: "Visa", Amount: 300, Card: "visa", Schedule: Schedule{Every: Monthly, Start: "2026-01-20"}},
			{ID: "x", Name: "Amex", Amount: 100, To: "amex", Schedule: Schedule{Every: Monthly, Start: "2026-01-20"}},
		},
	}
	v := Project(p, date("2026-10-30"), 12)
	// Twelve payments a year on, at 6.5% the loan is down about $3,600, not 12 × $1,845.
	mort := v.Periods[11].Accounts["mort"]
	if mort < 283500 || mort > 284200 {
		t.Fatalf("mortgage a year on: %v", mort)
	}
	// The Visa is paid in full: what it owes is its other spending, no interest on it.
	if visa := v.Periods[11].Accounts["visa"]; visa > 300 {
		t.Fatalf("visa: %v", visa)
	}
	// The Amex carries its balance: $100 a month against 2% a month.
	if amex := v.Periods[11].Accounts["amex"]; amex < 1000-12*100+150 || amex > 1000-12*100+300 {
		t.Fatalf("amex: %v", amex)
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
		{Schedule{Every: TwiceMonth, Start: "2026-01-30", Day2: 31}, "2026-02-01", "2026-03-31", "2026-02-28 2026-03-30 2026-03-31"},
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
		"not the first":      {Payments: []Payment{{Name: "A", Schedule: Schedule{Every: TwiceMonth, Start: "2026-01-15", Day2: 15}}}},
		"cannot pay itself":  {Accounts: []Account{{ID: "c", Name: "C", Kind: Card}}, Payments: []Payment{{Name: "A", Schedule: ok, From: "c", Card: "c"}}},
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

func TestUKHolidays(t *testing.T) {
	for d, want := range map[string]string{
		"2026-04-03": "Good Friday", "2026-04-06": "Easter Monday", "2026-05-04": "Early May bank holiday", "2026-05-25": "Spring bank holiday",
		"2026-08-31": "Summer bank holiday", "2026-12-25": "Christmas", "2026-12-28": "Boxing Day", // the 26th is a Saturday
		"2027-03-26": "Good Friday", "2027-12-27": "Christmas", "2027-12-28": "Boxing Day", // both on a weekend
		"2028-01-03": "New Year's Day", // the 1st is a Saturday
		"2026-11-26": "",               // Thanksgiving is not one
	} {
		if got := HolidayIn(date(d), UK); got != want {
			t.Errorf("%s: %q, want %q", d, got, want)
		}
	}
	if got := HolidayIn(date("2026-12-25"), Weekends); got != "" {
		t.Errorf("weekends only: %q", got)
	}
	// A UK payday on Boxing Day's Monday comes the Thursday before (Friday is Christmas).
	if d, why := BankDayIn(date("2026-12-28"), UK); dateOf(d) != "2026-12-24" || why != "Boxing Day, the weekend and Christmas" {
		t.Errorf("moved to %s for %q", dateOf(d), why)
	}
	// With weekends only, Thanksgiving pays on the day.
	p := household()
	p.Holidays = Weekends
	for _, per := range Project(p, date("2026-10-30"), 4).Periods {
		if per.Pay != nil && per.Pay.Date == "2026-11-25" {
			t.Fatal("moved for Thanksgiving with weekends only")
		}
	}
}

func TestPayToday(t *testing.T) {
	p := household()
	// Alex is paid today, the day the balances were typed in: taken to be
	// in them, and listed so the household can say it is not.
	v := Project(p, date("2026-11-06"), 3)
	// (Savings' transfer that day is in them too.)
	if len(v.Since) != 2 || v.Since[0].Key != "pay:alex:2026-11-06" || !v.Since[0].Typed || !v.Since[0].In || v.Since[1].Key != "payment:save:2026-11-06" || !v.Periods[0].Now || v.Periods[0].In != 0 {
		t.Fatalf("counted: %+v %+v", v.Since, v.Periods[0])
	}
	// Not in yet: today's stretch is the paycheck's.
	for _, w := range []Plan{{Waiting: []string{"pay:alex:2026-11-06"}}, {NotYet: "2026-11-06"}} {
		p.Waiting, p.NotYet = w.Waiting, w.NotYet
		v = Project(p, date("2026-11-06"), 3)
		first := v.Periods[0]
		if first.Now || first.Pay == nil || first.Pay.Date != "2026-11-06" || first.In != 2150 || first.Carried != 2512.40 || !v.Since[0].Waiting {
			t.Fatalf("not yet (%+v): %+v, since %+v", w, first, v.Since)
		}
	}
	// NotYet for another day changes nothing today.
	p.Waiting, p.NotYet = nil, "2026-10-23"
	if v := Project(p, date("2026-11-06"), 3); !v.Periods[0].Now {
		t.Fatal("an old NotYet held today's check back")
	}
	if v := Project(p, date("2026-11-05"), 3); len(v.Since) != 0 {
		t.Fatalf("listed on a day with nothing on it: %+v", v.Since)
	}
}

// Balances typed in a while ago: what has happened since counts, each
// account from its own day, and is listed.
func TestProjectSince(t *testing.T) {
	p := household()
	p.Updated = "2026-10-20"
	p.Accounts[0].Updated = "2026-10-20" // checking: before Jordan's check on the 26th, and the 21st's card payment
	p.Accounts[2].Updated = "2026-10-25" // the card: after its payment on the 21st
	v := Project(p, date("2026-10-30"), 3)
	if v.Typed != "2026-10-20" {
		t.Fatalf("typed %q", v.Typed)
	}
	// Since the 20th: the card's payment on the 21st (the usual 900, as
	// the card's balance from the 25th is after it) and Jordan's check on
	// the 26th; nothing is dated the 20th itself.
	keys := map[string]Past{}
	for _, s := range v.Since {
		keys[s.Key] = s
	}
	if len(v.Since) != 2 || keys["payment:visapay:2026-10-21"].Amount != 900 || !keys["pay:jordan:2026-10-26"].In || keys["pay:jordan:2026-10-26"].Typed {
		t.Fatalf("since: %+v", v.Since)
	}
	// Checking today: 2512.40 - 900 + 2400. The card held its payment already.
	if v.Start["chk"] != 4012.40 || v.Periods[0].Carried != 4012.40 || v.Start["visa"] != 1324.65 {
		t.Fatalf("start %+v, carried %v", v.Start, v.Periods[0].Carried)
	}
	// The card's next payment is still what it owed when typed in.
	for _, r := range v.Periods[0].Rows {
		if r.Payment == "visapay" {
			t.Fatalf("a card payment before Nov 21: %+v", r)
		}
	}
	// The card's payment on the 21st did not come out: it waits, and comes
	// today, paying what the card owes.
	p.Waiting = []string{"payment:visapay:2026-10-21"}
	v = Project(p, date("2026-10-30"), 3)
	if r := v.Periods[0].Rows[0]; v.Start["chk"] != 4912.40 || r.Payment != "visapay" || !r.Late || r.Date != "2026-10-21" || r.Amount != 1324.65 || v.Days[0].Balance != 3587.75 {
		t.Fatalf("waiting: start %v, rows %+v, day 0 %+v", v.Start["chk"], v.Periods[0].Rows, v.Days[0])
	}
	if s := v.Since; len(s) != 2 || !s[len(s)-1].Waiting {
		t.Fatalf("since, waiting: %+v", s)
	}
	// A bill on the day the balances were typed in is in them.
	p = household()
	p.Updated = "2026-10-31"
	v = Project(p, date("2026-10-31"), 3)
	if v.Since[0].Key != "payment:food:2026-10-31" || !v.Since[0].Typed || v.Start["chk"] != 2512.40 || v.Days[0].Balance != 2512.40 {
		t.Fatalf("on the day: %+v, day 0 %+v", v.Since, v.Days[0])
	}
	// Typed in yesterday: today's bill is still to come.
	p.Updated = "2026-10-30"
	if v := Project(p, date("2026-10-31"), 3); len(v.Since) != 0 || v.Days[0].Balance != 2312.40 {
		t.Fatalf("typed yesterday: %+v, day 0 %+v", v.Since, v.Days[0])
	}
	// No date anywhere: today's.
	if v := Project(household(), date("2026-10-30"), 3); v.Typed != "" || v.Start["chk"] != 2512.40 {
		t.Fatalf("no date: %q %+v", v.Typed, v.Start)
	}
}

func TestCleanSettings(t *testing.T) {
	p, err := Clean(Plan{Currency: " eur ", Holidays: UK})
	if err != nil || p.Currency != "EUR" {
		t.Fatalf("%+v %v", p, err)
	}
	if _, err := Clean(Plan{Currency: "euro"}); err == nil {
		t.Fatal("a currency that is not a code")
	}
	if _, err := Clean(Plan{Holidays: "mars"}); err == nil {
		t.Fatal("an unknown calendar")
	}
}
