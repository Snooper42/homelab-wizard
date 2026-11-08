package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/finance"
)

// Finances › Net worth › Investments: each of Ghostfolio's accounts read
// for what it holds, on this machine (127.0.0.1) only. Ghostfolio is
// AGPL-3.0: this calls its API and copies none of its code. It looks
// prices up by symbol itself; no amount or account leaves the homelab.

var (
	errGhostfolioRefused = errors.New("Ghostfolio refused the security token: put the one you sign in with in Settings › GHOSTFOLIO_SECURITY_TOKEN")
	errGhostfolioQuiet   = errors.New("Ghostfolio does not answer on this machine: is it running? (Status)")
	errGhostfolioUnread  = errors.New("Ghostfolio's answer could not be read: is GHOSTFOLIO_PORT Ghostfolio's port?")
)

// ghostfolioMissing is an address this Ghostfolio does not have (an older one).
type ghostfolioMissing struct{ status string }

func (e ghostfolioMissing) Error() string { return "Ghostfolio answered " + e.status }

// ghostfolio is a session signed in to Ghostfolio's API.
type ghostfolio struct{ base, session string }

// ghostfolioSignIn signs in with the household's security token
// (GHOSTFOLIO_SECURITY_TOKEN), for a session's token.
func ghostfolioSignIn(ctx context.Context, env map[string]string) (ghostfolio, error) {
	token := strings.TrimSpace(env["GHOSTFOLIO_SECURITY_TOKEN"])
	if token == "" {
		return ghostfolio{}, errors.New("Ghostfolio's security token is not set: put the one you sign in to Ghostfolio with in Settings › GHOSTFOLIO_SECURITY_TOKEN")
	}
	g := ghostfolio{base: ghostfolioBase(env)}
	body, _ := json.Marshal(map[string]string{"accessToken": token})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, g.base+"/auth/anonymous", bytes.NewReader(body))
	if err != nil {
		return g, errors.New("Ghostfolio's address could not be made from GHOSTFOLIO_PORT")
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return g, errGhostfolioQuiet
	}
	var auth struct {
		AuthToken string `json:"authToken"`
	}
	err = json.NewDecoder(res.Body).Decode(&auth)
	res.Body.Close()
	switch {
	case res.StatusCode == http.StatusUnauthorized || res.StatusCode == http.StatusForbidden:
		return g, errGhostfolioRefused
	case res.StatusCode >= 300:
		return g, fmt.Errorf("Ghostfolio answered %s", res.Status)
	case err != nil || auth.AuthToken == "":
		return g, errGhostfolioUnread
	}
	g.session = auth.AuthToken
	return g, nil
}

// read GETs one of the API's addresses (path and query) into v.
func (g ghostfolio) read(ctx context.Context, path string, v any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, g.base+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+g.session)
	req.Header.Set("Accept", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return errGhostfolioQuiet
	}
	defer res.Body.Close()
	switch {
	case res.StatusCode == http.StatusUnauthorized || res.StatusCode == http.StatusForbidden:
		return errGhostfolioRefused
	case res.StatusCode == http.StatusNotFound:
		return ghostfolioMissing{res.Status}
	case res.StatusCode != http.StatusOK:
		return fmt.Errorf("Ghostfolio answered %s", res.Status)
	}
	if err := json.NewDecoder(res.Body).Decode(v); err != nil {
		return errGhostfolioUnread
	}
	return nil
}

// gfHolding is a holding as Ghostfolio answers: its symbol, name, and kind
// on it (before 2.249) or under assetProfile (since); its numbers in the
// user's base currency, its worth missing while it has no price yet.
type gfHolding struct {
	Symbol        string `json:"symbol"`
	Name          string `json:"name"`
	AssetSubClass string `json:"assetSubClass"`
	AssetProfile  *struct {
		Symbol        string `json:"symbol"`
		Name          string `json:"name"`
		AssetSubClass string `json:"assetSubClass"`
	} `json:"assetProfile"`
	Quantity            flexNum  `json:"quantity"`
	Investment          flexNum  `json:"investment"`
	MarketPrice         flexNum  `json:"marketPrice"`
	ValueInBaseCurrency *flexNum `json:"valueInBaseCurrency"`
}

// gfHoldings is a list of holdings, or (details, in older versions) one by symbol.
type gfHoldings []gfHolding

func (h *gfHoldings) UnmarshalJSON(b []byte) error {
	var list []gfHolding
	if err := json.Unmarshal(b, &list); err == nil {
		*h = list
		return nil
	}
	var bySymbol map[string]gfHolding
	if err := json.Unmarshal(b, &bySymbol); err != nil {
		return err
	}
	keys := make([]string, 0, len(bySymbol))
	for k := range bySymbol {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		*h = append(*h, bySymbol[k])
	}
	return nil
}

