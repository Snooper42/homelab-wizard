package ghostfolio_test

import (
	"context"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/finance"
	"github.com/Snooper42/homelab-wizard/internal/ghostfolio"
	"github.com/Snooper42/homelab-wizard/internal/ghostfolio/ghostfoliotest"
)

// homelab is a homelab folder with a plan of one investment account and
// this .env, its Ghostfolio the fake.
func homelab(t *testing.T, f *ghostfoliotest.Fake, env string) string {
	t.Helper()
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "data"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, ".env"), []byte(env), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := finance.Save(finance.Path(root), finance.Plan{Accounts: []finance.Account{
		{ID: "chk", Name: "Checking", Kind: finance.Checking, Balance: 1000},
		{ID: "brk", Name: "Robinhood", Kind: finance.Investment, Balance: 500},
	}}); err != nil {
		t.Fatal(err)
	}
	saved := ghostfolio.Base
	t.Cleanup(func() { ghostfolio.Base = saved })
	ghostfolio.Base = func(map[string]string) string { return f.Base }
	return root
}

// A buy typed in goes into Ghostfolio's account of the same name, then
// Read now keeps what it holds on the plan; a new account is made in
// Ghostfolio and the plan by one name; a ticker is looked up; what is
// wrong is said before Ghostfolio is asked; a wrong token is refused.
func TestAddThenRead(t *testing.T) {
	f := ghostfoliotest.New(map[string]any{"id": "gf-rh", "name": "Robinhood", "currency": "USD", "balance": 0})
	defer f.Close()
	root := homelab(t, f, "GHOSTFOLIO_SECURITY_TOKEN="+ghostfoliotest.Token+"\n")
	ctx := context.Background()

	found, err := ghostfolio.FindSymbol(ctx, map[string]string{"GHOSTFOLIO_SECURITY_TOKEN": ghostfoliotest.Token}, "VTI")
	if err != nil || len(found) != 1 || found[0].Symbol != "VTI" || found[0].DataSource != "YAHOO" {
		t.Fatalf("FindSymbol: %+v, %v", found, err)
	}
	if none, err := ghostfolio.FindSymbol(ctx, nil, "  "); err != nil || len(none) != 0 {
		t.Errorf("nothing typed: %+v, %v", none, err)
	}

	day := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	buy := ghostfolio.Add{Account: "brk", Symbol: "VTI", DataSource: "YAHOO", Currency: "USD", Shares: 3, Total: 270, Date: day}
	if err := ghostfolio.AddInvestment(ctx, root, buy); err != nil {
		t.Fatal(err)
	}
	if len(f.Activities) != 1 || f.Activities[0].AccountID != "gf-rh" || f.Activities[0].Type != "BUY" || f.Activities[0].UnitPrice != 90 {
		t.Fatalf("sent %+v", f.Activities)
	}
	r, err := ghostfolio.ReadInto(ctx, root)
	if err != nil {
		t.Fatal(err)
	}
	var rh finance.Account
	for _, a := range r.Plan.Accounts {
		if a.ID == "brk" {
			rh = a
		}
	}
	if r.Accounts != 1 || r.Holdings != 1 || len(rh.Holdings) != 1 || rh.Holdings[0].Symbol != "VTI" || rh.Holdings[0].Shares != 3 || rh.Balance != 300 {
		t.Errorf("read %+v, Robinhood %+v", r, rh)
	}
	if p, _ := finance.Load(finance.Path(root)); p.HoldingsRead == "" {
		t.Error("the read was not kept")
	}

	// A new account: made in Ghostfolio, then kept in the plan.
	sale := ghostfolio.Add{NewName: "Fidelity IRA", Symbol: "VTI", DataSource: "YAHOO", Currency: "USD", Shares: 1, Total: 95, Date: day}
	if err := ghostfolio.AddInvestment(ctx, root, sale); err != nil {
		t.Fatal(err)
	}
	if p, _ := finance.Load(finance.Path(root)); len(p.Accounts) != 3 || p.Accounts[2].Name != "Fidelity IRA" || p.Accounts[2].Kind != finance.Investment {
		t.Errorf("new account in the plan: %+v", p.Accounts)
	}
	if got := f.Accounts(); len(got) != 2 || got[1]["name"] != "Fidelity IRA" {
		t.Errorf("new account in Ghostfolio: %+v", got)
	}

	// What is wrong is said before Ghostfolio is asked.
	for _, c := range []struct {
		add  ghostfolio.Add
		want string
	}{
		{ghostfolio.Add{Account: "brk", Shares: 1, Total: 1, Date: day}, "pick what was bought"},
		{ghostfolio.Add{Account: "brk", Symbol: "VTI", DataSource: "YAHOO", Currency: "USD", Shares: 0, Total: 1, Date: day}, "more than 0"},
		{ghostfolio.Add{Account: "brk", Symbol: "VTI", DataSource: "YAHOO", Currency: "USD", Shares: 1, Total: -1, Date: day}, "without a minus"},
		{ghostfolio.Add{Account: "brk", Symbol: "VTI", DataSource: "YAHOO", Currency: "USD", Shares: 1, Total: 1, Date: "soon"}, "no date"},
		{ghostfolio.Add{Account: "brk", Symbol: "VTI", DataSource: "YAHOO", Currency: "USD", Shares: 1, Total: 1, Date: "2999-01-01"}, "still to come"},
		{ghostfolio.Add{Account: "chk", Symbol: "VTI", DataSource: "YAHOO", Currency: "USD", Shares: 1, Total: 1, Date: day}, "not an investment"},
		{ghostfolio.Add{Account: "gone", Symbol: "VTI", DataSource: "YAHOO", Currency: "USD", Shares: 1, Total: 1, Date: day}, "pick the account"},
	} {
		if err := ghostfolio.AddInvestment(ctx, root, c.add); err == nil || !strings.Contains(err.Error(), c.want) {
			t.Errorf("%+v: %v, want %q", c.add, err, c.want)
		}
	}
	if len(f.Activities) != 2 {
		t.Errorf("a refused add reached Ghostfolio: %+v", f.Activities)
	}

	// A wrong token, or none, is said, never with the token, and nothing is kept.
	bad := homelab(t, f, "GHOSTFOLIO_SECURITY_TOKEN=wrong\n")
	if _, err := ghostfolio.ReadInto(ctx, bad); err == nil || !strings.Contains(err.Error(), "refused the security token") || strings.Contains(err.Error(), "wrong") {
		t.Errorf("wrong token: %v", err)
	}
	none := homelab(t, f, "TZ=UTC\n")
	if err := ghostfolio.AddInvestment(ctx, none, buy); err == nil || !strings.Contains(err.Error(), "not set") {
		t.Errorf("no token: %v", err)
	}
}

