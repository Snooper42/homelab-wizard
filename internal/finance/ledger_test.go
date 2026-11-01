package finance

import (
	"encoding/json"
	"errors"
	"math"
	"os"
	"runtime"
	"strings"
	"testing"
)

// A ledger is tidied against the plan: oldest first, each with an ID of
// its own, tags once each in lower case, a split's category its parts',
// a card paid off with each paycheck a payment it can pay.
func TestCleanLedger(t *testing.T) {
	p := household()
	p.Accounts[2].PaidEach = true
	p.Payments = p.Payments[:3]
	l, err := CleanLedger(Ledger{Transactions: []Transaction{
		{Date: "2026-10-20", Account: "chk", Amount: -152.404, Payee: " Electric ", Tags: []string{"Home", "home ", ""}},
		{ID: "a", Date: "2026-10-01", Account: "chk", Amount: -1845, Payee: "Mortgage", Payment: "mortgage"},
		{ID: "a", Date: "2026-10-05", Account: "visa", Amount: -86.10, Payee: "Costco", Category: "Food", Splits: []Split{{Category: "Groceries", Amount: -60}, {Category: " Home ", Amount: -26.10}}},
		{Date: "2026-10-06", Account: "chk", Amount: -500, To: "sav", Payee: "To savings"},
		{Date: "2026-10-07", Account: "chk", Amount: -1324.65, Payment: CardID("visa")},
	}}, p)
	if err != nil {
		t.Fatal(err)
	}
	var days, ids []string
	for _, x := range l.Transactions {
		days, ids = append(days, x.Date), append(ids, x.ID)
	}
	if strings.Join(days, " ") != "2026-10-01 2026-10-05 2026-10-06 2026-10-07 2026-10-20" {
		t.Errorf("not oldest first: %v", days)
	}
	seen := map[string]bool{}
	for _, id := range ids {
		if id == "" || seen[id] {
			t.Errorf("IDs %v are not each their own", ids)
		}
		seen[id] = true
	}
	e := l.Transactions[4]
	if e.Payee != "Electric" || e.Amount != -152.40 || strings.Join(e.Tags, ",") != "home" {
		t.Errorf("tidied: %+v", e)
	}
	if c := l.Transactions[1]; c.Category != "" || c.Splits[1].Category != "Home" {
		t.Errorf("a split keeps its parts' categories only: %+v", c)
	}

	for want, bad := range map[string]Transaction{
		"no date":                  {Account: "chk", Amount: -1, Date: "Oct 3"},
		`no account "x"`:           {Date: "2026-10-03", Account: "x", Amount: -1},
		"no amount":                {Date: "2026-10-03", Account: "chk", Amount: 0.004},
		"into another account":     {Date: "2026-10-03", Account: "chk", Amount: -1, To: "chk"},
		`no account "y" to move`:   {Date: "2026-10-03", Account: "chk", Amount: -1, To: "y"},
		"type it as a minus":       {Date: "2026-10-03", Account: "chk", Amount: 5, To: "sav"},
		`no planned payment "zzz"`: {Date: "2026-10-03", Account: "chk", Amount: -1, Payment: "zzz"},
		"come to -5.00, not -6.00": {Date: "2026-10-03", Account: "chk", Amount: -6, Splits: []Split{{Category: "A", Amount: -5}}},
		"a part with no category":  {Date: "2026-10-03", Account: "chk", Amount: -6, Splits: []Split{{Amount: -6}}},
	} {
		if _, err := CleanLedger(Ledger{Transactions: []Transaction{bad}}, p); err == nil || !strings.Contains(err.Error(), want) {
			t.Errorf("want %q, got %v", want, err)
		}
	}
}

