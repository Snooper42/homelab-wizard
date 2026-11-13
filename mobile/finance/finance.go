// Package finance is Finances' projection for a phone that keeps a
// household member's Finances sealed (.claude/prompts/private-finances.md):
// the computer can't read them, so it can't project them, and the phone
// runs the same Go the computer does (internal/finance) instead of a second
// copy of the model. The phone's web page loads it as WebAssembly
// (cmd/financewasm); the iPhone app as a framework (gomobile bind), which
// is why it lives outside internal/ and speaks only bytes and strings.
//
// Everything comes in as the computer keeps it (the plan's and the
// ledger's JSON) and goes out as the finance.View every Finances screen
// already draws, so the screens don't change. Nothing is read from
// anywhere else: today is the phone's.
package finance

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/finance"
)

// Project reads the plan forward from today (YYYY-MM-DD, the phone's
// day), with what the ledger says happened, as the computer's Finances
// call does: the finance.View, as JSON. An empty ledger is none yet.
func Project(plan, ledger []byte, today string) ([]byte, error) {
	day, err := time.Parse(time.DateOnly, today)
	if err != nil {
		return nil, fmt.Errorf("today %q is no day", today)
	}
	p, err := finance.ParsePlan(plan)
	if err != nil {
		return nil, fmt.Errorf("the plan: %w", err)
	}
	l := finance.Ledger{Transactions: []finance.Transaction{}}
	if len(ledger) > 0 {
		if l, err = finance.ParseLedger(ledger); err != nil {
			return nil, fmt.Errorf("the ledger: %w", err)
		}
	}
	return json.Marshal(finance.ProjectWith(p, l, day, finance.Ahead))
}
