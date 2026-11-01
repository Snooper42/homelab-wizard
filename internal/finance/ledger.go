package finance

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// Ledger is what actually happened to the household's money, a
// transaction at a time, beside the plan that reads it forward. It is a
// file of its own (LedgerPath), so the plan stays small however long the
// ledger grows; the nightly backup copies it off-site with the plan, as it
// does every data/*.json. Rev works as the plan's does: a save from a
// device that read an older ledger is refused.
type Ledger struct {
	Transactions []Transaction `json:"transactions"`
	Rev          string        `json:"rev,omitempty"`
}

// Transaction is one movement of money on an account, on a day.
type Transaction struct {
	ID   string `json:"id"`
	Date string `json:"date"` // YYYY-MM-DD
	// Account is the plan's account it happened on, by ID.
	Account string `json:"account"`
	// Amount is signed as the account sees it: money in is a plus, money
	// out a minus. On a card a charge is a minus (it owes more) and a
	// payment to it a plus.
	Amount float64 `json:"amount"`
	// Payee is who was paid, or who paid ("Netflix", "Alex's paycheck").
	Payee string `json:"payee,omitempty"`
	// Institution is the payee's logo when one was picked ("netflix");
	// none, the screen reads it from the payee's name.
	Institution string `json:"institution,omitempty"`
	Category    string `json:"category,omitempty"`
	Note        string `json:"note,omitempty"`
	// Payment is the planned payment it pays, by ID, when it pays one.
	Payment string `json:"payment,omitempty"`
	// To is the account a transfer goes into: Amount leaves Account (a
	// minus) and the same arrives in To. It is one transaction, not two.
	To string `json:"to,omitempty"`
	// Splits divide it across categories; together they come to Amount.
	Splits []Split  `json:"splits,omitempty"`
	Tags   []string `json:"tags,omitempty"`
	// Bank is the bank's own ID for it (an OFX statement's FITID), when it
	// came from the bank's file: the same one is not brought in twice.
	Bank string `json:"bank,omitempty"`
	// Receipt is the picture or PDF kept with it, by its file's name in
	// data/finance-receipts/ (SaveReceipt).
	Receipt string `json:"receipt,omitempty"`
}

// Split is a part of a transaction in a category of its own.
type Split struct {
	Category string  `json:"category"`
	Amount   float64 `json:"amount"`
	Note     string  `json:"note,omitempty"`
}

// LedgerPath is the ledger in the homelab folder, beside the plan.
func LedgerPath(root string) string { return filepath.Join(root, "data", "finance-ledger.json") }

// LoadLedger reads the ledger; none yet is an empty one.
func LoadLedger(path string) (Ledger, error) {
	l := Ledger{Transactions: []Transaction{}}
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		l.Rev = noFile
		return l, nil
	}
	if err != nil {
		return l, err
	}
	err = json.Unmarshal(data, &l)
	if l.Transactions == nil {
		l.Transactions = []Transaction{}
	}
	l.Rev = rev(data)
	return l, err
}

// SaveLedger checks the ledger against the plan and writes it, owner-only
// and whole, as Save does the plan: one read before another device saved
// is refused with ErrChanged, and the ledger saved comes back with its new
// Rev.
func SaveLedger(path string, l Ledger, p Plan) (Ledger, error) {
	l, err := CleanLedger(l, p)
	if err != nil {
		return l, err
	}
	was := l.Rev
	l.Rev = ""
	data, _ := json.MarshalIndent(l, "", "  ")
	l.Rev, err = write(path, was, data)
	if err != nil {
		l.Rev = was
		return l, err
	}
	// Receipts no transaction names any more go after a day; failing to
	// remove one leaves it for the next save.
	_ = pruneReceipts(receiptsBeside(path), l, time.Now())
	return l, nil
}