// The ledger is a file of its own: none yet reads as empty; a save writes
// it owner-only and comes back with its rev; one from a device that read
// it before another saved is refused, and the file is left as it was.
func TestSaveLoadLedger(t *testing.T) {
	p := household()
	path := LedgerPath(t.TempDir())
	l, err := LoadLedger(path)
	if err != nil || l.Rev != noFile || l.Transactions == nil || len(l.Transactions) != 0 {
		t.Fatalf("no file: %+v, %v", l, err)
	}
	l.Transactions = append(l.Transactions, Transaction{Date: "2026-10-30", Account: "chk", Amount: -15.49, Payee: "Netflix"})
	saved, err := SaveLedger(path, l, p)
	if err != nil || saved.Rev == "" || saved.Rev == noFile {
		t.Fatalf("saved %+v, %v", saved, err)
	}
	if runtime.GOOS != "windows" {
		if fi, _ := os.Stat(path); fi.Mode().Perm() != 0o600 {
			t.Errorf("the ledger is %v, not the owner's only", fi.Mode().Perm())
		}
	}
	back, err := LoadLedger(path)
	if err != nil || back.Rev != saved.Rev || len(back.Transactions) != 1 || back.Transactions[0].ID == "" {
		t.Fatalf("read back %+v, %v", back, err)
	}
	// Another device saves; this one, still holding the first read, is refused.
	other := back
	other.Transactions = append(other.Transactions, Transaction{Date: "2026-10-31", Account: "chk", Amount: -200, Payee: "Groceries"})
	if _, err := SaveLedger(path, other, p); err != nil {
		t.Fatal(err)
	}
	stale := back
	stale.Transactions = nil
	if _, err := SaveLedger(path, stale, p); !errors.Is(err, ErrChanged) {
		t.Fatalf("a stale save: %v", err)
	}
	if now, _ := LoadLedger(path); len(now.Transactions) != 2 {
		t.Errorf("the refused save changed the file: %d transactions", len(now.Transactions))
	}
	// A ledger that does not fit the plan is not written.
	bad := back
	bad.Transactions = []Transaction{{Date: "2026-10-31", Account: "gone", Amount: -1}}
	if _, err := SaveLedger(path, bad, p); err == nil {
		t.Error("saved a transaction on an account the plan does not have")
	}
	// A file that is not JSON says so.
	if err := os.WriteFile(path, []byte("{"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadLedger(path); err == nil {
		t.Error("read a broken ledger as if it were fine")
	}
}

// The ledger in the projection: a transaction that pays a planned payment
// takes its nearest day's place (paid early, not paid again; paid more,
// the more), each other one after a balance was typed in moves it, one on
// or before that day or dated ahead does not, and a transfer moves both.
func TestProjectWithLedger(t *testing.T) {
	p := household()
	p.Updated = "2026-10-28"
	today := date("2026-11-02")
	plain := Project(p, today, 4)
	with := func(txs ...Transaction) View { return ProjectWith(p, Ledger{Transactions: txs}, today, 4) }
	near := func(a, b float64) bool { return math.Abs(a-b) < 0.02 }

	// The mortgage, $1,845 on Nov 1, paid as $1,900: $55 more out of checking, and listed as paid.
	v := with(Transaction{ID: "m", Date: "2026-11-01", Account: "chk", Amount: -1900, Payment: "mortgage"})
	if !near(v.Start["chk"], plain.Start["chk"]-55) {
		t.Errorf("paid $1,900 for $1,845: checking %v, plain %v", v.Start["chk"], plain.Start["chk"])
	}
	if len(v.Paid) != 1 || v.Paid[0] != (Paid{Payment: "mortgage", Due: "2026-11-01", Date: "2026-11-01", Amount: 1900, Planned: 1845, Transaction: "m"}) {
		t.Errorf("paid: %+v", v.Paid)
	}
	for _, s := range v.Since {
		if s.Payment == "mortgage" {
			t.Errorf("the mortgage paid by a transaction is still taken as happened: %+v", s)
		}
	}

	// Paid early, on Oct 30 for Dec 1's: Dec 1's is not paid again, Nov 1's still is.
	v = with(Transaction{ID: "e", Date: "2026-10-30", Account: "chk", Amount: -1845, Payment: "mortgage"})
	var rows []string
	for _, per := range v.Periods {
		for _, r := range per.Rows {
			if r.Payment == "mortgage" {
				rows = append(rows, r.Date)
			}
		}
	}
	if len(v.Paid) != 1 || v.Paid[0].Due != "2026-11-01" {
		t.Errorf("paid early matched %+v", v.Paid)
	}
	if strings.Join(rows, " ") != "2026-12-01" {
		t.Errorf("the mortgage ahead: %v", rows)
	}

	// Coffee on Oct 30, after checking was typed in: $5 less. On Oct 28 (the day typed), or ahead: no change.
	if v := with(Transaction{Date: "2026-10-30", Account: "chk", Amount: -5}); !near(v.Start["chk"], plain.Start["chk"]-5) {
		t.Errorf("coffee after the balance: %v, plain %v", v.Start["chk"], plain.Start["chk"])
	}
	for _, d := range []string{"2026-10-28", "2026-10-20", "2026-11-05"} {
		if v := with(Transaction{Date: d, Account: "chk", Amount: -5}); !near(v.Start["chk"], plain.Start["chk"]) {
			t.Errorf("coffee on %s moved checking: %v, plain %v", d, v.Start["chk"], plain.Start["chk"])
		}
	}

	// $500 moved to savings: checking $500 less, savings about $500 more (a few days' interest on it too).
	v = with(Transaction{Date: "2026-10-30", Account: "chk", Amount: -500, To: "sav"})
	if !near(v.Start["chk"], plain.Start["chk"]-500) || v.Start["sav"]-plain.Start["sav"] < 500 || v.Start["sav"]-plain.Start["sav"] > 500.2 {
		t.Errorf("a transfer: checking %v (plain %v), savings %v (plain %v)", v.Start["chk"], plain.Start["chk"], v.Start["sav"], plain.Start["sav"])
	}

	// $86 charged on the card: it owes $86 more.
	if v := with(Transaction{Date: "2026-10-30", Account: "visa", Amount: -86}); !near(v.Start["visa"], plain.Start["visa"]+86) {
		t.Errorf("a card charge: owes %v, plain %v", v.Start["visa"], plain.Start["visa"])
	}

	// Two payments of the mortgage take two days, each its nearest; one far from any is no match.
	v = with(
		Transaction{ID: "a", Date: "2026-10-02", Account: "chk", Amount: -1845, Payment: "mortgage"},
		Transaction{ID: "b", Date: "2026-11-01", Account: "chk", Amount: -1845, Payment: "mortgage"},
		Transaction{ID: "c", Date: "2026-10-16", Account: "chk", Amount: -10, Payment: "car"},
	)
	var dues []string
	for _, pd := range v.Paid {
		dues = append(dues, pd.Payment+" "+pd.Due)
	}
	if strings.Join(dues, ", ") != "mortgage 2026-10-01, mortgage 2026-11-01, car 2026-10-15" {
		t.Errorf("matched %v", dues)
	}
	// A one-off payment's day is the only one: paid 41 days from it, it is no match.
	p.Payments = append(p.Payments, Payment{ID: "couch", Name: "Couch", Amount: 600, Schedule: Schedule{Every: Once, Start: "2026-09-01"}})
	if v := with(Transaction{ID: "far", Date: "2026-10-12", Account: "chk", Amount: -600, Payment: "couch"}); len(v.Paid) != 0 {
		t.Errorf("a payment 41 days from its only day: %+v", v.Paid)
	}
}

// Categories: the defaults clean as they are; a name is kept once whatever
// its case, a group is a category of its own with no group above it, and
// a plan from before categories loads with none.
func TestCategories(t *testing.T) {
	p := household()
	p.Categories = DefaultCategories()
	got, err := Clean(p)
	if err != nil || len(got.Categories) != len(DefaultCategories()) {
		t.Fatalf("the defaults: %d, %v", len(got.Categories), err)
	}
	p.Categories = []Category{{Name: " Food "}, {Name: "Groceries", Parent: "Food "}}
	if got, err := Clean(p); err != nil || got.Categories[0].Name != "Food" || got.Categories[1].Parent != "Food" {
		t.Errorf("trimmed: %+v, %v", got.Categories, err)
	}
	for want, bad := range map[string][]Category{
		"has no name":               {{Name: " "}},
		`two categories are called`: {{Name: "Food"}, {Name: "food"}},
		"not its own group":         {{Name: "Food", Parent: "Food"}},
		`its group "Fod"`:           {{Name: "Groceries", Parent: "Fod"}},
		`its group "Groceries"`:     {{Name: "Food"}, {Name: "Groceries", Parent: "Food"}, {Name: "Apples", Parent: "Groceries"}},
	} {
		p.Categories = bad
		if _, err := Clean(p); err == nil || !strings.Contains(err.Error(), want) {
			t.Errorf("want %q, got %v", want, err)
		}
	}
	// The screen gets the defaults while the plan has none, and the plan's once it has them.
	if v := Project(household(), date("2026-10-31"), 2); len(v.Categories) != len(DefaultCategories()) || v.Plan.Categories != nil {
		t.Errorf("no categories typed in: the view has %d, the plan %v", len(v.Categories), v.Plan.Categories)
	}
	p.Categories = []Category{{Name: "Food"}}
	if v := Project(p, date("2026-10-31"), 2); len(v.Categories) != 1 {
		t.Errorf("the plan's own: %+v", v.Categories)
	}
	var old Plan
	if err := json.Unmarshal([]byte(`{"accounts":[]}`), &old); err != nil || old.Categories != nil {
		t.Errorf("an older file: %v, %v", old.Categories, err)
	}
}

// Budgets this month or pay period, from the ledger: a group counts its own
// categories, a refund comes off, a split counts by its parts, a transfer
// never; rolled over, last time's over- or underspend is added; a pay
// period runs from one payday into checking to the day before the next.
func TestBudgets(t *testing.T) {
	p := household()
	p.Budgets = []Budget{{Category: "Food", Amount: 600, Rollover: true}, {Category: "Utilities", Amount: 200, Per: Paycheck}, {Category: "Fun", Amount: 50}}
	p, err := Clean(p)
	if err != nil {
		t.Fatal(err)
	}
	l := Ledger{Transactions: []Transaction{
		{Date: "2026-09-20", Account: "chk", Amount: -700, Category: "Groceries"},
		{Date: "2026-10-05", Account: "chk", Amount: -100, Category: "Groceries"},
		{Date: "2026-10-10", Account: "chk", Amount: -50, Category: "Eating out"},
		{Date: "2026-10-12", Account: "chk", Amount: 20, Category: "groceries"},
		{Date: "2026-10-15", Account: "visa", Amount: -86, Splits: []Split{{Category: "Groceries", Amount: -60}, {Category: "Home", Amount: -26}}},
		{Date: "2026-10-16", Account: "chk", Amount: -300, To: "sav", Category: "Groceries"},
		{Date: "2026-10-08", Account: "chk", Amount: -40, Category: "Electric"},
		{Date: "2026-10-12", Account: "chk", Amount: -70, Category: "Internet"},
		{Date: "2026-10-21", Account: "chk", Amount: -95, Category: "Phone"},
	}}
	v := ProjectWith(p, l, date("2026-10-20"), 2)
	by := map[string]BudgetNow{}
	for _, b := range v.Budgets {
		by[b.Category] = b
	}
	// Food: $100 + $50 − $20 + $60 = $190 of $600, less September's $100 over: $500, $310 left.
	// (The $300 transfer marked Groceries is no spending.)
	f := by["Food"]
	if f.Start != "2026-10-01" || f.Last != "2026-10-31" || f.Spent != 190 || f.Rolled != -100 || f.Amount != 500 || f.Left != 310 {
		t.Errorf("Food: %+v", f)
	}
	// At an even pace, 20 days of 31 of $500.
	if math.Abs(f.Pace-322.58) > 0.01 {
		t.Errorf("Food's pace: %v", f.Pace)
	}
	// Utilities, per paycheck: Alex's pay starts Nov 6, so in October a pay period is Jordan's, Sep 25
	// (the 26th, a Saturday) to the day before Oct 26: Electric, Internet, and the phone on the 21st.
	u := by["Utilities"]
	if u.Per != Paycheck || u.Start != "2026-09-25" || u.Last != "2026-10-25" || u.Spent != 205 || u.Left != -5 {
		t.Errorf("Utilities: %+v", u)
	}
	if b := by["Fun"]; b.Spent != 0 || b.Left != 50 || b.Per != "month" {
		t.Errorf("Fun: %+v", b)
	}
	for want, bad := range map[string][]Budget{
		"has no category":      {{Amount: 5}},
		"Food has two budgets": {{Category: "Food", Amount: 5}, {Category: "food", Amount: 6}},
		"more than nothing":    {{Category: "Food"}},
		`not "week"`:           {{Category: "Food", Amount: 5, Per: "week"}},
	} {
		q := household()
		q.Budgets = bad
		if _, err := Clean(q); err == nil || !strings.Contains(err.Error(), want) {
			t.Errorf("want %q, got %v", want, err)
		}
	}
	if v := Project(household(), date("2026-10-20"), 2); v.Budgets != nil {
		t.Errorf("budgets with none set: %+v", v.Budgets)
	}
	// From Nov 10, a pay period is Alex's Nov 6 to the day before his Nov 20.
	if v := ProjectWith(p, l, date("2026-11-10"), 2); v.Budgets[1].Start != "2026-11-06" || v.Budgets[1].Last != "2026-11-19" {
		t.Errorf("Utilities from Nov 10: %+v", v.Budgets[1])
	}
}

// Recurring found in the ledger: a payee paid on a steady rhythm, about the
// same each time, lately, that no planned payment covers.
func TestFindRecurring(t *testing.T) {
	p := household()
	tx := func(payee, account string, amount float64, days ...string) []Transaction {
		var out []Transaction
		for _, d := range days {
			out = append(out, Transaction{Date: d, Account: account, Amount: amount, Payee: payee, Category: "Fun"})
		}
		return out
	}
	var all []Transaction
	all = append(all, tx("Hulu", "chk", -17.99, "2026-06-03", "2026-07-03", "2026-08-02", "2026-09-03", "2026-10-03")...)
	all = append(all, tx("Climbing gym", "visa", -10, "2026-10-14", "2026-10-21", "2026-10-28")...)
	all = append(all, tx("Amazon Prime", "visa", -139, "2024-11-05", "2025-11-05")...)
	all = append(all, tx("Coffee", "chk", -5, "2026-10-02", "2026-10-09", "2026-10-20")...)                                                                                                                                                                                // no rhythm
	all = append(all, tx("Old gym", "chk", -30, "2026-03-01", "2026-04-01", "2026-05-01")...)                                                                                                                                                                              // stopped
	all = append(all, tx("Mortgage", "chk", -1845, "2026-08-01", "2026-09-01", "2026-10-01")...)                                                                                                                                                                           // in the plan by name
	all = append(all, Transaction{Date: "2026-10-18", Account: "chk", Amount: -140, Payee: "Electric"}, Transaction{Date: "2026-09-18", Account: "chk", Amount: -98, Payee: "Electric"}, Transaction{Date: "2026-08-18", Account: "chk", Amount: -150, Payee: "Electric"}) // amounts too far apart
	paid := tx("Netflix", "chk", -15.49, "2026-08-03", "2026-09-03", "2026-10-03")
	paid[2].Payment = "food" // one of them pays a planned payment: covered
	all = append(all, paid...)
	v := ProjectWith(p, Ledger{Transactions: all}, date("2026-10-31"), 2)
	var got []string
	for _, f := range v.Found {
		got = append(got, f.Payee+" "+f.Every+" "+f.Next)
	}
	if strings.Join(got, ", ") != "Climbing gym week 2026-11-04, Hulu month 2026-11-03, Amazon Prime year 2026-11-05" {
		t.Fatalf("found %v", got)
	}
	h := v.Found[1]
	if h.Amount != 17.99 || h.Since != "2026-06-03" || h.Last != "2026-10-03" || h.Times != 5 || h.Account != "chk" || h.Category != "Fun" {
		t.Errorf("Hulu: %+v", h)
	}
}
