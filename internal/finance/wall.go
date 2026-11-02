package finance

// Wall is the money card a wall screen shows (kiosk mode), when Settings ›
// Phones lets that screen have it: the next payday, checking after it and
// its bills, and the next few bills. It is all such a screen is sent, never
// the plan; with Hide amounts on, it carries no amount at all.
type Wall struct {
	// Payday is the next paycheck's day (YYYY-MM-DD), "" with none ahead;
	// Who are the names of those paid that day.
	Payday string   `json:"payday,omitempty"`
	Who    []string `json:"who,omitempty"`
	// Left is checking once that paycheck's stretch has paid its bills.
	Left float64 `json:"left"`
	// Bills are the next bills from today, soonest first: no spending
	// money or savings, which are no bill.
	Bills []WallBill `json:"bills"`
	// Hidden: Hide amounts is on, and every amount here is 0.
	Hidden   bool   `json:"hidden,omitempty"`
	Currency string `json:"currency,omitempty"`
}

// WallBill is one bill on the money card.
type WallBill struct {
	Name        string  `json:"name"`
	Institution string  `json:"institution,omitempty"`
	Date        string  `json:"date"`
	Amount      float64 `json:"amount"`
}

// WallCard is v's money card, with at most n bills.
func WallCard(v View, n int) Wall {
	w := Wall{Hidden: v.Plan.HideAmounts, Currency: v.Plan.Currency, Bills: []WallBill{}}
	names := map[string]string{}
	for _, e := range v.Plan.People {
		names[e.ID] = e.Name
	}
	for _, p := range v.Periods {
		if p.Pay == nil {
			continue
		}
		w.Payday, w.Left = p.Pay.Date, p.Left
		for _, id := range p.Pay.People {
			w.Who = append(w.Who, names[id])
		}
		break
	}
	pay := map[string]Payment{}
	for _, p := range v.Plan.Payments {
		pay[p.ID] = p
	}
	for _, per := range v.Periods {
		for _, r := range per.Rows {
			p, ok := pay[r.Payment]
			if len(w.Bills) >= n || !ok || r.Date < v.Today || r.Saved || r.Into || r.Outside || p.Kind == "spending" || p.Kind == "savings" {
				continue
			}
			w.Bills = append(w.Bills, WallBill{Name: p.Name, Institution: p.Institution, Date: r.Date, Amount: r.Amount})
		}
	}
	if w.Hidden {
		w.Left = 0
		for i := range w.Bills {
			w.Bills[i].Amount = 0
		}
	}
	return w
}
