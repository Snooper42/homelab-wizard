package finance

import (
	"encoding/json"
	"strings"
	"testing"
)

// Two rows joined into one transfer keep the bank's ID for the half that
// arrived (ToBank), so that statement brought in again does not bring it
// back; two said not to be one keep saying so (Apart). Both are optional:
// a ledger saved before them loads as it was, and writes neither.
func TestTransferFields(t *testing.T) {
	p := Plan{Accounts: []Account{{ID: "chk", Name: "Checking", Kind: Checking}, {ID: "sav", Name: "Savings", Kind: Savings}}}
	var l Ledger
	if err := json.Unmarshal([]byte(`{"transactions":[{"id":"t1","date":"2026-10-27","account":"chk","amount":-500,"payee":"Transfer"}]}`), &l); err != nil {
		t.Fatal(err)
	}
	c, err := CleanLedger(l, p)
	if err != nil {
		t.Fatal(err)
	}
	if b, _ := json.Marshal(c.Transactions[0]); strings.Contains(string(b), "toBank") || strings.Contains(string(b), "apart") {
		t.Fatalf("written: %s", b)
	}
	// Joined: into savings, with the arriving half's ID.
	l.Transactions[0].To, l.Transactions[0].ToBank = "sav", " FIT2 "
	if c, err := CleanLedger(l, p); err != nil || c.Transactions[0].ToBank != "FIT2" {
		t.Fatalf("joined: %v %+v", err, c.Transactions)
	}
	// Apart is for a row that is not a transfer; a transfer's own ToBank needs its To.
	l.Transactions[0].Apart = true
	if c, err := CleanLedger(l, p); err != nil || c.Transactions[0].Apart {
		t.Fatalf("a transfer said apart: %v %+v", err, c.Transactions)
	}
	l.Transactions[0].To = ""
	if c, err := CleanLedger(l, p); err != nil || c.Transactions[0].ToBank != "" || !c.Transactions[0].Apart {
		t.Fatalf("not a transfer: %v %+v", err, c.Transactions)
	}
}
