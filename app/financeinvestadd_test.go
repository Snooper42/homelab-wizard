package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/finance"
)

// ghostfolioWriter is a fake Ghostfolio that keeps what is added to it: its
// accounts (one, "Fidelity 401(k)", to start), and each activity posted.
// old answers activities only at /order (before 2.249); refuse turns an
// activity down as Ghostfolio's validation does.
type ghostfolioWriter struct {
	mu         sync.Mutex
	accounts   []map[string]any
	activities []map[string]any
	old        bool
	refuse     string
}

func (g *ghostfolioWriter) server(t *testing.T) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		g.mu.Lock()
		defer g.mu.Unlock()
		if r.URL.Path == "/api/v1/auth/anonymous" {
			_, _ = w.Write([]byte(`{"authToken":"jwt"}`))
			return
		}
		if r.Header.Get("Authorization") != "Bearer jwt" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		body := map[string]any{}
		if r.Method == http.MethodPost {
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
		}
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/symbol/lookup":
			if q := r.URL.Query().Get("query"); q != "vti" {
				_, _ = w.Write([]byte(`{"items":[]}`))
				return
			}
			_, _ = w.Write([]byte(`{"items":[
				{"symbol":"VTI","name":"Vanguard Total Stock Market Index Fund ETF Shares","currency":"USD","dataSource":"YAHOO","assetClass":"EQUITY"},
				{"symbol":"VTIAX","name":"Vanguard Total International Stock Index Fund Admiral Shares","currency":"USD","dataSource":"YAHOO"},
				{"symbol":"","name":"nothing","currency":"USD","dataSource":"YAHOO"}]}`))
		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/account":
			list := []map[string]any{}
			list = append(list, g.accounts...)
			_ = json.NewEncoder(w).Encode(map[string]any{"accounts": list})
		case r.Method == http.MethodPost && r.URL.Path == "/api/v1/account":
			if body["platformId"] != nil || body["name"] == "" || body["currency"] == "" {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			body["id"] = "new-id"
			g.accounts = append(g.accounts, body)
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(body)
		case r.Method == http.MethodPost && (r.URL.Path == "/api/v1/activities" && !g.old || r.URL.Path == "/api/v1/order" && g.old):
			if g.refuse != "" {
				w.WriteHeader(http.StatusBadRequest)
				_, _ = w.Write([]byte(`{"message":["` + g.refuse + `"],"error":"Bad Request","statusCode":400}`))
				return
			}
			g.activities = append(g.activities, body)
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"id":"a1"}`))
		case r.URL.Path == "/api/v1/portfolio/holdings":
			_, _ = w.Write([]byte(`{"holdings":[]}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

