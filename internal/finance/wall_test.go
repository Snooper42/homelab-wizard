package finance

import "testing"

// The money card: the next payday and who is paid, checking after its
// stretch, and the next bills from today, with no spending money or
// savings among them; with Hide amounts on, no amount at all.
func TestWallCard(t *testing.T) {
	h := household()
	h.Payments[1].Kind = "spending" // Groceries, weekly from today: no bill
	p, err := Clean(h)
	if err != nil {
		t.Fatal(err)
	}
	v := Project(p, date("2026-10-31"), 4)
	w := WallCard(v, 3)
	var next *Period
	for i := range v.Periods {
		if v.Periods[i].Pay != nil {
			next = &v.Periods[i]
			break
		}
	}
	if next == nil || w.Payday != next.Pay.Date || w.Left != next.Left || len(w.Who) == 0 || w.Who[0] == "" {
		t.Fatalf("payday %q %v, left %v", w.Payday, w.Who, w.Left)
	}
	for _, b := range w.Bills {
		if b.Name == "Groceries" {
			t.Errorf("spending money counted as a bill: %+v", w.Bills)
		}
	}
	if len(w.Bills) != 3 {
		t.Fatalf("%d bills: %+v", len(w.Bills), w.Bills)
	}
	kind := map[string]string{}
	for _, pm := range p.Payments {
		kind[pm.Name] = pm.Kind
	}
	for i, b := range w.Bills {
		if b.Date < v.Today || b.Amount <= 0 || kind[b.Name] == "spending" || kind[b.Name] == "savings" {
			t.Errorf("bill %d: %+v (%s)", i, b, kind[b.Name])
		}
		if i > 0 && b.Date < w.Bills[i-1].Date {
			t.Errorf("not soonest first: %+v", w.Bills)
		}
	}
	v.Plan.HideAmounts = true
	hw := WallCard(v, 3)
	if !hw.Hidden || hw.Left != 0 || hw.Payday != w.Payday || len(hw.Bills) != 3 {
		t.Fatalf("hidden: %+v", hw)
	}
	for _, b := range hw.Bills {
		if b.Amount != 0 {
			t.Errorf("a hidden amount was sent: %+v", b)
		}
	}
	if e := WallCard(View{}, 3); e.Payday != "" || len(e.Bills) != 0 || e.Bills == nil {
		t.Errorf("no plan: %+v", e)
	}
}