// holdings reads one account's holdings: its own address since 2.4x,
// else details (older versions), both filtered to the account.
func (g ghostfolio) holdings(ctx context.Context, id string) (gfHoldings, error) {
	var got struct {
		Holdings gfHoldings `json:"holdings"`
	}
	q := "?accounts=" + url.QueryEscape(id)
	err := g.read(ctx, "/portfolio/holdings"+q, &got)
	if errors.As(err, new(ghostfolioMissing)) {
		err = g.read(ctx, "/portfolio/details"+q, &got)
	}
	return got.Holdings, err
}

// ghostfolioInvestments reads each of Ghostfolio's accounts: its worth and
// holdings in the account's own currency (Ghostfolio's base turned into
// it at the rate its own two figures give), the largest first; cash, and
// holdings sold, left out.
func (a *App) ghostfolioInvestments() ([]finance.Invested, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	g, err := ghostfolioSignIn(ctx, core.Env(a.root))
	if err != nil {
		return nil, err
	}
	var list struct {
		Accounts []struct {
			ID                  string   `json:"id"`
			Name                string   `json:"name"`
			Currency            string   `json:"currency"`
			Balance             flexNum  `json:"balance"`
			Value               *flexNum `json:"value"`
			ValueInBaseCurrency flexNum  `json:"valueInBaseCurrency"`
		} `json:"accounts"`
	}
	if err := g.read(ctx, "/account", &list); err != nil {
		return nil, err
	}
	out := []finance.Invested{}
	for _, x := range list.Accounts {
		name := strings.TrimSpace(x.Name)
		if name == "" || x.ID == "" {
			continue
		}
		worth := float64(x.Balance)
		if x.Value != nil {
			worth = float64(*x.Value)
		}
		rate := 1.0
		if base := float64(x.ValueInBaseCurrency); base > 0 && worth > 0 {
			rate = worth / base
		}
		found, err := g.holdings(ctx, x.ID)
		if err != nil {
			return nil, err
		}
		inv := finance.Invested{Name: name, Value: cents(worth), Currency: strings.ToUpper(strings.TrimSpace(x.Currency)), Holdings: []finance.Holding{}}
		for _, h := range found {
			sym, title, sub := h.Symbol, h.Name, h.AssetSubClass
			if p := h.AssetProfile; p != nil {
				sym, title, sub = p.Symbol, p.Name, p.AssetSubClass
			}
			shares := float64(h.Quantity)
			if strings.EqualFold(sub, "CASH") || shares == 0 || strings.TrimSpace(sym) == "" {
				continue
			}
			value := shares * float64(h.MarketPrice)
			if h.ValueInBaseCurrency != nil {
				value = float64(*h.ValueInBaseCurrency)
			}
			inv.Holdings = append(inv.Holdings, finance.Holding{
				Symbol: strings.ToUpper(strings.TrimSpace(sym)),
				Name:   strings.TrimSpace(title),
				Shares: shares,
				Paid:   cents(float64(h.Investment) * rate),
				Value:  cents(value * rate),
			})
		}
		sort.SliceStable(inv.Holdings, func(i, j int) bool { return inv.Holdings[i].Value > inv.Holdings[j].Value })
		out = append(out, inv)
	}
	return out, nil
}

func cents(x float64) float64 { return math.Round(x*100) / 100 }

// InvestmentsRead is the plan after Read now, and the names of
// Ghostfolio's accounts no account in it matched.
type InvestmentsRead struct {
	View      finance.View `json:"view"`
	Unmatched []string     `json:"unmatched"`
}

// FinancesReadInvestments reads what each of Ghostfolio's accounts holds
// and keeps it on the plan's accounts it matches (Read now, or once a day
// on opening Finances): nothing is kept when the read fails.
func (a *App) FinancesReadInvestments() (InvestmentsRead, error) {
	found, err := a.ghostfolioInvestments()
	if err != nil {
		return InvestmentsRead{}, err
	}
	path := finance.Path(a.root)
	p, err := finance.Load(path)
	if err != nil {
		return InvestmentsRead{}, err
	}
	p, left := finance.TakeHoldings(p, found, time.Now())
	saved, err := finance.Save(path, p)
	if err != nil {
		return InvestmentsRead{}, err
	}
	if left == nil {
		left = []string{}
	}
	return InvestmentsRead{View: finance.ProjectWith(saved, a.ledger(), time.Now(), finance.Ahead), Unmatched: left}, nil
}
