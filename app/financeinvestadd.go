package main

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/finance"
)

// Finances › Net worth › Investments › Add: a buy or a sale typed in on the
// card is put into the homelab's own Ghostfolio, on this machine, so the
// household rarely opens Ghostfolio. Only the ticker typed leaves the
// homelab, when Ghostfolio looks it up; amounts and accounts stay here.

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
	query = strings.TrimSpace(query)
	if query == "" {
		return []AppSymbol{}, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	g, err := ghostfolioSignIn(ctx, core.Env(a.root))
	if err != nil {
		return nil, err
	}
	var found struct {
		Items []AppSymbol `json:"items"`
	}
	if err := g.read(ctx, "/symbol/lookup?query="+url.QueryEscape(strings.ToLower(query)), &found); err != nil {
		return nil, err
	}
	out := []AppSymbol{}
	for _, s := range found.Items {
		s.Symbol, s.Name = strings.TrimSpace(s.Symbol), strings.TrimSpace(s.Name)
		if s.Symbol == "" || s.DataSource == "" {
			continue
		}
		out = append(out, s)
		if len(out) == 8 {
			break
		}
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
	path := finance.Path(a.root)
	p, err := finance.Load(path)
	if err != nil {
		return InvestmentsRead{}, err
	}
	add.Symbol, add.NewName = strings.TrimSpace(add.Symbol), strings.TrimSpace(add.NewName)
	day, err := time.ParseInLocation("2006-01-02", add.Date, time.Local)
	switch {
	case add.Symbol == "" || add.DataSource == "" || add.Currency == "":
		return InvestmentsRead{}, errors.New("pick what was bought from the list Ghostfolio finds")
	case !(add.Shares > 0) || math.IsInf(add.Shares, 0):
		return InvestmentsRead{}, errors.New("how many shares: more than 0")
	case !(add.Total >= 0) || math.IsInf(add.Total, 0):
		return InvestmentsRead{}, errors.New("what was paid: type it without a minus")
	case err != nil:
		return InvestmentsRead{}, fmt.Errorf("the day %q is no date", add.Date)
	case day.After(time.Now()):
		return InvestmentsRead{}, errors.New("the day is still to come: type the day it was bought")
	}
	// The plan's account, or a new one.
	var acct finance.Account
	if add.NewName != "" {
		acct = finance.Account{Name: add.NewName, Kind: finance.Investment}
	} else {
		found := false
		for _, x := range p.Accounts {
			if x.ID == add.Account {
				acct, found = x, true
			}
		}
		switch {
		case !found:
			return InvestmentsRead{}, errors.New("pick the account it is in")
		case acct.Kind != finance.Investment && acct.Kind != finance.Retirement:
			return InvestmentsRead{}, fmt.Errorf("%s is not an investment or retirement account", acct.Name)
		}
	}
	code := strings.ToUpper(acct.Currency)
	if code == "" {
		code = strings.ToUpper(strings.TrimSpace(p.Currency))
	}
	if code == "" {
		code = "USD"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	g, err := ghostfolioSignIn(ctx, core.Env(a.root))
	if err != nil {
		return InvestmentsRead{}, err
	}
	var list struct {
		Accounts []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"accounts"`
	}
	if err := g.read(ctx, "/account", &list); err != nil {
		return InvestmentsRead{}, err
	}
	// Ghostfolio's account for it: the one picked by hand, else the same
	// name, else the one name inside the other when only one is.
	want := strings.TrimSpace(acct.Ghostfolio)
	if want == "" {
		want = acct.Name
	}
	plain := func(s string) string { return strings.Join(strings.FieldsFunc(strings.ToLower(s), notWordRune), " ") }
	id := ""
	for _, x := range list.Accounts {
		if plain(x.Name) == plain(want) {
			id = x.ID
			break
		}
	}
	if id == "" && acct.Ghostfolio == "" {
		var near []string
		for _, x := range list.Accounts {
			n, w := plain(x.Name), plain(want)
			if n != "" && (strings.Contains(n, w) || strings.Contains(w, n)) {
				near = append(near, x.ID)
			}
		}
		if len(near) == 1 {
			id = near[0]
		}
	}
	if id == "" {
		var made struct {
			ID string `json:"id"`
		}
		err := g.call(ctx, http.MethodPost, "/account", map[string]any{"name": acct.Name, "currency": code, "balance": 0, "platformId": nil}, &made)
		if err != nil {
			return InvestmentsRead{}, err
		}
		if made.ID == "" {
			return InvestmentsRead{}, errGhostfolioUnread
		}
		id = made.ID
	}
	kind := "BUY"
	if add.Sold {
		kind = "SELL"
	}
	activity := map[string]any{
		"accountId":  id,
		"currency":   strings.ToUpper(add.Currency),
		"dataSource": add.DataSource,
		"date":       add.Date + "T00:00:00.000Z",
		"fee":        0,
		"quantity":   add.Shares,
		"symbol":     add.Symbol,
		"type":       kind,
		"unitPrice":  add.Total / add.Shares,
	}
	// /activities since 2.249 (the newest answers there only); /order before.
	err = g.call(ctx, http.MethodPost, "/activities", activity, nil)
	if errors.As(err, new(ghostfolioMissing)) {
		err = g.call(ctx, http.MethodPost, "/order", activity, nil)
	}
	if err != nil {
		return InvestmentsRead{}, err
	}
	if add.NewName != "" {
		p.Accounts = append(p.Accounts, acct)
		if _, err := finance.Save(path, p); err != nil {
			return InvestmentsRead{}, err
		}
	}
	return a.FinancesReadInvestments()
}

// notWordRune is a character that is not part of a name's words.
func notWordRune(r rune) bool {
	return !(r >= 'a' && r <= 'z' || r >= '0' && r <= '9')
}
