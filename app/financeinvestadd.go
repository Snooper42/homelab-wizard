package main

import (
	"context"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/finance"
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

// InvestmentTrade is a buy or a sale Ghostfolio keeps, listed under its
// holding on the card to put right or delete: its id there, the plan's
// account, the symbol, how many shares, what was paid (or got) for them in
// all, in Currency, the fee Ghostfolio has on it, and the day (YYYY-MM-DD).
type InvestmentTrade struct {
	ID         string  `json:"id"`
	Account    string  `json:"account"`
	Symbol     string  `json:"symbol"`
	DataSource string  `json:"dataSource"`
	Currency   string  `json:"currency"`
	Shares     float64 `json:"shares"`
	Total      float64 `json:"total"`
	Fee        float64 `json:"fee,omitempty"`
	Date       string  `json:"date"`
	Sold       bool    `json:"sold,omitempty"`
}

// FinancesInvestmentTrades lists a holding's buys and sales in one of the
// plan's investment or retirement accounts, as Ghostfolio keeps them, the
// newest first.
func (a *App) FinancesInvestmentTrades(account, symbol string) ([]InvestmentTrade, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	list, err := ghostfolio.Trades(ctx, a.root, account, symbol)
	if err != nil {
		return nil, err
	}
	out := make([]InvestmentTrade, 0, len(list))
	for _, t := range list {
		out = append(out, InvestmentTrade(t))
	}
	return out, nil
}

// FinancesChangeInvestment puts a buy or a sale typed wrong right in
// Ghostfolio (its shares, what was paid, the day, bought or sold), then
// reads the investments again.
func (a *App) FinancesChangeInvestment(t InvestmentTrade) (InvestmentsRead, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := ghostfolio.ChangeTrade(ctx, a.root, ghostfolio.Trade(t)); err != nil {
		return InvestmentsRead{}, err
	}
	return a.FinancesReadInvestments()
}

// FinancesDeleteInvestment deletes a buy or a sale from Ghostfolio, from
// the plan's account named only, then reads the investments again.
func (a *App) FinancesDeleteInvestment(account, id string) (InvestmentsRead, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := ghostfolio.DeleteTrade(ctx, a.root, account, id); err != nil {
		return InvestmentsRead{}, err
	}
	return a.FinancesReadInvestments()
}

// FinancesFollow follows a ticker FindSymbol found (Investments'
// Watchlist): priced by Ghostfolio now, kept in the plan with the day and
// that price, and priced again at each read. It counts in no worth.
func (a *App) FinancesFollow(s AppSymbol) (finance.View, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	p, err := ghostfolio.FollowInto(ctx, a.root, ghostfolio.Symbol(s))
	if err != nil {
		return finance.View{}, err
	}
	return finance.ProjectWith(p, a.ledger(), time.Now(), finance.Ahead), nil
}
