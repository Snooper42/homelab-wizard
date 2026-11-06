package main

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/finance"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// A note that a message went out which can't be saved is said: the next
// night would send the message again, and nothing told anyone why.
func TestASentNoteThatCantBeSavedSaysSo(t *testing.T) {
	root, _ := repoCopy(t)
	out := &bytes.Buffer{}
	h, err := newHomelab(&ui.UI{Out: out}, root)
	if err != nil {
		t.Fatal(err)
	}
	plan := finance.Plan{Updated: "2026-10-30",
		Accounts: []finance.Account{{Name: "Checking", Kind: finance.Checking, Balance: 5000}},
		Payments: []finance.Payment{{Name: "Mortgage", Amount: 1845, Schedule: finance.Schedule{Every: finance.Monthly, Start: "2026-01-01"}}}}
	if _, err := finance.Save(finance.Path(root), plan); err != nil {
		t.Fatal(err)
	}
	// Where the note goes, something that isn't a file.
	if err := os.MkdirAll(filepath.Join(h.logsDir(), "finance-reminders.json", "x"), 0o700); err != nil {
		t.Fatal(err)
	}
	h.sendFinanceReminders(context.Background(), time.Date(2026, 10, 31, 3, 30, 0, 0, time.Local))
	if !strings.Contains(out.String(), "Finances: Due tomorrow: Mortgage") {
		t.Fatalf("not sent:\n%s", out)
	}
	if !strings.Contains(out.String(), "couldn't note that Finances' reminders went out") {
		t.Errorf("no word of the note not saved:\n%s", out)
	}
}
