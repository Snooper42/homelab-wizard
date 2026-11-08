package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/finance"
	"github.com/Snooper42/homelab-wizard/internal/ghostfolio"
)

// ghostfolioHoldings is a fake Ghostfolio: two accounts, one in euros, each
// read for its holdings alone; shape picks what it answers as: "new"
// (2.249 on: each holding's name and symbol under assetProfile), "old"
// (before: on the holding itself), or "oldest" (no holdings address yet,
// only details, its holdings by symbol).
func ghostfolioHoldings(t *testing.T, shape *string, holdingsStatus *int) *httptest.Server {
	t.Helper()
	held := map[string][]map[string]any{
		"u1": {
			{"symbol": "VXUS", "name": "Vanguard Total International", "quantity": 120, "investment": 6950, "valueInBaseCurrency": 4460.25},
			{"symbol": "VTI", "name": "Vanguard Total Stock Market", "quantity": 92.4, "investment": 18210, "valueInBaseCurrency": 26420.004},
			{"symbol": "GME", "name": "GameStop", "quantity": 0, "investment": 0, "valueInBaseCurrency": 0},
			{"symbol": "USD", "name": "US Dollar", "assetClass": "LIQUIDITY", "assetSubClass": "CASH", "quantity": 120.5, "investment": 120.5, "valueInBaseCurrency": 120.5},
		},
		"u2": {
			{"symbol": "SAP.DE", "name": "SAP", "quantity": "5", "investment": "800", "valueInBaseCurrency": "1000"},
			{"symbol": "NEW", "name": "Not priced yet", "quantity": 1, "investment": 10, "marketPrice": 12},
		},
	}
	shaped := func(list []map[string]any) []map[string]any {
		out := []map[string]any{}
		for _, h := range list {
			x := map[string]any{}
			for k, v := range h {
				x[k] = v
			}
			if *shape == "new" {
				x["assetProfile"] = map[string]any{"symbol": x["symbol"], "name": x["name"], "assetSubClass": x["assetSubClass"], "currency": "USD"}
				delete(x, "symbol")
				delete(x, "name")
				delete(x, "assetSubClass")
			}
			out = append(out, x)
		}
		return out
	}
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v1/auth/anonymous" {
			var b struct {
				AccessToken string `json:"accessToken"`
			}
			_ = json.NewDecoder(r.Body).Decode(&b)
			if b.AccessToken != "good" {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			_, _ = w.Write([]byte(`{"authToken":"jwt"}`))
			return
		}
		if r.Header.Get("Authorization") != "Bearer jwt" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		id := r.URL.Query().Get("accounts")
		switch {
		case r.URL.Path == "/api/v1/account":
			_, _ = w.Write([]byte(`{"accounts":[
				{"id":"u1","name":"Fidelity 401(k)","balance":120.5,"balanceInBaseCurrency":120.5,"value":31000.75,"valueInBaseCurrency":31000.75,"currency":"usd"},
				{"id":"u2","name":"Trading 212","balance":0,"value":"1115.04","valueInBaseCurrency":"1212","currency":"EUR"},
				{"id":"u3","name":" ","balance":5,"value":5,"currency":"USD"}]}`))
		case r.URL.Path == "/api/v1/portfolio/holdings" && *shape != "oldest":
			if *holdingsStatus != 0 {
				w.WriteHeader(*holdingsStatus)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"holdings": shaped(held[id])})
		case r.URL.Path == "/api/v1/portfolio/details" && *shape == "oldest":
			bySymbol := map[string]any{}
			for _, h := range shaped(held[id]) {
				bySymbol[h["symbol"].(string)] = h
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"accounts": map[string]any{}, "holdings": bySymbol, "hasError": false})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

