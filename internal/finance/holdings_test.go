package finance

import (
	"math"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// investing is a household with a 401(k), a Roth IRA kept by hand under
// another name in Ghostfolio, a brokerage account, and checking.
func investing() Plan {
	return Plan{
		Accounts: []Account{
			{ID: "checking", Name: "Checking", Kind: Checking, Balance: 2400},
			{ID: "k", Name: "Fidelity 401(k)", Kind: Retirement, Balance: 30000, Updated: "2026-11-01"},
			{ID: "roth", Name: "Roth IRA", Kind: Retirement, Balance: 14000, Ghostfolio: "Vanguard IRA"},
			{ID: "broker", Name: "Robinhood", Kind: Investment, Balance: 9000,
				Holdings: []Holding{
					{Symbol: "AAPL", Name: "Apple", Shares: 10, Paid: 1500, Value: 2200, History: []Point{{"2026-11-02", 2100}}},
					{Symbol: "TSLA", Name: "Tesla", Shares: 2, Paid: 400, Value: 500},
				}},
			{ID: "euro", Name: "Trading 212", Kind: Investment, Currency: "EUR", Balance: 100},
		},
		Rates: map[string]float64{"EUR": 1.08},
	}
}

// What Ghostfolio read is kept on the account it matches: by the name
// picked by hand first, then the same name, then one inside the other;
// its worth becomes the balance, today's, each holding remembers its worth
// on each day it was read, one sold is gone, and an account Ghostfolio no
// longer has keeps its balance but not its holdings. One in another
// currency, or matching nothing, is said back, never guessed.
func TestTakeHoldings(t *testing.T) {
	now := time.Date(2026, 11, 7, 7, 2, 0, 0, time.Local)
	found := []Invested{
		{Name: "Fidelity 401(k)", Value: 31000.5, Currency: "USD", Holdings: []Holding{
			{Symbol: "vti", Name: "Vanguard Total Stock Market", Shares: 92.4, Paid: 18210, Value: 26420.004},
			{Symbol: "VXUS", Name: "Vanguard Total International", Shares: 120, Paid: 6950, Value: 4580.5},
		}},
		{Name: "Vanguard IRA", Value: 14650, Holdings: []Holding{{Symbol: "BND", Shares: 140, Paid: 10480, Value: 10150}, {Symbol: "VOO", Shares: 8, Paid: 3620, Value: 4450}}},
		{Name: "My Robinhood", Value: 9300, Currency: "USD", Holdings: []Holding{{Symbol: "AAPL", Name: "Apple", Shares: 10, Paid: 1500, Value: 2400}}},
		{Name: "Trading 212", Value: 2100, Currency: "USD"},
		{Name: "Coinbase", Value: 50, Currency: "USD"},
	}
	p := investing()
	p.Accounts[4].Holdings = []Holding{{Symbol: "SAP", Shares: 1, Value: 100}}
	got, left := TakeHoldings(p, found, now)
	if strings.Join(left, ", ") != "Trading 212, Coinbase" {
		t.Errorf("not matched: %q", left)
	}
	if got.HoldingsRead != now.Format(time.RFC3339) {
		t.Errorf("read at %q", got.HoldingsRead)
	}
	k := got.Accounts[1]
	if k.Balance != 31000.5 || k.Updated != "2026-11-07" || len(k.Holdings) != 2 || k.Holdings[0].Symbol != "VTI" || k.Holdings[0].Value != 26420 {
		t.Errorf("the 401(k): %+v", k)
	}
	if h := k.Holdings[0].History; len(h) != 1 || h[0] != (Point{"2026-11-07", 26420}) {
		t.Errorf("VTI's history: %+v", h)
	}
	if roth := got.Accounts[2]; roth.Balance != 14650 || len(roth.Holdings) != 2 || roth.Ghostfolio != "Vanguard IRA" {
		t.Errorf("matched by hand: %+v", roth)
	}
	b := got.Accounts[3]
	if b.Balance != 9300 || len(b.Holdings) != 1 || b.Holdings[0].Symbol != "AAPL" {
		t.Errorf("one name inside the other, Tesla sold: %+v", b)
	}
	if h := b.Holdings[0].History; len(h) != 2 || h[0] != (Point{"2026-11-02", 2100}) || h[1] != (Point{"2026-11-07", 2400}) {
		t.Errorf("Apple's history: %+v", h)
	}
	if e := got.Accounts[4]; e.Balance != 100 || e.Holdings != nil {
		t.Errorf("an account in euros, read in dollars: %+v", e)
	}
	if c := got.Accounts[0]; c.Balance != 2400 || c.Updated != "" {
		t.Errorf("checking is never matched: %+v", c)
	}
	// The plan given is left as it was.
	if p.Accounts[3].Balance != 9000 || len(p.Accounts[3].Holdings) != 2 || p.HoldingsRead != "" {
		t.Errorf("the plan given changed: %+v", p.Accounts[3])
	}
	// Read again the same day: that day's worth replaces the last, and
	// Clean keeps the balance's own history for This month.
	found[2].Holdings[0].Value = 2450
	again, _ := TakeHoldings(got, found, now.Add(time.Hour))
	if h := again.Accounts[3].Holdings[0].History; len(h) != 2 || h[1].Amount != 2450 {
		t.Errorf("read twice in a day: %+v", h)
	}
	cleaned, err := Clean(again)
	if err != nil {
		t.Fatal(err)
	}
	if h := cleaned.Accounts[1].History; len(h) == 0 || h[len(h)-1] != (Point{"2026-11-07", 31000.5}) {
		t.Errorf("the 401(k)'s balance by day: %+v", h)
	}
}

// Holdings are tidied as the plan is kept: symbols in capitals, one with
// none or with no number for its worth refused, its days in order; a time
// read that is no time refused.
func TestCleanHoldings(t *testing.T) {
	p := investing()
	p.Accounts[3].Holdings[0] = Holding{Symbol: " aapl ", Name: " Apple ", Shares: 10, Paid: 1500, Value: 2200, History: []Point{{"2026-11-05", 3}, {"2026-11-02", 2}}}
	p.HoldingsRead = "2026-11-07T07:02:00-05:00"
	c, err := Clean(p)
	if err != nil {
		t.Fatal(err)
	}
	h := c.Accounts[3].Holdings[0]
	if h.Symbol != "AAPL" || h.Name != "Apple" || h.History[0].Date != "2026-11-02" {
		t.Errorf("tidied: %+v", h)
	}
	for _, bad := range []func(*Plan){
		func(p *Plan) { p.Accounts[3].Holdings[0].Symbol = " " },
		func(p *Plan) { p.Accounts[3].Holdings[0].Value = math.NaN() },
		func(p *Plan) { p.Accounts[3].Holdings[0].Shares = -1 },
		func(p *Plan) { p.HoldingsRead = "this morning" },
	} {
		q := investing()
		bad(&q)
		if _, err := Clean(q); err == nil {
			t.Errorf("kept %+v", q.Accounts[3].Holdings)
		}
	}
}

// An older file, without holdings or when they were read, loads and
// saves as before; one saved with them reads them back.
func TestHoldingsOlderFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "finance.json")
	if err := os.WriteFile(path, []byte(`{"people":[],"accounts":[{"id":"k","name":"401(k)","kind":"retirement","balance":30000}],"payments":[]}`), 0o600); err != nil {
		t.Fatal(err)
	}
	p, err := Load(path)
	if err != nil || p.HoldingsRead != "" || p.ReadByHand || p.Accounts[0].Holdings != nil || p.Accounts[0].Ghostfolio != "" {
		t.Fatalf("an older file: %+v, %v", p, err)
	}
	saved, err := Save(path, p)
	if err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(path)
	for _, k := range []string{"holdings", "ghostfolio", "readByHand"} {
		if strings.Contains(string(data), k) {
			t.Errorf("saved %s it never had:\n%s", k, data)
		}
	}
	saved, _ = TakeHoldings(saved, []Invested{{Name: "401(k)", Value: 31000, Holdings: []Holding{{Symbol: "VTI", Shares: 1, Paid: 1, Value: 31000}}}}, time.Date(2026, 11, 7, 7, 0, 0, 0, time.UTC))
	saved.ReadByHand = true
	if _, err := Save(path, saved); err != nil {
		t.Fatal(err)
	}
	back, err := Load(path)
	if err != nil || !back.ReadByHand || back.HoldingsRead == "" || len(back.Accounts[0].Holdings) != 1 || back.Accounts[0].Holdings[0].History[0].Amount != 31000 {
		t.Fatalf("read back: %+v, %v", back, err)
	}
}

