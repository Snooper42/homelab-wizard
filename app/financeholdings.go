package main

import (
	"context"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/finance"
	"github.com/Snooper42/homelab-wizard/internal/ghostfolio"
)

// Finances › Net worth › Investments: what each of Ghostfolio's accounts
// holds, read by internal/ghostfolio (which the phone companion calls
// too, for the native iPhone app).

// InvestmentsRead is the plan after Read now, the names of Ghostfolio's
// accounts no account in it matched, and how many accounts and holdings
// Ghostfolio has, matched or not: a read of a Ghostfolio with nothing in
// it yet still shows the token worked.
type InvestmentsRead struct {
	View      finance.View `json:"view"`
	Unmatched []string     `json:"unmatched"`
	Accounts  int          `json:"accounts"`
	Holdings  int          `json:"holdings"`
}

// FinancesReadInvestments reads what each of Ghostfolio's accounts holds
// and keeps it on the plan's accounts it matches (Read now, or once a day
// on opening Finances): nothing is kept when the read fails.
func (a *App) FinancesReadInvestments() (InvestmentsRead, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	r, err := ghostfolio.ReadInto(ctx, a.root)
	if err != nil {
		return InvestmentsRead{}, err
	}
	return InvestmentsRead{View: finance.ProjectWith(r.Plan, a.ledger(), time.Now(), finance.Ahead), Unmatched: r.Unmatched, Accounts: r.Accounts, Holdings: r.Holdings}, nil
}
