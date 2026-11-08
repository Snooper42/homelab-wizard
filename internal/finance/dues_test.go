package finance

import (
	"reflect"
	"testing"
)

// Dues are each planned payment's days near today, so a bank's file can
// be matched to what it pays: from DuesBack days before today to
// matchWindow after. A card paid off with each paycheck pays what the card
// owes, never a set amount, so it has none; nor does a payment of nothing.
func TestDues(t *testing.T) {
	p := Plan{
		People:   []Earner{{ID: "sam", Name: "Sam", Net: 2000, Schedule: Schedule{Every: Biweekly, Start: "2026-11-06"}}},
		Accounts: []Account{{ID: "chk", Name: "Checking", Kind: Checking, Balance: 1000}, {ID: "visa", Name: "Visa", Kind: Card, Balance: 300, PaidEach: true, Spend: 400}},
		Payments: []Payment{
			{ID: "power", Name: "Electric", Amount: 150, Schedule: Schedule{Every: Monthly, Start: "2026-01-12"}},
			{ID: "gift", Name: "Gift", Amount: 0, Schedule: Schedule{Every: Once, Start: "2026-11-20"}},
		},
	}
	v := Project(p, date("2026-11-07"), Ahead)
	want := map[string][]string{"power": {"2026-07-12", "2026-08-12", "2026-09-12", "2026-10-12", "2026-11-12"}}
	if !reflect.DeepEqual(v.Dues, want) {
		t.Fatalf("dues: %v, want %v", v.Dues, want)
	}
}

// A bill paid early and not linked to its planned payment comes out twice:
// once as the transaction, once on its day. Linked, it comes out once. The
// import links what a row plainly pays, so this is what the link is for.
func TestUnlinkedEarlyBillCountsTwice(t *testing.T) {
	p := Plan{
		Accounts: []Account{{ID: "chk", Name: "Checking", Kind: Checking, Balance: 1000, Updated: "2026-11-07"}},
		Payments: []Payment{{ID: "power", Name: "Electric", Amount: 150, Schedule: Schedule{Every: Monthly, Start: "2026-01-12"}}},
	}
	paid := Transaction{ID: "t1", Date: "2026-11-08", Account: "chk", Amount: -150, Payee: "Electric"}
	at := func(v View, day string) float64 {
		for _, d := range v.Days {
			if d.Date == day {
				return d.Balance
			}
		}
		return -1
	}
	unlinked := ProjectWith(p, Ledger{Transactions: []Transaction{paid}}, date("2026-11-09"), Ahead)
	paid.Payment = "power"
	linked := ProjectWith(p, Ledger{Transactions: []Transaction{paid}}, date("2026-11-09"), Ahead)
	if at(linked, "2026-11-12") != 850 || at(unlinked, "2026-11-12") != 700 {
		t.Fatalf("Nov 12: linked %v (want 850), unlinked %v (700: twice)", at(linked, "2026-11-12"), at(unlinked, "2026-11-12"))
	}
}

// A bill typed into the plan in November was paid in October too: its
// days before its start are dues (a bank's file of October can be linked
// to it) and, linked, an October payment is listed as paid on its October
// day. (Only matching runs a schedule back: the forecast keeps its start.)
func TestDuesBeforeTheBillWasPlanned(t *testing.T) {
	p := Plan{
		Accounts: []Account{{ID: "chk", Name: "Checking", Kind: Checking, Balance: 1000, Updated: "2026-11-07"}},
		Payments: []Payment{
			{ID: "hoa", Name: "HOA", Amount: 780.15, Schedule: Schedule{Every: Monthly, Start: "2026-11-02"}},
			{ID: "gym", Name: "Gym", Amount: 30, Schedule: Schedule{Every: Biweekly, Start: "2026-11-06"}},
		},
	}
	l := Ledger{Transactions: []Transaction{{ID: "t1", Date: "2026-10-01", Account: "chk", Amount: -780.15, Payee: "HOA", Payment: "hoa"}}}
	v := ProjectWith(p, l, date("2026-11-07"), Ahead)
	if got := v.Dues["hoa"]; !reflect.DeepEqual(got, []string{"2026-08-02", "2026-09-02", "2026-10-02", "2026-11-02"}) {
		t.Errorf("hoa dues: %v", got)
	}
	if got := v.Dues["gym"]; len(got) == 0 || got[0] != "2026-07-17" || got[len(got)-1] != "2026-11-20" {
		t.Errorf("gym dues: %v", got)
	}
	if len(v.Paid) != 1 || v.Paid[0].Due != "2026-10-02" || v.Paid[0].Transaction != "t1" {
		t.Errorf("paid: %+v", v.Paid)
	}
	// Back moves a start back by whole weeks or years, the days the same; Once, and a past start, are as they are.
	for _, c := range []struct {
		s    Schedule
		from string
		want string
	}{
		{Schedule{Every: Monthly, Start: "2026-11-02"}, "2026-07-10", "2025-11-02"},
		{Schedule{Every: Weekly, Start: "2026-11-06"}, "2026-10-01", "2026-09-25"},
		{Schedule{Every: Biweekly, Start: "2026-11-06"}, "2026-10-20", "2026-10-09"},
		{Schedule{Every: Once, Start: "2026-11-06"}, "2026-10-01", "2026-11-06"},
		{Schedule{Every: Monthly, Start: "2026-01-12"}, "2026-07-10", "2026-01-12"},
	} {
		if got := c.s.Back(date(c.from)).Start; got != c.want {
			t.Errorf("%s from %s back from %s: %s, want %s", c.s.Every, c.s.Start, c.from, got, c.want)
		}
	}
}