// An account's worth is what its rows add up to (its holdings and its
// cash), even while Ghostfolio's own figure for the account has not
// caught up with the newest buy.
func TestWorthIsWhatTheRowsAddUpTo(t *testing.T) {
	f := ghostfoliotest.New(map[string]any{"id": "gf-ira", "name": "Roth IRA", "currency": "USD", "balance": 25})
	defer f.Close()
	f.Behind = true
	root := homelab(t, f, "GHOSTFOLIO_SECURITY_TOKEN="+ghostfoliotest.Token+"\n")
	ctx := context.Background()
	day := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	for _, b := range []ghostfolio.Add{
		{NewName: "Roth IRA", Symbol: "VTI", DataSource: "YAHOO", Currency: "USD", Shares: 10, Total: 900, Date: day},
		{Symbol: "BND", DataSource: "YAHOO", Currency: "USD", Shares: 2, Total: 150, Date: day},
	} {
		if b.NewName == "" {
			p, _ := finance.Load(finance.Path(root))
			b.Account = p.Accounts[len(p.Accounts)-1].ID
		}
		if err := ghostfolio.AddInvestment(ctx, root, b); err != nil {
			t.Fatal(err)
		}
	}
	got, err := ghostfolio.Investments(ctx, map[string]string{"GHOSTFOLIO_SECURITY_TOKEN": ghostfoliotest.Token})
	if err != nil || len(got) != 1 {
		t.Fatalf("%+v, %v", got, err)
	}
	// 10 VTI and 2 BND at 100 a share, and 25 in cash: Ghostfolio's own figure still says 1000.
	if got[0].Value != 1225 || len(got[0].Holdings) != 2 {
		t.Errorf("Roth IRA is worth %v with %+v, want 1225", got[0].Value, got[0].Holdings)
	}
}

