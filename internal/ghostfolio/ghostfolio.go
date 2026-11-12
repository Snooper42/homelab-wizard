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
		// Ghostfolio's own figure for the account gives the rate from its
		// base currency to the account's; its worth is added up below.
		rate := 1.0
		if x.Value != nil {
			if own, base := float64(*x.Value), float64(x.ValueInBaseCurrency); base > 0 && own > 0 {
				rate = own / base
			}
		}
		found, err := g.holdings(ctx, x.ID)
		if err != nil {
			return nil, err
		}
		inv := finance.Invested{Name: name, Currency: strings.ToUpper(strings.TrimSpace(x.Currency)), Holdings: []finance.Holding{}}
		// What the account is worth is its cash and its holdings, as the
		// card lists them: Ghostfolio's own figure for the account can
		// lag a buy just put in, while its holdings already have it.
		worth := float64(x.Balance)
		// Ghostfolio says nothing went into a holding until it has its
		// prices (one just bought), and its worth is then only what was
		// paid: what was paid is read from its buys and sales, its worth
		// from today's price Ghostfolio looks up, and Ghostfolio is asked
		// to gather the symbol's prices itself (an admin's token may;
		// another's is refused, and that is all). Its own count of a
		// holding's shares can be far off then while its buys and sales
		// are right, so each holding's is checked against those: read
		// once for the account, and trusted only when the list is whole.
		var acts []gfActivity
		read, whole := false, false
		for _, h := range found {
			sym, title, sub := h.Symbol, h.Name, h.AssetSubClass
			if p := h.AssetProfile; p != nil {
				sym, title, sub = p.Symbol, p.Name, p.AssetSubClass
			}
			shares := float64(h.Quantity)
			if strings.EqualFold(sub, "CASH") || shares == 0 || strings.TrimSpace(sym) == "" {
				continue
			}
			if !read {
				read = true
				if got, all, err := g.activitiesWhole(ctx, x.ID); err == nil {
					acts, whole = got, all
				}
			}
			value := shares * float64(h.MarketPrice)
			if h.ValueInBaseCurrency != nil {
				value = float64(*h.ValueInBaseCurrency)
			}
			unpriced := float64(h.Investment) == 0
			recounted := false
			if n, ok := heldOf(acts, x.ID, sym); whole && ok && disagree(shares, n) {
				if n <= 0 {
					continue // sold, by its buys and sales
				}
				// Ghostfolio's worth is of its own count: a share's of it, times those held.
				value, shares, recounted = value/shares*n, n, true
			}
			paid := cents(float64(h.Investment) * rate)
			if paid == 0 && shares > 0 {
				if p, ok := paidFor(acts, x.ID, sym, inv.Currency); ok {
					paid = p
				}
			}
			worthNow, quoted := cents(value*rate), false
			if unpriced && recounted {
				// Unpriced, Ghostfolio's worth is what was paid, not a price.
				worthNow = paid
			}
			if unpriced && shares > 0 {
				if src := sourceOf(acts, x.ID, sym); src != "" {
					if price, code, ok := g.quote(ctx, src, sym); ok && (code == "" || inv.Currency == "" || strings.EqualFold(code, inv.Currency)) {
						worthNow, quoted = cents(shares*price), true
					}
					_ = g.Call(ctx, http.MethodPost, "/admin/gather/"+url.PathEscape(src)+"/"+url.PathEscape(sym), nil, nil)
				}
			}
			inv.Holdings = append(inv.Holdings, finance.Holding{
				Symbol:    strings.ToUpper(strings.TrimSpace(sym)),
				Name:      strings.TrimSpace(title),
				Shares:    shares,
				Paid:      paid,
				Value:     worthNow,
				Quoted:    quoted,
				Recounted: recounted,
				Doubtful:  !recounted && paid > 0 && worthNow > TooMuch*paid,
			})
			worth += worthNow
		}
		inv.Value = cents(worth)
		sort.SliceStable(inv.Holdings, func(i, j int) bool { return inv.Holdings[i].Value > inv.Holdings[j].Value })
		out = append(out, inv)
	}
	return out, nil
}

func cents(x float64) float64 { return math.Round(x*100) / 100 }

