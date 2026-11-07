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