// CleanLedger checks each transaction against the plan and tidies it: a
// day, an account the plan has, an amount that is not nothing, a transfer
// into another account, splits that come to the whole, and a planned
// payment that exists, and a receipt by its file's name. It trims the words, keeps tags once each in lower
// case, gives each an ID of its own, and keeps them oldest first (by day,
// then as entered). It says which is wrong rather than guess.
func CleanLedger(l Ledger, p Plan) (Ledger, error) {
	accounts := map[string]bool{}
	currency := map[string]string{}
	for _, a := range p.Accounts {
		accounts[a.ID] = true
		if c := strings.ToUpper(a.Currency); c != p.home() {
			currency[a.ID] = c
		}
	}
	payments := map[string]bool{}
	for _, x := range p.WithCards() {
		payments[x.ID] = true
	}
	used := map[string]bool{}
	out := make([]Transaction, 0, len(l.Transactions))
	for i, t := range l.Transactions {
		t.Payee, t.Note, t.Category, t.Bank = strings.TrimSpace(t.Payee), strings.TrimSpace(t.Note), strings.TrimSpace(t.Category), strings.TrimSpace(t.Bank)
		what := t.Payee
		if what == "" {
			what = fmt.Sprintf("transaction %d", i+1)
		}
		if _, err := day(t.Date, time.UTC); err != nil || len(t.Date) != 10 {
			return l, fmt.Errorf("%s: no date (YYYY-MM-DD)", what)
		}
		if t.Receipt = strings.TrimSpace(t.Receipt); t.Receipt != "" && !receiptName.MatchString(t.Receipt) {
			return l, fmt.Errorf("%s: no receipt %q", what, t.Receipt)
		}
		if !accounts[t.Account] {
			return l, fmt.Errorf("%s: no account %q", what, t.Account)
		}
		t.Amount = cents(t.Amount)
		if t.Amount == 0 {
			return l, fmt.Errorf("%s: no amount", what)
		}
		if t.To != "" {
			if !accounts[t.To] {
				return l, fmt.Errorf("%s: no account %q to move it into", what, t.To)
			}
			if t.To == t.Account {
				return l, fmt.Errorf("%s: a transfer goes into another account", what)
			}
			// One amount leaves and the same arrives: between two currencies
			// it would not, so such a move is two transactions, out and in.
			if currency[t.To] != currency[t.Account] {
				return l, fmt.Errorf("%s: a transfer between accounts in two currencies is two transactions, one out and one in", what)
			}
			if t.Amount > 0 {
				return l, fmt.Errorf("%s: a transfer leaves its account: type it as a minus", what)
			}
		}
		if t.Payment != "" && !payments[t.Payment] {
			return l, fmt.Errorf("%s: no planned payment %q", what, t.Payment)
		}
		if len(t.Splits) > 0 {
			sum := 0.0
			for j := range t.Splits {
				sp := &t.Splits[j]
				sp.Category, sp.Note, sp.Amount = strings.TrimSpace(sp.Category), strings.TrimSpace(sp.Note), cents(sp.Amount)
				if sp.Category == "" {
					return l, fmt.Errorf("%s: a part with no category", what)
				}
				sum += sp.Amount
			}
			if math.Abs(sum-t.Amount) >= 0.005 {
				return l, fmt.Errorf("%s: its parts come to %.2f, not %.2f", what, sum, t.Amount)
			}
			// Split, the categories are the parts'.
			t.Category = ""
		}
		t.Tags = tags(t.Tags)
		t.ID = ledgerID(t.ID, used)
		out = append(out, t)
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Date < out[j].Date })
	l.Transactions = out
	return l, nil
}

// tags are kept once each, in lower case, trimmed, in the order first given.
func tags(in []string) []string {
	var out []string
	seen := map[string]bool{}
	for _, t := range in {
		t = strings.ToLower(strings.TrimSpace(t))
		if t != "" && !seen[t] {
			seen[t] = true
			out = append(out, t)
		}
	}
	return out
}

// ledgerID keeps a transaction's ID when it is its own, else gives it the
// next free "t<n>".
func ledgerID(have string, used map[string]bool) string {
	if have != "" && !used[have] {
		used[have] = true
		return have
	}
	for n := len(used) + 1; ; n++ {
		if id := fmt.Sprintf("t%d", n); !used[id] {
			used[id] = true
			return id
		}
	}
}