// TooMuch is how many times what was paid a holding may be worth before
// it is marked to check in Ghostfolio (Doubtful), when its buys and sales
// could not be read to count its shares.
const TooMuch = finance.TooMuch

// disagree is two counts of shares more than a rounding apart: a
// thousandth of the larger, and never less than 0.0001 of a share.
func disagree(a, b float64) bool {
	return math.Abs(a-b) > math.Max(0.0001, 0.001*math.Max(math.Abs(a), math.Abs(b)))
}

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
	// The Watchlist's tickers, priced again: one Ghostfolio has no price for
	// now keeps its last. Ghostfolio answered just now, so a sign-in that
	// fails here leaves them as they were rather than failing the read.
	if len(p.Watch) > 0 {
		if g, err := SignIn(ctx, core.Env(root)); err == nil {
			p.Watch = g.priceWatched(ctx, p.Watch, time.Now().Format("2006-01-02"))
		}
	}
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

// priceWatched prices each followed ticker again on day; one Ghostfolio
// has no price for keeps its last.
func (g Session) priceWatched(ctx context.Context, list []finance.Watched, day string) []finance.Watched {
	out := make([]finance.Watched, 0, len(list))
	for _, w := range list {
		if price, _, ok := g.quote(ctx, w.DataSource, w.Symbol); ok {
			w = w.Priced(day, price)
		}
		out = append(out, w)
	}
	return out
}