// A ticker looked up through Ghostfolio: its matches, each with its name,
// currency, and where Ghostfolio prices it; one with no symbol left out.
func TestFinancesFindSymbol(t *testing.T) {
	a, _ := testApp(t)
	saved := ghostfolioBase
	t.Cleanup(func() { ghostfolioBase = saved })
	g := &ghostfolioWriter{}
	srv := g.server(t)
	defer srv.Close()
	ghostfolioBase = func(map[string]string) string { return srv.URL + "/api/v1" }
	if err := os.WriteFile(filepath.Join(a.root, ".env"), []byte("TZ=UTC\nGHOSTFOLIO_SECURITY_TOKEN=good\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	got, err := a.FinancesFindSymbol(" VTI ")
	if err != nil || len(got) != 2 || got[0] != (AppSymbol{Symbol: "VTI", Name: "Vanguard Total Stock Market Index Fund ETF Shares", Currency: "USD", DataSource: "YAHOO"}) {
		t.Fatalf("VTI: %+v, %v", got, err)
	}
	if got, err := a.FinancesFindSymbol("  "); err != nil || len(got) != 0 {
		t.Errorf("nothing typed: %+v, %v", got, err)
	}
	srv.Close()
	if _, err := a.FinancesFindSymbol("vti"); err == nil || !strings.Contains(err.Error(), "does not answer") {
		t.Errorf("no answer: %v", err)
	}
}

// Adding from Finances: a buy goes into the Ghostfolio account of the
// account's name, made there first when it has none (with no platform, in
// the account's currency); a new account is made in both places with one
// name, so they always match; a sale is a SELL. Each activity's price is
// what was paid over the shares, on the day given. Before 2.249 it is sent
// to /order. A buy Ghostfolio turns down says why, and nothing is added to
// the plan.
func TestFinancesAddInvestment(t *testing.T) {
	a, _ := testApp(t)
	saved := ghostfolioBase
	t.Cleanup(func() { ghostfolioBase = saved })
	g := &ghostfolioWriter{accounts: []map[string]any{{"id": "fid", "name": "Fidelity 401(k)", "currency": "USD", "balance": 0}}}
	srv := g.server(t)
	defer srv.Close()
	ghostfolioBase = func(map[string]string) string { return srv.URL + "/api/v1" }
	if err := os.WriteFile(filepath.Join(a.root, ".env"), []byte("TZ=UTC\nGHOSTFOLIO_SECURITY_TOKEN=good\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	path := finance.Path(a.root)
	if _, err := finance.Save(path, finance.Plan{Accounts: []finance.Account{
		{ID: "chk", Name: "Checking", Kind: "checking", Balance: 900},
		{ID: "k401", Name: "Fidelity 401(k)", Kind: "retirement", Balance: 30000},
		{ID: "roth", Name: "Roth IRA", Kind: "retirement", Balance: 14000, Currency: "EUR"},
	}, Rates: map[string]float64{"EUR": 1.08}}); err != nil {
		t.Fatal(err)
	}
	vti := InvestmentAdd{Account: "k401", Symbol: "VTI", DataSource: "YAHOO", Currency: "USD", Shares: 92.4, Total: 18210, Date: "2024-03-15"}

	// Into an account Ghostfolio has: one buy, at what was paid a share.
	if _, err := a.FinancesAddInvestment(vti); err != nil {
		t.Fatal(err)
	}
	if len(g.accounts) != 1 || len(g.activities) != 1 {
		t.Fatalf("accounts %v, activities %v", g.accounts, g.activities)
	}
	buy := g.activities[0]
	if buy["accountId"] != "fid" || buy["type"] != "BUY" || buy["symbol"] != "VTI" || buy["dataSource"] != "YAHOO" || buy["currency"] != "USD" ||
		buy["quantity"] != 92.4 || buy["fee"] != 0.0 || buy["date"] != "2024-03-15T00:00:00.000Z" || int(buy["unitPrice"].(float64)*100+0.5) != 19708 {
		t.Errorf("the buy: %v", buy)
	}

	// Into one Ghostfolio has no account for yet: made there, in its currency.
	sap := InvestmentAdd{Account: "roth", Symbol: "SAP.DE", DataSource: "YAHOO", Currency: "EUR", Shares: 5, Total: 800, Date: "2025-01-02"}
	if _, err := a.FinancesAddInvestment(sap); err != nil {
		t.Fatal(err)
	}
	if len(g.accounts) != 2 || g.accounts[1]["name"] != "Roth IRA" || g.accounts[1]["currency"] != "EUR" || g.accounts[1]["balance"] != 0.0 || g.activities[1]["accountId"] != "new-id" {
		t.Errorf("Roth IRA made in Ghostfolio: %v, %v", g.accounts, g.activities)
	}

	// A new account, made in Finances and Ghostfolio by one name; a sale; an older Ghostfolio.
	g.old = true
	sold := InvestmentAdd{NewName: " Robinhood ", Symbol: "AAPL", DataSource: "YAHOO", Currency: "USD", Shares: 2, Total: 450, Date: "2026-11-02", Sold: true}
	got, err := a.FinancesAddInvestment(sold)
	if err != nil {
		t.Fatal(err)
	}
	if len(g.activities) != 3 || g.activities[2]["type"] != "SELL" || g.accounts[2]["name"] != "Robinhood" {
		t.Errorf("a sale into a new account: %v, %v", g.accounts, g.activities)
	}
	plan, _ := finance.Load(path)
	if n := len(plan.Accounts); n != 4 || plan.Accounts[3].Name != "Robinhood" || plan.Accounts[3].Kind != "investment" || got.View.Plan.Accounts[3].Name != "Robinhood" {
		t.Errorf("Robinhood not added to the plan: %+v", plan.Accounts)
	}

	// Turned down: said in Ghostfolio's words; the new account is not kept.
	g.old, g.refuse = false, "Could not find a price for the asset XYZQ"
	if _, err := a.FinancesAddInvestment(InvestmentAdd{NewName: "Vanguard", Symbol: "XYZQ", DataSource: "YAHOO", Currency: "USD", Shares: 1, Total: 1, Date: "2026-11-01"}); err == nil || !strings.Contains(err.Error(), "Ghostfolio did not take it: Could not find a price for the asset XYZQ") {
		t.Errorf("turned down: %v", err)
	}
	if plan, _ := finance.Load(path); len(plan.Accounts) != 4 {
		t.Errorf("an account kept for a buy turned down: %+v", plan.Accounts)
	}

	// What is typed is checked before Ghostfolio is asked.
	g.refuse = ""
	before := len(g.activities)
	for _, bad := range []InvestmentAdd{
		{Account: "k401", Symbol: " ", DataSource: "YAHOO", Currency: "USD", Shares: 1, Total: 1, Date: "2026-11-01"},
		{Account: "k401", Symbol: "VTI", DataSource: "YAHOO", Currency: "USD", Shares: 0, Total: 1, Date: "2026-11-01"},
		{Account: "k401", Symbol: "VTI", DataSource: "YAHOO", Currency: "USD", Shares: 1, Total: -1, Date: "2026-11-01"},
		{Account: "k401", Symbol: "VTI", DataSource: "YAHOO", Currency: "USD", Shares: 1, Total: 1, Date: "next week"},
		{Account: "k401", Symbol: "VTI", DataSource: "YAHOO", Currency: "USD", Shares: 1, Total: 1, Date: "2999-01-01"},
		{Account: "chk", Symbol: "VTI", DataSource: "YAHOO", Currency: "USD", Shares: 1, Total: 1, Date: "2026-11-01"},
		{Account: "nope", Symbol: "VTI", DataSource: "YAHOO", Currency: "USD", Shares: 1, Total: 1, Date: "2026-11-01"},
		{Symbol: "VTI", DataSource: "YAHOO", Currency: "USD", Shares: 1, Total: 1, Date: "2026-11-01"},
	} {
		if _, err := a.FinancesAddInvestment(bad); err == nil {
			t.Errorf("took %+v", bad)
		}
	}
	if len(g.activities) != before {
		t.Errorf("Ghostfolio asked with what was typed wrong: %v", g.activities[before:])
	}
}
