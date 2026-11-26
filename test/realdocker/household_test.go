//go:build realdocker

package realdocker

import (
	"errors"
	"fmt"
	"os"
	"runtime"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/finance"
)

// What the household uses most, on a real machine (quality-loop Q2): Status'
// Stop, Start and Restart on a running app, and Finances kept through a move
// to a new machine.

// startAndRestart does what Status' row menu does (Stop, then Start, then
// Restart: each runs homelab stop|start|restart <app> --apply, as the app's
// buttons do) and checks the app is down, then up and answering, and that
// Restart gave it a fresh container start.
func (l *lab) startAndRestart(t *testing.T, a realApp) {
	l.run("stop", a.id, "--apply")
	waitFor(t, a.id+" stopped", 2*time.Minute, func() error {
		if s := l.status()[a.id]; s.State == "running" {
			return fmt.Errorf("state %q", s.State)
		}
		return nil
	})
	l.run("start", a.id, "--apply")
	l.up([]realApp{a})
	before := l.startedAt(a.id)
	l.run("restart", a.id, "--apply")
	l.up([]realApp{a})
	if after := l.startedAt(a.id); after == before {
		t.Errorf("%s was not restarted: its container started at %s before and after", a.id, before)
	}
}

// startedAt is when an app's container last started, as docker records it.
func (l *lab) startedAt(id string) string {
	return docker(l.t, "inspect", "--format", "{{.State.StartedAt}}", l.container(id))
}

// The plan and the ledger the household would type in: an account with a
// balance, a bill, and one transaction on it.
const (
	financeAccount = "Everyday checking"
	financeBalance = 2412.57
	financeBill    = "Electric"
	financePayee   = "Corner grocer"
	financeAmount  = -63.18
)

// saveFinances saves a plan and a ledger through the same calls the app's
// Finances screen saves with (finance.Save, finance.SaveLedger).
func saveFinances(root string) error {
	p, err := finance.Load(finance.Path(root))
	if err != nil {
		return err
	}
	p.Accounts = []finance.Account{{Name: financeAccount, Kind: "checking", Balance: financeBalance}}
	p.Payments = []finance.Payment{{Name: financeBill, Amount: 120, Kind: "utilities", Schedule: finance.Schedule{Every: "month", Start: "2026-01-15"}}}
	if p, err = finance.Save(finance.Path(root), p); err != nil {
		return fmt.Errorf("saving the plan: %w", err)
	}
	l, err := finance.LoadLedger(finance.LedgerPath(root))
	if err != nil {
		return err
	}
	l.Transactions = []finance.Transaction{{Date: "2026-01-20", Account: p.Accounts[0].ID, Amount: financeAmount, Payee: financePayee}}
	if _, err := finance.SaveLedger(finance.LedgerPath(root), l, p); err != nil {
		return fmt.Errorf("saving the ledger: %w", err)
	}
	return nil
}

// financesBack checks the plan and the ledger saveFinances wrote load as
// they were saved, readable by their owner only.
func financesBack(root string) error {
	var errs []error
	for _, path := range []string{finance.Path(root), finance.LedgerPath(root)} {
		fi, err := os.Stat(path)
		if err != nil {
			errs = append(errs, err)
			continue
		}
		if runtime.GOOS != "windows" && fi.Mode().Perm()&0o077 != 0 {
			errs = append(errs, fmt.Errorf("%s is %v, not readable by its owner only", path, fi.Mode().Perm()))
		}
	}
	p, err := finance.Load(finance.Path(root))
	if err != nil {
		return fmt.Errorf("loading the plan: %w", err)
	}
	if len(p.Accounts) != 1 || p.Accounts[0].Name != financeAccount || p.Accounts[0].Balance != financeBalance {
		errs = append(errs, fmt.Errorf("the plan's accounts are %+v, not %s at %.2f", p.Accounts, financeAccount, financeBalance))
	}
	if len(p.Payments) != 1 || p.Payments[0].Name != financeBill {
		errs = append(errs, fmt.Errorf("the plan's bills are %+v, not %s", p.Payments, financeBill))
	}
	l, err := finance.LoadLedger(finance.LedgerPath(root))
	if err != nil {
		return fmt.Errorf("loading the ledger: %w", err)
	}
	if len(l.Transactions) != 1 || l.Transactions[0].Payee != financePayee || l.Transactions[0].Amount != financeAmount {
		errs = append(errs, fmt.Errorf("the ledger is %+v, not %s at %.2f", l.Transactions, financePayee, financeAmount))
	}
	return errors.Join(errs...)
}
