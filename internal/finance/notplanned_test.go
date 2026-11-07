package finance

import (
	"encoding/json"
	"strings"
	"testing"
)

// A transaction the household said pays no planned payment keeps saying
// so; one that pays one can't also say it pays none. A ledger saved before
// NotPlanned loads as it was, and none is written for it.
func TestNotPlanned(t *testing.T) {
	p := Plan{
		Accounts: []Account{{ID: "chk", Name: "Checking", Kind: Checking, Balance: 1000}},
		Payments: []Payment{{ID: "power", Name: "Electric", Amount: 150, Schedule: Schedule{Every: Monthly, Start: "2026-01-12"}}},
	}
	var l Ledger
	if err := json.Unmarshal([]byte(`{"transactions":[{"id":"t1","date":"2026-11-08","account":"chk","amount":-150,"payee":"Electric"}]}`), &l); err != nil {
		t.Fatal(err)
	}
	c, err := CleanLedger(l, p)
	if err != nil || c.Transactions[0].NotPlanned {
		t.Fatalf("clean: %v %+v", err, c.Transactions)
	}
	if b, _ := json.Marshal(c.Transactions[0]); strings.Contains(string(b), "notPlanned") {
		t.Fatalf("written: %s", b)
	}
	l.Transactions[0].NotPlanned = true
	if c, err := CleanLedger(l, p); err != nil || !c.Transactions[0].NotPlanned {
		t.Fatalf("kept: %v %+v", err, c.Transactions)
	}
	// Linked, it pays one: the link wins.
	l.Transactions[0].Payment = "power"
	if c, err := CleanLedger(l, p); err != nil || c.Transactions[0].NotPlanned || c.Transactions[0].Payment != "power" {
		t.Fatalf("linked: %v %+v", err, c.Transactions)
	}
}