// A buy or a sale typed wrong is listed under its holding, changed, or
// deleted, in Ghostfolio; one in another account, or a change that makes
// no sense, is refused before Ghostfolio is asked.
func TestChangeAndDeleteATrade(t *testing.T) {
	f := ghostfoliotest.New(
		map[string]any{"id": "gf-rh", "name": "Robinhood", "currency": "USD", "balance": 0},
		map[string]any{"id": "gf-other", "name": "Somewhere else", "currency": "USD", "balance": 0},
	)
	defer f.Close()
	root := homelab(t, f, "GHOSTFOLIO_SECURITY_TOKEN="+ghostfoliotest.Token+"\n")
	ctx := context.Background()
	day := time.Now().AddDate(0, 0, -3).Format("2006-01-02")
	later := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	for _, b := range []ghostfolio.Add{
		{Account: "brk", Symbol: "VTI", DataSource: "YAHOO", Currency: "USD", Shares: 4, Total: 0, Date: day},
		{Account: "brk", Symbol: "VTI", DataSource: "YAHOO", Currency: "USD", Shares: 1, Total: 95, Date: later, Sold: true},
		{Account: "brk", Symbol: "BND", DataSource: "YAHOO", Currency: "USD", Shares: 2, Total: 150, Date: day},
	} {
		if err := ghostfolio.AddInvestment(ctx, root, b); err != nil {
			t.Fatal(err)
		}
	}
	f.Activities = append(f.Activities, ghostfoliotest.Activity{ID: "elsewhere", AccountID: "gf-other", Symbol: "VTI", DataSource: "YAHOO", Currency: "USD", Date: day + "T00:00:00.000Z", Quantity: 1, Type: "BUY", UnitPrice: 50})

	list, err := ghostfolio.Trades(ctx, root, "brk", "vti")
	if err != nil {
		t.Fatal(err)
	}
	want := []ghostfolio.Trade{
		{ID: "act-2", Account: "brk", Symbol: "VTI", DataSource: "YAHOO", Currency: "USD", Shares: 1, Total: 95, Date: later, Sold: true},
		{ID: "act-1", Account: "brk", Symbol: "VTI", DataSource: "YAHOO", Currency: "USD", Shares: 4, Total: 0, Date: day},
	}
	if !reflect.DeepEqual(list, want) {
		t.Fatalf("VTI's trades in Robinhood, newest first:\n got %+v\nwant %+v", list, want)
	}

	// The buy typed with nothing paid: what was paid put right.
	fix := list[1]
	fix.Total, fix.Shares = 360, 4
	if err := ghostfolio.ChangeTrade(ctx, root, fix); err != nil {
		t.Fatal(err)
	}
	if a := f.Activities[0]; a.ID != "act-1" || a.AccountID != "gf-rh" || a.Type != "BUY" || a.Quantity != 4 || a.UnitPrice != 90 || a.Symbol != "VTI" || a.Date != day+"T00:00:00.000Z" {
		t.Errorf("changed to %+v", a)
	}
	r, err := ghostfolio.ReadInto(ctx, root)
	if err != nil {
		t.Fatal(err)
	}
	for _, a := range r.Plan.Accounts {
		if a.ID == "brk" {
			for _, h := range a.Holdings {
				if h.Symbol == "VTI" && h.Paid != 265 {
					t.Errorf("VTI paid %v after the change, want 360 less the 95 sold", h.Paid)
				}
			}
		}
	}

	// What is wrong is said before Ghostfolio is asked.
	for _, c := range []struct {
		t    ghostfolio.Trade
		want string
	}{
		{ghostfolio.Trade{ID: "act-1", Account: "brk", Shares: 0, Total: 1, Date: day}, "more than 0"},
		{ghostfolio.Trade{ID: "act-1", Account: "brk", Shares: 1, Total: -1, Date: day}, "without a minus"},
		{ghostfolio.Trade{ID: "act-1", Account: "brk", Shares: 1, Total: 1, Date: "2999-01-01"}, "still to come"},
		{ghostfolio.Trade{ID: "elsewhere", Account: "brk", Shares: 1, Total: 1, Date: day}, "not in Robinhood"},
		{ghostfolio.Trade{ID: "act-1", Account: "chk", Shares: 1, Total: 1, Date: day}, "not an investment"},
	} {
		if err := ghostfolio.ChangeTrade(ctx, root, c.t); err == nil || !strings.Contains(err.Error(), c.want) {
			t.Errorf("change %+v: %v, want %q", c.t, err, c.want)
		}
	}
	if f.Activities[3].UnitPrice != 50 {
		t.Errorf("another account's buy was changed: %+v", f.Activities[3])
	}

	// Deleted: only from its own account.
	if err := ghostfolio.DeleteTrade(ctx, root, "brk", "elsewhere"); err == nil || !strings.Contains(err.Error(), "not in Robinhood") {
		t.Errorf("delete from another account: %v", err)
	}
	if err := ghostfolio.DeleteTrade(ctx, root, "brk", "act-2"); err != nil {
		t.Fatal(err)
	}
	if list, _ := ghostfolio.Trades(ctx, root, "brk", "VTI"); len(list) != 1 || list[0].ID != "act-1" || len(f.Activities) != 3 {
		t.Errorf("after the delete: %+v, Ghostfolio has %+v", list, f.Activities)
	}
}