// A Ghostfolio account set up but with nothing in it yet (no holdings, no
// cash) never puts $0 over the balance typed in here, nor its day: it is
// matched, but its balance and history are left as they were. One with
// cash only is worth its cash.
func TestTakeHoldingsEmptyAccountKeepsBalance(t *testing.T) {
	p := investing()
	now := time.Date(2026, 11, 8, 9, 0, 0, 0, time.UTC)
	got, left := TakeHoldings(p, []Invested{
		{Name: "Fidelity 401(k)", Value: 0, Currency: "USD", Holdings: []Holding{}},
		{Name: "Vanguard IRA", Value: 0},
		{Name: "Robinhood", Value: 250, Holdings: []Holding{}},
	}, now)
	if len(left) != 0 {
		t.Errorf("not matched: %q", left)
	}
	if k := got.Accounts[1]; k.Balance != 30000 || k.Updated != "2026-11-01" || k.Holdings != nil {
		t.Errorf("an empty Ghostfolio account changed the 401(k): %+v", k)
	}
	if r := got.Accounts[2]; r.Balance != 14000 {
		t.Errorf("an empty Ghostfolio account changed the Roth IRA: %+v", r)
	}
	if b := got.Accounts[3]; b.Balance != 250 || b.Updated != "2026-11-08" || b.Holdings == nil || len(b.Holdings) != 0 {
		t.Errorf("cash only, sold out of Apple and Tesla: %+v", b)
	}
	cleaned, err := Clean(got)
	if err != nil {
		t.Fatal(err)
	}
	for _, pt := range cleaned.Accounts[1].History {
		if pt.Amount == 0 {
			t.Errorf("a $0 day kept in the 401(k)'s history: %+v", cleaned.Accounts[1].History)
		}
	}
}
