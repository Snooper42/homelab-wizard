package finance

import (
	"bytes"
	"encoding/json"
	"flag"
	"os"
	"path/filepath"
	"testing"
)

// The preview's example household (app/preview/finance.json): the
// screenshots and smoke checks run the Finances screen on it without the Go
// side. To update it after changing Project or the example:
//
//	go test ./internal/finance -run TestPreview -update
var update = flag.Bool("update", false, "rewrite app/preview/finance.json")

func example() Plan {
	p := household()
	p.Updated = "2026-10-30"
	p.Accounts = []Account{
		{ID: "chk", Name: "Chase Checking", Kind: Checking, Institution: "chase", Balance: 2512.40, Detail: "••4821", Updated: "2026-10-30"},
		{ID: "sav", Name: "BofA Savings", Kind: Savings, Institution: "bankofamerica", Balance: 6500, Rate: 3.2, Updated: "2026-10-30"},
		{ID: "brk", Name: "Robinhood", Kind: Investment, Institution: "robinhood", Balance: 8200, Updated: "2026-10-28"},
		{ID: "roth", Name: "Roth IRA", Kind: Retirement, Institution: "robinhood", Balance: 14600, Updated: "2026-10-28"},
		{ID: "k401", Name: "Fidelity 401(k)", Kind: Retirement, Balance: 38500, Updated: "2026-10-25"},
		{ID: "visa", Name: "Chase Freedom", Kind: Card, Institution: "chase", Balance: 1240.55, Pending: 84.10, Updated: "2026-10-30"},
		{ID: "amex", Name: "Amex Gold", Kind: Card, Institution: "americanexpress", Balance: 386.20, Updated: "2026-10-30"},
		{ID: "mortgage", Name: "Mortgage", Kind: Loan, Institution: "wellsfargo", Balance: 287400, Original: 320000},
		{ID: "carloan", Name: "Toyota Financial", Kind: Loan, Institution: "toyota", Balance: 11240, Original: 24000},
		{ID: "home", Name: "Home", Kind: Home, Institution: "zillow", Balance: 410000, Loan: "mortgage", Detail: "Bought May 2022"},
		{ID: "rav4", Name: "2022 Toyota RAV4", Kind: Car, Institution: "toyota", Balance: 18500, Loan: "carloan", Detail: "XLE, 31,400 miles"},
	}
	p.Payments = []Payment{
		{ID: "mortgagepay", Name: "Mortgage", Amount: 1845, Kind: "home", Institution: "wellsfargo", To: "mortgage", Schedule: Schedule{Every: Monthly, Start: "2026-01-01"}},
		{ID: "netflix", Name: "Netflix", Amount: 15.49, Kind: "subscriptions", Institution: "netflix", Schedule: Schedule{Every: Monthly, Start: "2026-01-03"}},
		{ID: "peloton", Name: "Peloton", Amount: 44, Kind: "subscriptions", Institution: "peloton", Schedule: Schedule{Every: Monthly, Start: "2026-01-05"}},
		{ID: "internet", Name: "Internet", Amount: 70, Kind: "utilities", Schedule: Schedule{Every: Monthly, Start: "2026-01-09"}},
		{ID: "amexpay", Name: "Amex Gold", Amount: 300, Kind: "cards", Institution: "americanexpress", Card: "amex", Schedule: Schedule{Every: Monthly, Start: "2026-01-09"}},
		{ID: "insurance", Name: "Car insurance", Amount: 168, Kind: "car", Schedule: Schedule{Every: Monthly, Start: "2026-01-12"}},
		{ID: "spotify", Name: "Spotify", Amount: 11.99, Kind: "subscriptions", Institution: "spotify", Schedule: Schedule{Every: Monthly, Start: "2026-01-14"}},
		{ID: "carpay", Name: "Car payment", Amount: 412, Kind: "car", Institution: "toyota", To: "carloan", Schedule: Schedule{Every: Monthly, Start: "2026-01-15"}},
		{ID: "electric", Name: "Electric", Amount: 140, Estimate: true, Kind: "utilities", Schedule: Schedule{Every: Monthly, Start: "2026-01-18"}},
		{ID: "visapay", Name: "Chase Freedom", Amount: 900, Kind: "cards", Institution: "chase", Card: "visa", Schedule: Schedule{Every: Monthly, Start: "2026-01-21"}},
		{ID: "phones", Name: "Verizon", Amount: 95, Kind: "utilities", Institution: "verizon", Schedule: Schedule{Every: Monthly, Start: "2026-01-22"}},
		{ID: "rothpay", Name: "Roth IRA", Amount: 250, Kind: "savings", Institution: "robinhood", To: "roth", Schedule: Schedule{Every: Monthly, Start: "2026-01-27"}},
		{ID: "hoa", Name: "HOA", Amount: 310, Kind: "home", Schedule: Schedule{Every: Monthly, Start: "2026-01-28"}},
		{ID: "water", Name: "Water and sewer", Amount: 120, Kind: "utilities", Schedule: Schedule{Every: Quarterly, Start: "2026-01-10"}},
		{ID: "food", Name: "Groceries and gas", Amount: 200, Kind: "spending", Schedule: Schedule{Every: Weekly, Start: "2026-10-31"}},
		{ID: "save", Name: "Savings", Amount: 200, Kind: "savings", Institution: "bankofamerica", To: "sav", Schedule: Schedule{Every: Biweekly, Start: "2026-11-06"}},
	}
	return p
}

func TestPreview(t *testing.T) {
	p, err := Clean(example())
	if err != nil {
		t.Fatal(err)
	}
	got, _ := json.MarshalIndent(Project(p, date("2026-10-30"), 12), "", " ")
	got = append(got, '\n')
	file := filepath.Join("..", "..", "app", "preview", "finance.json")
	if *update {
		if err := os.WriteFile(file, got, 0o644); err != nil {
			t.Fatal(err)
		}
		return
	}
	want, _ := os.ReadFile(file)
	if !bytes.Equal(got, want) {
		t.Fatalf("%s is out of date: go test ./internal/finance -run TestPreview -update", file)
	}
}
