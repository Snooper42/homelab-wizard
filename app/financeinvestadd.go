package main

import (
	"context"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/ghostfolio"
)

// Finances › Net worth › Investments › Add: a buy or a sale typed in on the
// card is put into the homelab's own Ghostfolio, on this machine, so the
// household rarely opens Ghostfolio. Only the ticker typed leaves the
// homelab, when Ghostfolio looks it up; amounts and accounts stay here.
// The work is internal/ghostfolio's, shared with the phone companion.

// AppSymbol is a ticker Ghostfolio found: its symbol, name, the currency
// it trades in, and where Ghostfolio prices it.
type AppSymbol struct {
	Symbol     string `json:"symbol"`
	Name       string `json:"name"`
	Currency   string `json:"currency"`
	DataSource string `json:"dataSource"`
}

// FinancesFindSymbol looks a ticker or a name up in Ghostfolio, for the
// form to offer its matches; nothing typed finds nothing.
func (a *App) FinancesFindSymbol(query string) ([]AppSymbol, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	found, err := ghostfolio.FindSymbol(ctx, core.Env(a.root), query)
	if err != nil {
		return nil, err
	}
	out := make([]AppSymbol, 0, len(found))
	for _, s := range found {
		out = append(out, AppSymbol(s))
	}
	return out, nil
}

// InvestmentAdd is a buy (or, Sold, a sale) typed in on the card: into the
// plan's account Account, or a new investment account NewName; the
// symbol as Ghostfolio found it; how many shares, and what was paid (or
// got) for them in all, in Currency; on Date (YYYY-MM-DD).
type InvestmentAdd struct {
	Account    string  `json:"account,omitempty"`
	NewName    string  `json:"newName,omitempty"`
	Symbol     string  `json:"symbol"`
	DataSource string  `json:"dataSource"`
	Currency   string  `json:"currency"`
	Shares     float64 `json:"shares"`
	Total      float64 `json:"total"`
	Date       string  `json:"date"`
	Sold       bool    `json:"sold,omitempty"`
}

// FinancesAddInvestment puts a buy or a sale into Ghostfolio, in the
// Ghostfolio account of the plan account's name (made there first when
// it has none), then reads the investments again. A new account is made
// in Ghostfolio and in the plan by one name, so the two always match; it
// is kept in the plan only once Ghostfolio has taken the buy.
func (a *App) FinancesAddInvestment(add InvestmentAdd) (InvestmentsRead, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := ghostfolio.AddInvestment(ctx, a.root, ghostfolio.Add(add)); err != nil {
		return InvestmentsRead{}, err
	}
	return a.FinancesReadInvestments()
}
