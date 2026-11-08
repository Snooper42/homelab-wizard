package ghostfolio_test

import (
	"context"
	"os"
	"path/filepath"
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
