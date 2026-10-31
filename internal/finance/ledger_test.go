package finance

import (
	"errors"
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
