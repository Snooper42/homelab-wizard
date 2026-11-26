package main

import (
	"context"

	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/financeapps"
)

// Finances reads from the homelab's own apps on a click, only reading
// (internal/financeapps): the balances Firefly III and Ghostfolio keep
// (Update balances), and the subscriptions Wallos keeps (Recurring).

// AppBalance is an account's balance as another app on the homelab keeps it.
type AppBalance = financeapps.Balance

// AppSubscription is a subscription as Wallos keeps it.
type AppSubscription = financeapps.Subscription

// fireflyBase and wallosBase are their APIs on this machine (tests replace them).
var (
	fireflyBase = financeapps.FireflyBase
	wallosBase  = financeapps.WallosBase
	wallosEvery = financeapps.WallosEvery
)

// FinancesFromFirefly reads the asset accounts' balances from Firefly III.
func (a *App) FinancesFromFirefly() ([]AppBalance, error) {
	env := core.Env(a.root)
	return financeapps.Firefly(context.Background(), fireflyBase(env), env)
}

// FinancesFromWallos reads the subscriptions Wallos keeps.
func (a *App) FinancesFromWallos() ([]AppSubscription, error) {
	env := core.Env(a.root)
	return financeapps.Wallos(context.Background(), wallosBase(env), env)
}

// FinancesFromGhostfolio reads what each of Ghostfolio's accounts is worth.
func (a *App) FinancesFromGhostfolio() ([]AppBalance, error) {
	return financeapps.Ghostfolio(context.Background(), core.Env(a.root))
}