// Ghostfolio says nothing went into a holding until it has the symbol's
// prices: what was paid is then read from its buys and sales, a sale
// taking off its shares' part at the average cost.
func TestPaidFromTheBuysWhileUnpriced(t *testing.T) {
	f := ghostfoliotest.New(map[string]any{"id": "gf-rh", "name": "Robinhood", "currency": "USD", "balance": 0})
	defer f.Close()
	f.Unpriced = true
	root := homelab(t, f, "GHOSTFOLIO_SECURITY_TOKEN="+ghostfoliotest.Token+"\n")
	ctx := context.Background()
	day := func(n int) string { return time.Now().AddDate(0, 0, -n).Format("2006-01-02") }
	for _, a := range []ghostfolio.Add{
		{Account: "brk", Symbol: "VOO", DataSource: "YAHOO", Currency: "USD", Shares: 4, Total: 400, Date: day(9)},
		{Account: "brk", Symbol: "VOO", DataSource: "YAHOO", Currency: "USD", Shares: 2, Total: 260, Date: day(5)},
		{Account: "brk", Symbol: "VOO", DataSource: "YAHOO", Currency: "USD", Shares: 3, Total: 390, Date: day(2), Sold: true},
		{Account: "brk", Symbol: "SMH", DataSource: "YAHOO", Currency: "USD", Shares: 5.339, Total: 3203.62, Date: day(3)},
	} {
		if err := ghostfolio.AddInvestment(ctx, root, a); err != nil {
			t.Fatal(err)
		}
	}
	r, err := ghostfolio.ReadInto(ctx, root)
	if err != nil {
		t.Fatal(err)
	}
	paid := map[string]float64{}
	for _, a := range r.Plan.Accounts {
		for _, h := range a.Holdings {
			paid[h.Symbol] = h.Paid
		}
	}
	// VOO: $660 for six, half sold: $330 for the three left.
	if paid["VOO"] != 330 || paid["SMH"] != 3203.62 {
		t.Errorf("paid %v", paid)
	}
	// With no price of its own, a holding is worth only what was paid there: today's price looked up is its worth instead.
	f.Quotes = map[string]float64{"VOO": 602.5}
	f.Gathered = nil
	r, err = ghostfolio.ReadInto(ctx, root)
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]finance.Holding{}
	for _, a := range r.Plan.Accounts {
		for _, h := range a.Holdings {
			got[h.Symbol] = h
		}
	}
	if voo := got["VOO"]; voo.Value != 1807.5 || !voo.Quoted || voo.Paid != 330 {
		t.Errorf("VOO %+v", voo)
	}
	// No quote for SMH: what Ghostfolio says, not marked.
	if smh := got["SMH"]; smh.Value != 3203.62 || smh.Quoted {
		t.Errorf("SMH %+v", smh)
	}
	sort.Strings(f.Gathered)
	if strings.Join(f.Gathered, ",") != "YAHOO/SMH,YAHOO/VOO" {
		t.Errorf("gathered %v", f.Gathered)
	}
}