// FollowInto follows a ticker FindSymbol found (the Watchlist): priced by
// Ghostfolio now, kept in the plan at root with the day and that price.
// One followed already is left as it is; one Ghostfolio has no price for
// is refused, saying so.
func FollowInto(ctx context.Context, root string, s Symbol) (finance.Plan, error) {
	path := finance.Path(root)
	p, err := finance.Load(path)
	if err != nil {
		return p, err
	}
	symbol := strings.ToUpper(strings.TrimSpace(s.Symbol))
	if symbol == "" {
		return p, errors.New("follow which ticker? None was given")
	}
	for _, w := range p.Watch {
		if strings.EqualFold(w.Symbol, symbol) {
			return p, nil
		}
	}
	g, err := SignIn(ctx, core.Env(root))
	if err != nil {
		return p, err
	}
	price, currency, ok := g.quote(ctx, s.DataSource, symbol)
	if !ok {
		return p, fmt.Errorf("Ghostfolio has no price for %s right now: try again later, or another ticker", symbol)
	}
	if currency == "" {
		currency = strings.ToUpper(strings.TrimSpace(s.Currency))
	}
	day := time.Now().Format("2006-01-02")
	w := finance.Watched{Symbol: symbol, Name: strings.TrimSpace(s.Name), DataSource: s.DataSource, Currency: currency, Since: day, From: price}.Priced(day, price)
	p.Watch = append(p.Watch, w)
	return finance.Save(path, p)
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
	id, err := g.accountOf(ctx, acct)
	if err != nil {
		return err
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
	// Ghostfolio prices a symbol new to it only once it has gathered its
	// prices: asked now (an admin's token may), it need not wait a day.
	_ = g.Call(ctx, http.MethodPost, "/admin/gather/"+url.PathEscape(add.DataSource)+"/"+url.PathEscape(strings.ToUpper(strings.TrimSpace(add.Symbol))), nil, nil)
	if add.NewName != "" {
		p.Accounts = append(p.Accounts, acct)
		if _, err := finance.Save(path, p); err != nil {
			return err
		}
	}
	return nil
}

// accountOf is the id of Ghostfolio's account for one of the plan's: the
// one picked by hand, else the same name, else the one name inside the
// other when only one is; "" when it has none.
func (g Session) accountOf(ctx context.Context, acct finance.Account) (string, error) {
	var list struct {
		Accounts []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"accounts"`
	}
	if err := g.Read(ctx, "/account", &list); err != nil {
		return "", err
	}
	want := strings.TrimSpace(acct.Ghostfolio)
	if want == "" {
		want = acct.Name
	}
	plain := func(s string) string { return strings.Join(strings.FieldsFunc(strings.ToLower(s), notWordRune), " ") }
	for _, x := range list.Accounts {
		if plain(x.Name) == plain(want) {
			return x.ID, nil
		}
	}
	if acct.Ghostfolio != "" {
		return "", nil
	}
	var near []string
	for _, x := range list.Accounts {
		n, w := plain(x.Name), plain(want)
		if n != "" && (strings.Contains(n, w) || strings.Contains(w, n)) {
			near = append(near, x.ID)
		}
	}
	if len(near) == 1 {
		return near[0], nil
	}
	return "", nil
}

// Trade is a buy or a sale Ghostfolio keeps, as the card lists it under
// its holding to put right: its id there, the plan's account, the symbol
// as Ghostfolio prices it, how many shares, what was paid (or got) for
// them in all, in Currency, the fee Ghostfolio has on it, and the day.
type Trade struct {
	ID         string  `json:"id"`
	Account    string  `json:"account"`
	Symbol     string  `json:"symbol"`
	DataSource string  `json:"dataSource"`
	Currency   string  `json:"currency"`
	Shares     float64 `json:"shares"`
	Total      float64 `json:"total"`
	Fee        float64 `json:"fee,omitempty"`
	Date       string  `json:"date"`
	Sold       bool    `json:"sold,omitempty"`
}

// gfActivity is a buy or a sale as Ghostfolio answers: its symbol under
// assetProfile (since 2.249) or SymbolProfile (before).
type gfActivity struct {
	ID        string `json:"id"`
	AccountID string `json:"accountId"`
	Date      string `json:"date"`
	Type      string `json:"type"`
	Quantity  num    `json:"quantity"`
	UnitPrice num    `json:"unitPrice"`
	Fee       num    `json:"fee"`
	Currency  string `json:"currency"`
	Profile   *struct {
		Symbol     string `json:"symbol"`
		DataSource string `json:"dataSource"`
		Currency   string `json:"currency"`
	} `json:"assetProfile"`
	Old *struct {
		Symbol     string `json:"symbol"`
		DataSource string `json:"dataSource"`
		Currency   string `json:"currency"`
	} `json:"SymbolProfile"`
}

// investedAccount is the plan's investment or retirement account by id.
func investedAccount(p finance.Plan, id string) (finance.Account, error) {
	for _, a := range p.Accounts {
		if a.ID == id {
			if a.Kind != finance.Investment && a.Kind != finance.Retirement {
				return a, fmt.Errorf("%s is not an investment or retirement account", a.Name)
			}
			return a, nil
		}
	}
	return finance.Account{}, errors.New("pick the account it is in")
}

// activities are the buys, sales and the rest Ghostfolio keeps in one of
// its accounts: /activities since 2.249, /order before.
func (g Session) activities(ctx context.Context, id string) ([]gfActivity, error) {
	list, _, err := g.activitiesWhole(ctx, id)
	return list, err
}

// activitiesWhole is activities, and whether the list is all of them:
// not when Ghostfolio counts more than it sent (a page of them).
func (g Session) activitiesWhole(ctx context.Context, id string) ([]gfActivity, bool, error) {
	var got struct {
		Activities []gfActivity `json:"activities"`
		Count      *num         `json:"count"`
	}
	q := "?accounts=" + url.QueryEscape(id)
	err := g.Read(ctx, "/activities"+q, &got)
	if errors.As(err, new(missing)) {
		err = g.Read(ctx, "/order"+q, &got)
	}
	whole := got.Count == nil || int(*got.Count) <= len(got.Activities)
	return got.Activities, whole, err
}

// quote is today's price of a symbol, as Ghostfolio's data provider
// gives it (/symbols since 2.x, /symbol before), in its currency.
func (g Session) quote(ctx context.Context, dataSource, symbol string) (price float64, currency string, ok bool) {
	var got struct {
		Currency    string `json:"currency"`
		MarketPrice num    `json:"marketPrice"`
	}
	path := "/" + url.PathEscape(dataSource) + "/" + url.PathEscape(symbol)
	err := g.Read(ctx, "/symbols"+path, &got)
	if errors.As(err, new(missing)) {
		err = g.Read(ctx, "/symbol"+path, &got)
	}
	if err != nil || float64(got.MarketPrice) <= 0 {
		return 0, "", false
	}
	return float64(got.MarketPrice), strings.ToUpper(strings.TrimSpace(got.Currency)), true
}

// sourceOf is the data source Ghostfolio prices a symbol by, from its buys
// and sales in an account; "" when none says.
func sourceOf(acts []gfActivity, id, symbol string) string {
	for _, x := range acts {
		prof := x.Profile
		if prof == nil {
			prof = x.Old
		}
		if prof != nil && x.AccountID == id && strings.EqualFold(strings.TrimSpace(prof.Symbol), symbol) && prof.DataSource != "" {
			return prof.DataSource
		}
	}
	return ""
}

// heldOf is how many shares of a symbol an account holds by its buys
// less its sales; ok is false when it has none, or has an activity that
// counts shares some other way (a valuable, ITEM, or a LIABILITY).
func heldOf(acts []gfActivity, id, symbol string) (n float64, ok bool) {
	for _, x := range acts {
		prof := x.Profile
		if prof == nil {
			prof = x.Old
		}
		if prof == nil || x.AccountID != id || !strings.EqualFold(strings.TrimSpace(prof.Symbol), symbol) {
			continue
		}
		switch x.Type {
		case "BUY":
			n += float64(x.Quantity)
			ok = true
		case "SELL":
			n -= float64(x.Quantity)
			ok = true
		case "ITEM", "LIABILITY":
			return 0, false
		}
	}
	return math.Round(n*1e6) / 1e6, ok
}

// paidFor is what the shares of a symbol still held in an account cost,
// from its buys and sales oldest first: a buy adds what was paid, a sale
// takes off its shares' part of what they cost on average. ok is false
// when there are none, or one is in another currency than code.
func paidFor(acts []gfActivity, id, symbol, code string) (paid float64, ok bool) {
	list := append([]gfActivity(nil), acts...)
	sort.SliceStable(list, func(i, j int) bool { return list[i].Date < list[j].Date })
	held := 0.0
	for _, x := range list {
		prof := x.Profile
		if prof == nil {
			prof = x.Old
		}
		if prof == nil || x.AccountID != id || (x.Type != "BUY" && x.Type != "SELL") || !strings.EqualFold(strings.TrimSpace(prof.Symbol), symbol) {
			continue
		}
		cur := x.Currency
		if cur == "" {
			cur = prof.Currency
		}
		if code != "" && cur != "" && !strings.EqualFold(cur, code) {
			return 0, false
		}
		n := float64(x.Quantity)
		if x.Type == "BUY" {
			paid += n * float64(x.UnitPrice)
			held += n
		} else if held > 0 {
			paid -= paid * math.Min(1, n/held)
			held = math.Max(0, held-n)
		}
		ok = true
	}
	return cents(paid), ok
}

// trades signs in and lists the buys and sales Ghostfolio keeps in the
// plan's account (of symbol, when one is given), the newest first, with
// the session and Ghostfolio's id for the account.
func trades(ctx context.Context, root, account, symbol string) ([]Trade, Session, string, finance.Account, error) {
	p, err := finance.Load(finance.Path(root))
	if err != nil {
		return nil, Session{}, "", finance.Account{}, err
	}
	acct, err := investedAccount(p, account)
	if err != nil {
		return nil, Session{}, "", acct, err
	}
	g, err := SignIn(ctx, core.Env(root))
	if err != nil {
		return nil, g, "", acct, err
	}
	id, err := g.accountOf(ctx, acct)
	if err != nil || id == "" {
		if err == nil {
			err = fmt.Errorf("Ghostfolio has no account for %s yet", acct.Name)
		}
		return nil, g, "", acct, err
	}
	acts, err := g.activities(ctx, id)
	if err != nil {
		return nil, g, id, acct, err
	}
	symbol = strings.ToUpper(strings.TrimSpace(symbol))
	out := []Trade{}
	for _, x := range acts {
		prof := x.Profile
		if prof == nil {
			prof = x.Old
		}
		if prof == nil || x.ID == "" || x.AccountID != id || (x.Type != "BUY" && x.Type != "SELL") {
			continue
		}
		sym := strings.ToUpper(strings.TrimSpace(prof.Symbol))
		if symbol != "" && sym != symbol {
			continue
		}
		code := x.Currency
		if code == "" {
			code = prof.Currency
		}
		day := x.Date
		if len(day) > 10 {
			day = day[:10]
		}
		out = append(out, Trade{ID: x.ID, Account: account, Symbol: sym, DataSource: prof.DataSource, Currency: strings.ToUpper(code),
			Shares: float64(x.Quantity), Total: cents(float64(x.Quantity) * float64(x.UnitPrice)), Fee: float64(x.Fee), Date: day, Sold: x.Type == "SELL"})
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Date > out[j].Date })
	return out, g, id, acct, nil
}

// Trades lists the buys and sales of a holding (symbol) in one of the
// plan's investment or retirement accounts, as Ghostfolio keeps them, the
// newest first, for the card to put one right or delete it.
func Trades(ctx context.Context, root, account, symbol string) ([]Trade, error) {
	out, _, _, _, err := trades(ctx, root, account, symbol)
	return out, err
}

// kept is the trade of this id in the account's list, or why not.
func kept(list []Trade, id string, acct finance.Account) (Trade, error) {
	for _, t := range list {
		if t.ID == id {
			return t, nil
		}
	}
	return Trade{}, fmt.Errorf("that buy or sale is not in %s in Ghostfolio: read again, then try once more", acct.Name)
}

// ChangeTrade puts a buy or a sale right in Ghostfolio: how many shares,
// what was paid (or got) in all, the day, and bought or sold. Its
// account, symbol, and fee stay as Ghostfolio has them; one not in the
// account named is refused. The caller then reads again (ReadInto).
func ChangeTrade(ctx context.Context, root string, t Trade) error {
	day, err := time.ParseInLocation("2006-01-02", t.Date, time.Local)
	switch {
	case !(t.Shares > 0) || math.IsInf(t.Shares, 0):
		return errors.New("how many shares: more than 0")
	case !(t.Total >= 0) || math.IsInf(t.Total, 0):
		return errors.New("what was paid: type it without a minus")
	case err != nil:
		return fmt.Errorf("the day %q is no date", t.Date)
	case day.After(time.Now()):
		return errors.New("the day is still to come: type the day it happened")
	}
	list, g, id, acct, err := trades(ctx, root, t.Account, "")
	if err != nil {
		return err
	}
	was, err := kept(list, t.ID, acct)
	if err != nil {
		return err
	}
	kind := "BUY"
	if t.Sold {
		kind = "SELL"
	}
	activity := map[string]any{
		"id":         was.ID,
		"accountId":  id,
		"currency":   was.Currency,
		"dataSource": was.DataSource,
		"date":       t.Date + "T00:00:00.000Z",
		"fee":        was.Fee,
		"quantity":   t.Shares,
		"symbol":     was.Symbol,
		"type":       kind,
		"unitPrice":  t.Total / t.Shares,
	}
	err = g.Call(ctx, http.MethodPut, "/activities/"+url.PathEscape(was.ID), activity, nil)
	if errors.As(err, new(missing)) {
		err = g.Call(ctx, http.MethodPut, "/order/"+url.PathEscape(was.ID), activity, nil)
	}
	return err
}

// DeleteTrade deletes a buy or a sale from Ghostfolio, only from the
// plan's account named. The caller then reads again (ReadInto).
func DeleteTrade(ctx context.Context, root, account, id string) error {
	list, g, _, acct, err := trades(ctx, root, account, "")
	if err != nil {
		return err
	}
	was, err := kept(list, id, acct)
	if err != nil {
		return err
	}
	err = g.Call(ctx, http.MethodDelete, "/activities/"+url.PathEscape(was.ID), nil, nil)
	if errors.As(err, new(missing)) {
		err = g.Call(ctx, http.MethodDelete, "/order/"+url.PathEscape(was.ID), nil, nil)
	}
	return err
}

// notWordRune is a character that is not part of a name's words.
func notWordRune(r rune) bool {
	return !(r >= 'a' && r <= 'z' || r >= '0' && r <= '9')
}
