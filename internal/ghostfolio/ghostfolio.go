// Package ghostfolio talks to the homelab's own Ghostfolio, the investment
// tracker, on this machine (127.0.0.1) only, for Finances' Investments:
// reading what each account holds (Read now), looking a ticker up, and
// putting a buy or a sale in. The desktop app and the phone companion
// (homelab serve) both call it, so the native iPhone app can do what the
// card on the computer does. Ghostfolio is AGPL-3.0: this calls its API
// and copies none of its code. It looks prices up by symbol itself; no
// amount or account leaves the homelab, only a ticker typed in.
package ghostfolio

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/finance"
)

// Base is Ghostfolio's API on this machine, at its port.
var Base = func(env map[string]string) string {
	port := env["GHOSTFOLIO_PORT"]
	if port == "" {
		port = "3333"
	}
	return "http://127.0.0.1:" + port + "/api/v1"
}

// num is a number Ghostfolio may write as a number or a string (older
// versions quote some); true/false read as 1/0;
// anything else is 0, so one odd row does not stop the rest being read.
type num float64

func (n *num) UnmarshalJSON(b []byte) error {
	s := strings.Trim(strings.TrimSpace(string(b)), `"`)
	switch s {
	case "", "null", "false":
		*n = 0
		return nil
	case "true":
		*n = 1
		return nil
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		f = 0
	}
	*n = num(f)
	return nil
}

var (
	errGhostfolioRefused = errors.New("Ghostfolio refused the security token: put the one you sign in with in Settings › GHOSTFOLIO_SECURITY_TOKEN")
	errGhostfolioQuiet   = errors.New("Ghostfolio does not answer on this machine: is it running? (Status)")
	errGhostfolioUnread  = errors.New("Ghostfolio's answer could not be read: is GHOSTFOLIO_PORT Ghostfolio's port?")
)

// missing is an address this Ghostfolio does not have (an older one).
type missing struct{ status string }

func (e missing) Error() string { return "Ghostfolio answered " + e.status }

// Session is a session signed in to Ghostfolio's API.
type Session struct{ base, session string }