// held is what a read kept, by account and symbol ("brk/VOO").
func held(r ghostfolio.Read) map[string]finance.Holding {
	out := map[string]finance.Holding{}
	for _, a := range r.Plan.Accounts {
		for _, h := range a.Holdings {
			out[a.ID+"/"+h.Symbol] = h
		}
	}
	return out
}

// Ghostfolio's holdings can count a symbol it has no prices for yet about
// a thousand times over while its buys and sales are right: the count is
// then each account's own buys less its sales, its worth follows from
// it, and the holding says so; one that agrees says nothing.
func TestSharesFromTheBuysWhenGhostfolioCountsWrong(t *testing.T) {
	f := ghostfoliotest.New(map[string]any{"id": "gf-rh", "name": "Robinhood", "currency": "USD", "balance": 0})
	defer f.Close()
	f.Unpriced = true
	root := homelab(t, f, "GHOSTFOLIO_SECURITY_TOKEN="+ghostfoliotest.Token+"\n")
	ctx := context.Background()
	day := func(n int) string { return time.Now().AddDate(0, 0, -n).Format("2006-01-02") }
	for _, a := range []ghostfolio.Add{
		{Account: "brk", Symbol: "VOO", DataSource: "YAHOO", Currency: "USD", Shares: 12.5, Total: 1250, Date: day(3)},
		{Account: "brk", Symbol: "BND", DataSource: "YAHOO", Currency: "USD", Shares: 10, Total: 700, Date: day(3)},
		{Account: "brk", Symbol: "SMH", DataSource: "YAHOO", Currency: "USD", Shares: 8, Total: 800, Date: day(4)},
		{Account: "brk", Symbol: "SMH", DataSource: "YAHOO", Currency: "USD", Shares: 3, Total: 330, Date: day(2), Sold: true},
		{NewName: "Fidelity IRA", Symbol: "VOO", DataSource: "YAHOO", Currency: "USD", Shares: 2, Total: 210, Date: day(3)},
	} {
		if err := ghostfolio.AddInvestment(ctx, root, a); err != nil {
			t.Fatal(err)
		}
	}
	f.Held = map[string]float64{"VOO": 12500, "SMH": 5000}
	f.Quotes = map[string]float64{"VOO": 110}
	r, err := ghostfolio.ReadInto(ctx, root)
	if err != nil {
		t.Fatal(err)
	}
	got := held(r)
	ira := ""
	for _, a := range r.Plan.Accounts {
		if a.Name == "Fidelity IRA" {
			ira = a.ID
		}
	}
	for key, want := range map[string]finance.Holding{
		// Ghostfolio's 12,500 is the one buy of 12.5, worth today's price looked up.
		"brk/VOO": {Shares: 12.5, Paid: 1250, Value: 1375, Quoted: true, Recounted: true},
		// Agrees with its buy: as Ghostfolio says, no line.
		"brk/BND": {Shares: 10, Paid: 700, Value: 700},
		// 8 bought, 3 sold: 5, worth what the 5 cost while there is no price.
		"brk/SMH": {Shares: 5, Paid: 500, Value: 500, Recounted: true},
		// The same symbol in another account: that account's own buy.
		ira + "/VOO": {Shares: 2, Paid: 210, Value: 220, Quoted: true, Recounted: true},
	} {
		h := got[key]
		if h.Shares != want.Shares || h.Paid != want.Paid || h.Value != want.Value || h.Quoted != want.Quoted || h.Recounted != want.Recounted || h.Doubtful {
			t.Errorf("%s: %+v, want %+v", key, h, want)
		}
	}
	for _, a := range r.Plan.Accounts {
		if a.ID == "brk" && a.Balance != 2575 {
			t.Errorf("Robinhood's balance %v, want 2575 (1375 + 700 + 500)", a.Balance)
		}
	}

	// Priced, Ghostfolio's worth of 12,500 shares is scaled to the 12.5 held.
	f.Unpriced = false
	r, err = ghostfolio.ReadInto(ctx, root)
	if err != nil {
		t.Fatal(err)
	}
	if h := held(r)["brk/VOO"]; h.Shares != 12.5 || h.Value != 1250 || h.Quoted || !h.Recounted {
		t.Errorf("priced VOO %+v", h)
	}
}

