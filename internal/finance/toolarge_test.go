package finance

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// A number too large to be money is refused, and never costs what was
// there (N43). An amount of 1e308 is valid JSON, from a phone allowed to
// change Finances or a bank's file; kept as cents it became infinity, the
// save could not encode it, and wrote an empty file over the ledger: every
// transaction gone, and no error. A plan with one could no longer be
// projected, so Finances opened nowhere.
func TestNothingTooLargeToBeMoneyIsSaved(t *testing.T) {
	dir := t.TempDir()
	ledgerPath, planPath := filepath.Join(dir, "finance-ledger.json"), filepath.Join(dir, "finance.json")
	p, err := Save(planPath, household())
	if err != nil {
		t.Fatal(err)
	}
	l, err := SaveLedger(ledgerPath, Ledger{Transactions: []Transaction{{Date: "2026-10-01", Account: "chk", Amount: -12, Payee: "Kept"}}}, p)
	if err != nil {
		t.Fatal(err)
	}
	for _, amount := range []string{"1e308", "-1e308", "1e12", "123456789012345"} {
		var huge Ledger
		if err := json.Unmarshal([]byte(`{"transactions":[{"date":"2026-10-02","account":"chk","amount":`+amount+`,"payee":"Huge"}]}`), &huge); err != nil {
			t.Fatal(err)
		}
		huge.Transactions = append(append([]Transaction{}, l.Transactions...), huge.Transactions...)
		huge.Rev = l.Rev
		if _, err := SaveLedger(ledgerPath, huge, p); !errors.Is(err, ErrTooLarge) {
			t.Errorf("a ledger with %s was not refused as too large: %v", amount, err)
		}
		if data, _ := os.ReadFile(ledgerPath); !strings.Contains(string(data), `"Kept"`) {
			t.Fatalf("saving %s cost the ledger: %q", amount, data)
		}
	}
	for name, change := range map[string]func(*Plan){
		"a balance":    func(q *Plan) { q.Accounts[0].Balance = 1e308 },
		"a payment":    func(q *Plan) { q.Payments[0].Amount = 1e15 },
		"a paycheck":   func(q *Plan) { q.People[0].Net = -1e300 },
		"the cushion":  func(q *Plan) { q.Cushion = 1e13 },
		"a goal's aim": func(q *Plan) { q.Goals = []Goal{{ID: "g", Name: "Boat", Target: 1e200, Date: "2030-01-01"}} },
	} {
		raw, _ := json.Marshal(p)
		var q Plan
		_ = json.Unmarshal(raw, &q)
		change(&q)
		if _, err := Save(planPath, q); !errors.Is(err, ErrTooLarge) {
			t.Errorf("%s too large to be money was not refused: %v", name, err)
		}
	}
	if data, _ := os.ReadFile(planPath); !strings.Contains(string(data), `"Chase Freedom"`) {
		t.Fatalf("the plan was lost: %q", data)
	}
	// Money as a household has it still saves: a mortgage, a house, a year of pay.
	big := p
	big.Accounts = append([]Account{}, p.Accounts...)
	big.Accounts[0].Balance = 999_999_999.99
	if _, err := Save(planPath, big); err != nil {
		t.Errorf("a balance under a billion: %v", err)
	}
}