// SignIn signs in with the household's security token
// (GHOSTFOLIO_SECURITY_TOKEN), for a session's token.
func SignIn(ctx context.Context, env map[string]string) (Session, error) {
	token := strings.TrimSpace(env["GHOSTFOLIO_SECURITY_TOKEN"])
	if token == "" {
		return Session{}, errors.New("Ghostfolio's security token is not set: put the one you sign in to Ghostfolio with in Settings › GHOSTFOLIO_SECURITY_TOKEN")
	}
	g := Session{base: Base(env)}
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

// Read GETs one of the API's addresses (path and query) into v.
func (g Session) Read(ctx context.Context, path string, v any) error {
	return g.Call(ctx, http.MethodGet, path, nil, v)
}

// Call sends a request to one of the API's addresses, with body as JSON
// when there is one, and reads its answer into v. What Ghostfolio turns
// down (400) is said in its own words.
func (g Session) Call(ctx context.Context, method, path string, body, v any) error {
	var send io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}
		send = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, g.base+path, send)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+g.session)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return errGhostfolioQuiet
	}
	defer res.Body.Close()
	switch {
	case res.StatusCode == http.StatusUnauthorized || res.StatusCode == http.StatusForbidden:
		return errGhostfolioRefused
	case res.StatusCode == http.StatusNotFound:
		return missing{res.Status}
	case res.StatusCode == http.StatusBadRequest:
		var why struct {
			Message json.RawMessage `json:"message"`
		}
		_ = json.NewDecoder(io.LimitReader(res.Body, 1<<16)).Decode(&why)
		var one string
		var many []string
		if json.Unmarshal(why.Message, &one) == nil && one != "" {
			many = []string{one}
		} else {
			_ = json.Unmarshal(why.Message, &many)
		}
		if len(many) == 0 {
			return fmt.Errorf("Ghostfolio did not take it (%s)", res.Status)
		}
		return fmt.Errorf("Ghostfolio did not take it: %s", strings.Join(many, "; "))
	case res.StatusCode < 200 || res.StatusCode >= 300:
		return fmt.Errorf("Ghostfolio answered %s", res.Status)
	}
	if v == nil {
		return nil
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
	Quantity            num  `json:"quantity"`
	Investment          num  `json:"investment"`
	MarketPrice         num  `json:"marketPrice"`
	ValueInBaseCurrency *num `json:"valueInBaseCurrency"`
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
func (g Session) holdings(ctx context.Context, id string) (gfHoldings, error) {
	var got struct {
		Holdings gfHoldings `json:"holdings"`
	}
	q := "?accounts=" + url.QueryEscape(id)
	err := g.Read(ctx, "/portfolio/holdings"+q, &got)
	if errors.As(err, new(missing)) {
		err = g.Read(ctx, "/portfolio/details"+q, &got)
	}
	return got.Holdings, err
}

// Investments reads each of Ghostfolio's accounts: its worth and
// holdings in the account's own currency (Ghostfolio's base turned into
// it at the rate its own two figures give), the largest first; cash, and
// holdings sold, left out.
func Investments(ctx context.Context, env map[string]string) ([]finance.Invested, error) {
	g, err := SignIn(ctx, env)
	if err != nil {
		return nil, err
	}
	var list struct {
		Accounts []struct {
			ID                  string `json:"id"`
			Name                string `json:"name"`
			Currency            string `json:"currency"`
			Balance             num    `json:"balance"`
			Value               *num   `json:"value"`
			ValueInBaseCurrency num    `json:"valueInBaseCurrency"`
		} `json:"accounts"`
	}
	if err := g.Read(ctx, "/account", &list); err != nil {
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

// Read is what Read now did: the plan as saved, the names of Ghostfolio's
// accounts no account in it matched, and how many accounts and holdings
// Ghostfolio has, matched or not: a read of a Ghostfolio with nothing in
// it yet still shows the token worked.
type Read struct {
	Plan      finance.Plan
	Unmatched []string
	Accounts  int
	Holdings  int
}

// ReadInto reads what each of Ghostfolio's accounts holds and keeps it on
// the plan's accounts it matches (Read now, or once a day on opening
// Finances), in the homelab at root: nothing is kept when the read fails.
func ReadInto(ctx context.Context, root string) (Read, error) {
	found, err := Investments(ctx, core.Env(root))
	if err != nil {
		return Read{}, err
	}
	path := finance.Path(root)
	p, err := finance.Load(path)
	if err != nil {
		return Read{}, err
	}
	p, left := finance.TakeHoldings(p, found, time.Now())
	saved, err := finance.Save(path, p)
	if err != nil {
		return Read{}, err
	}
	if left == nil {
		left = []string{}
	}
	held := 0
	for _, f := range found {
		held += len(f.Holdings)
	}
	return Read{Plan: saved, Unmatched: left, Accounts: len(found), Holdings: held}, nil
}

// Symbol is a ticker Ghostfolio found: its symbol, name, the currency
// it trades in, and where Ghostfolio prices it.
type Symbol struct {
	Symbol     string `json:"symbol"`
	Name       string `json:"name"`
	Currency   string `json:"currency"`
	DataSource string `json:"dataSource"`
}

// FindSymbol looks a ticker or a name up in Ghostfolio, for the
// form to offer its matches; nothing typed finds nothing.
func FindSymbol(ctx context.Context, env map[string]string, query string) ([]Symbol, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return []Symbol{}, nil
	}
	g, err := SignIn(ctx, env)
	if err != nil {
		return nil, err
	}
	var found struct {
		Items []Symbol `json:"items"`
	}
	if err := g.Read(ctx, "/symbol/lookup?query="+url.QueryEscape(strings.ToLower(query)), &found); err != nil {
		return nil, err
	}
	out := []Symbol{}
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

// Add is a buy (or, Sold, a sale) typed in on the card: into the
// plan's account Account, or a new investment account NewName; the
// symbol as Ghostfolio found it; how many shares, and what was paid (or
// got) for them in all, in Currency; on Date (YYYY-MM-DD).
type Add struct {
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

// AddInvestment puts a buy or a sale into Ghostfolio, in the
// Ghostfolio account of the plan account's name (made there first when
// it has none), then the caller reads the investments again (ReadInto). A new account is made
// in Ghostfolio and in the plan by one name, so the two always match; it
// is kept in the plan only once Ghostfolio has taken the buy.
func AddInvestment(ctx context.Context, root string, add Add) error {
	path := finance.Path(root)
	p, err := finance.Load(path)
	if err != nil {
		return err
	}
	add.Symbol, add.NewName = strings.TrimSpace(add.Symbol), strings.TrimSpace(add.NewName)
	day, err := time.ParseInLocation("2006-01-02", add.Date, time.Local)
	switch {
	case add.Symbol == "" || add.DataSource == "" || add.Currency == "":
		return errors.New("pick what was bought from the list Ghostfolio finds")
	case !(add.Shares > 0) || math.IsInf(add.Shares, 0):
		return errors.New("how many shares: more than 0")
	case !(add.Total >= 0) || math.IsInf(add.Total, 0):
		return errors.New("what was paid: type it without a minus")
	case err != nil:
		return fmt.Errorf("the day %q is no date", add.Date)
	case day.After(time.Now()):
		return errors.New("the day is still to come: type the day it was bought")
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
			return errors.New("pick the account it is in")
		case acct.Kind != finance.Investment && acct.Kind != finance.Retirement:
			return fmt.Errorf("%s is not an investment or retirement account", acct.Name)
		}
	}
	code := strings.ToUpper(acct.Currency)
	if code == "" {
		code = strings.ToUpper(strings.TrimSpace(p.Currency))
	}
	if code == "" {
		code = "USD"
	}

	g, err := SignIn(ctx, core.Env(root))
	if err != nil {
		return err
	}
	var list struct {
		Accounts []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"accounts"`
	}
	if err := g.Read(ctx, "/account", &list); err != nil {
		return err
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
		err := g.Call(ctx, http.MethodPost, "/account", map[string]any{"name": acct.Name, "currency": code, "balance": 0, "platformId": nil}, &made)
		if err != nil {
			return err
		}
		if made.ID == "" {
			return errGhostfolioUnread
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
	err = g.Call(ctx, http.MethodPost, "/activities", activity, nil)
	if errors.As(err, new(missing)) {
		err = g.Call(ctx, http.MethodPost, "/order", activity, nil)
	}
	if err != nil {
		return err
	}
	if add.NewName != "" {
		p.Accounts = append(p.Accounts, acct)
		if _, err := finance.Save(path, p); err != nil {
			return err
		}
	}
	return nil
}

// notWordRune is a character that is not part of a name's words.
func notWordRune(r rune) bool {
	return !(r >= 'a' && r <= 'z' || r >= '0' && r <= '9')
}