// When the buys and sales can't be read, Ghostfolio's count is kept, but
// a holding worth over a hundred times what was paid is marked to check.
func TestDoubtfulWhenTheBuysCannotBeRead(t *testing.T) {
	f := ghostfoliotest.New(map[string]any{"id": "gf-rh", "name": "Robinhood", "currency": "USD", "balance": 0})
	defer f.Close()
	root := homelab(t, f, "GHOSTFOLIO_SECURITY_TOKEN="+ghostfoliotest.Token+"\n")
	ctx := context.Background()
	day := time.Now().AddDate(0, 0, -3).Format("2006-01-02")
	for _, a := range []ghostfolio.Add{
		{Account: "brk", Symbol: "VOO", DataSource: "YAHOO", Currency: "USD", Shares: 12.5, Total: 1250, Date: day},
		{Account: "brk", Symbol: "BND", DataSource: "YAHOO", Currency: "USD", Shares: 10, Total: 700, Date: day},
	} {
		if err := ghostfolio.AddInvestment(ctx, root, a); err != nil {
			t.Fatal(err)
		}
	}
	f.Held = map[string]float64{"VOO": 12500}
	f.NoActivities = true
	r, err := ghostfolio.ReadInto(ctx, root)
	if err != nil {
		t.Fatal(err)
	}
	got := held(r)
	if h := got["brk/VOO"]; h.Shares != 12500 || !h.Doubtful || h.Recounted {
		t.Errorf("VOO %+v", h)
	}
	if h := got["brk/BND"]; h.Shares != 10 || h.Doubtful || h.Recounted {
		t.Errorf("BND %+v", h)
	}
}

// The Watchlist (the owner, Nov 12): a ticker followed is priced now and
// kept with the day and price it was followed at; each read prices it
// again (a point a day); one Ghostfolio has no price for is said, and a
// followed one it can't price on a read keeps its last; following it twice
// keeps one.
func TestFollowATickerAndReadItsPrice(t *testing.T) {
	f := ghostfoliotest.New(map[string]any{"id": "gf-rh", "name": "Robinhood", "currency": "USD", "balance": 0})
	defer f.Close()
	root := homelab(t, f, "GHOSTFOLIO_SECURITY_TOKEN="+ghostfoliotest.Token+"\n")
	ctx := context.Background()
	f.Quotes = map[string]float64{"GLBX": 48.12}

	p, err := ghostfolio.FollowInto(ctx, root, ghostfolio.Symbol{Symbol: "GLBX", Name: "Globex Energy", Currency: "USD", DataSource: "YAHOO"})
	if err != nil || len(p.Watch) != 1 {
		t.Fatalf("FollowInto: %+v, %v", p.Watch, err)
	}
	today := time.Now().Format("2006-01-02")
	w := p.Watch[0]
	if w.Symbol != "GLBX" || w.Name != "Globex Energy" || w.Since != today || w.From != 48.12 || w.Price != 48.12 || len(w.History) != 1 {
		t.Errorf("followed: %+v", w)
	}
	if again, err := ghostfolio.FollowInto(ctx, root, ghostfolio.Symbol{Symbol: "glbx", DataSource: "YAHOO"}); err != nil || len(again.Watch) != 1 {
		t.Errorf("followed twice: %+v, %v", again.Watch, err)
	}
	if _, err := ghostfolio.FollowInto(ctx, root, ghostfolio.Symbol{Symbol: "NOPE", DataSource: "YAHOO"}); err == nil || !strings.Contains(err.Error(), "no price") {
		t.Errorf("one with no price: %v", err)
	}

	// A read prices it again: today's point replaced, its price now.
	f.Quotes["GLBX"] = 50.5
	r, err := ghostfolio.ReadInto(ctx, root)
	if err != nil || len(r.Plan.Watch) != 1 || r.Plan.Watch[0].Price != 50.5 || r.Plan.Watch[0].From != 48.12 || len(r.Plan.Watch[0].History) != 1 || r.Plan.Watch[0].History[0].Amount != 50.5 {
		t.Fatalf("read: %+v, %v", r.Plan.Watch, err)
	}
	// Ghostfolio has no price on a read: its last is kept.
	delete(f.Quotes, "GLBX")
	if r, err = ghostfolio.ReadInto(ctx, root); err != nil || r.Plan.Watch[0].Price != 50.5 {
		t.Errorf("no price on a read: %+v, %v", r.Plan.Watch, err)
	}
}