// Each of Ghostfolio's accounts read for its holdings, as each of its
// versions answers: what each holds, what went in, and what it is worth,
// in the account's own currency, the largest first; cash, and a holding
// sold, left out; an account with no name passed over.
func TestGhostfolioInvestments(t *testing.T) {
	a, _ := testApp(t)
	saved := ghostfolio.Base
	t.Cleanup(func() { ghostfolio.Base = saved })
	shape, status := "new", 0
	srv := ghostfolioHoldings(t, &shape, &status)
	defer srv.Close()
	ghostfolio.Base = func(map[string]string) string { return srv.URL + "/api/v1" }
	if err := os.WriteFile(filepath.Join(a.root, ".env"), []byte("TZ=UTC\nGHOSTFOLIO_SECURITY_TOKEN=good\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	want := []finance.Invested{
		{Name: "Fidelity 401(k)", Value: 31000.75, Currency: "USD", Holdings: []finance.Holding{
			{Symbol: "VTI", Name: "Vanguard Total Stock Market", Shares: 92.4, Paid: 18210, Value: 26420},
			{Symbol: "VXUS", Name: "Vanguard Total International", Shares: 120, Paid: 6950, Value: 4460.25},
		}},
		// Ghostfolio's base is dollars; the account's own figure is in euros, 1115.04 for 1212.
		{Name: "Trading 212", Value: 1115.04, Currency: "EUR", Holdings: []finance.Holding{
			{Symbol: "SAP.DE", Name: "SAP", Shares: 5, Paid: 736, Value: 920},
			{Symbol: "NEW", Name: "Not priced yet", Shares: 1, Paid: 9.2, Value: 11.04},
		}},
	}
	for _, s := range []string{"new", "old", "oldest"} {
		shape = s
		got, err := ghostfolio.Investments(context.Background(), core.Env(a.root))
		if err != nil || !reflect.DeepEqual(got, want) {
			t.Errorf("%s: %+v, %v", s, got, err)
		}
	}
	shape, status = "new", http.StatusUnauthorized
	if _, err := ghostfolio.Investments(context.Background(), core.Env(a.root)); err == nil || !strings.Contains(err.Error(), "refused the security token") {
		t.Errorf("holdings refused: %v", err)
	}
	status = http.StatusInternalServerError
	if _, err := ghostfolio.Investments(context.Background(), core.Env(a.root)); err == nil || !strings.Contains(err.Error(), "Ghostfolio answered 500") {
		t.Errorf("holdings failing: %v", err)
	}
}

// Read now: what Ghostfolio holds kept on the plan's accounts and saved,
// the accounts nothing matched said back; when it fails, the plan is as
// it was, and why is said, never with the token.
func TestFinancesReadInvestments(t *testing.T) {
	a, _ := testApp(t)
	saved := ghostfolio.Base
	t.Cleanup(func() { ghostfolio.Base = saved })
	shape, status := "new", 0
	srv := ghostfolioHoldings(t, &shape, &status)
	defer srv.Close()
	ghostfolio.Base = func(map[string]string) string { return srv.URL + "/api/v1" }
	env := func(s string) {
		if err := os.WriteFile(filepath.Join(a.root, ".env"), []byte(s), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	path := finance.Path(a.root)
	if _, err := finance.Save(path, finance.Plan{Accounts: []finance.Account{{Name: "Checking", Kind: "checking", Balance: 900}, {Name: "Fidelity 401(k)", Kind: "retirement", Balance: 30000}}}); err != nil {
		t.Fatal(err)
	}
	before, _ := os.ReadFile(path)
	env("TZ=UTC\nGHOSTFOLIO_SECURITY_TOKEN=bad\n")
	if _, err := a.FinancesReadInvestments(); err == nil || !strings.Contains(err.Error(), "refused the security token") || strings.Contains(err.Error(), "bad") {
		t.Errorf("a refused token: %v", err)
	}
	if after, _ := os.ReadFile(path); string(after) != string(before) {
		t.Errorf("a failed read changed the plan:\n%s", after)
	}
	env("TZ=UTC\nGHOSTFOLIO_SECURITY_TOKEN=good\n")
	got, err := a.FinancesReadInvestments()
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(got.Unmatched, ",") != "Trading 212" {
		t.Errorf("not matched: %q", got.Unmatched)
	}
	// What Ghostfolio has, matched or not, so Read now can say the token worked even with nothing in it yet.
	if got.Accounts != 2 || got.Holdings != 4 {
		t.Errorf("Ghostfolio has %d accounts and %d holdings, want 2 and 4", got.Accounts, got.Holdings)
	}
	k := got.View.Plan.Accounts[1]
	if k.Balance != 31000.75 || len(k.Holdings) != 2 || k.Holdings[0].Symbol != "VTI" || got.View.Plan.HoldingsRead == "" {
		t.Errorf("the 401(k): %+v", k)
	}
	back, err := finance.Load(path)
	if err != nil || len(back.Accounts[1].Holdings) != 2 || back.Rev != got.View.Plan.Rev {
		t.Errorf("not kept: %+v, %v", back.Accounts[1], err)
	}
	srv.Close()
	if _, err := a.FinancesReadInvestments(); err == nil || !strings.Contains(err.Error(), "does not answer") {
		t.Errorf("no answer: %v", err)
	}
}
