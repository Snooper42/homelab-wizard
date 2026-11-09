// Package ghostfoliotest is a fake Ghostfolio API for tests: one security
// token, accounts that hold what was bought into them, a ticker lookup,
// and the buys and sales put in, kept to look at afterwards, each listed,
// changed or deleted by its id.
package ghostfoliotest

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
)

// Token is the security token the fake takes; any other is refused.
const Token = "good-token"

// Activity is a buy or a sale the fake was sent.
type Activity struct {
	ID         string  `json:"id"`
	AccountID  string  `json:"accountId"`
	Currency   string  `json:"currency"`
	DataSource string  `json:"dataSource"`
	Date       string  `json:"date"`
	Quantity   float64 `json:"quantity"`
	Symbol     string  `json:"symbol"`
	Type       string  `json:"type"`
	UnitPrice  float64 `json:"unitPrice"`
	Fee        float64 `json:"fee"`
}

// Fake is a running fake Ghostfolio. Base is what ghostfolio.Base should
// answer for it.
type Fake struct {
	*httptest.Server
	Base string

	mu         sync.Mutex
	accounts   []map[string]any
	Activities []Activity
	made       int

	// Unpriced: holdings say nothing went in (investment 0), and are
	// worth what was paid, as Ghostfolio's are until it has a symbol's
	// prices; Quotes are today's prices /symbols looks up, by symbol, and
	// Gathered the symbols asked to be gathered (admin/gather).
	Unpriced bool
	Quotes   map[string]float64
	Gathered []string

	// Behind: an account's worth (GET /account) leaves out the newest buy
	// or sale, as Ghostfolio's does until it has worked it out again.
	Behind bool
}

// New starts a fake with these accounts (each an id, name and currency).
func New(accounts ...map[string]any) *Fake {
	f := &Fake{accounts: accounts}
	f.Server = httptest.NewServer(http.HandlerFunc(f.serve))
	f.Base = f.URL + "/api/v1"
	return f
}

// Accounts are the accounts the fake has now, made ones included.
func (f *Fake) Accounts() []map[string]any {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]map[string]any(nil), f.accounts...)
}

func (f *Fake) serve(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	path := strings.TrimPrefix(r.URL.Path, "/api/v1")
	if path == "/auth/anonymous" {
		var b struct {
			AccessToken string `json:"accessToken"`
		}
		_ = json.NewDecoder(r.Body).Decode(&b)
		if b.AccessToken != Token {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"authToken": "session"})
		return
	}
	if r.Header.Get("Authorization") != "Bearer session" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	one := strings.TrimPrefix(path, "/activities/")
	switch {
	case path == "/account" && r.Method == http.MethodGet:
		out := []map[string]any{}
		for _, a := range f.accounts {
			x := map[string]any{"value": f.worth(a["id"].(string))}
			for k, v := range a {
				x[k] = v
			}
			out = append(out, x)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"accounts": out})
	case path == "/account" && r.Method == http.MethodPost:
		var b map[string]any
		_ = json.NewDecoder(r.Body).Decode(&b)
		id := "made-" + strings.ToLower(strings.ReplaceAll(b["name"].(string), " ", "-"))
		f.accounts = append(f.accounts, map[string]any{"id": id, "name": b["name"], "currency": b["currency"]})
		_ = json.NewEncoder(w).Encode(map[string]string{"id": id})
	case path == "/portfolio/holdings":
		id := r.URL.Query().Get("accounts")
		held := map[string]float64{}
		paid := map[string]float64{}
		for _, a := range f.Activities {
			if a.AccountID != id {
				continue
			}
			n := a.Quantity
			if a.Type == "SELL" {
				n = -n
			}
			held[a.Symbol] += n
			paid[a.Symbol] += n * a.UnitPrice
		}
		out := []map[string]any{}
		for sym, n := range held {
			out = append(out, map[string]any{"assetProfile": map[string]any{"symbol": sym, "name": sym + " Inc"}, "quantity": n, "investment": invested(paid[sym], f.Unpriced), "valueInBaseCurrency": worthOf(n, paid[sym], f.Unpriced)})
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"holdings": out})
	case strings.HasPrefix(path, "/admin/gather/") && r.Method == http.MethodPost:
		f.Gathered = append(f.Gathered, strings.TrimPrefix(path, "/admin/gather/"))
		w.WriteHeader(http.StatusCreated)
	case strings.HasPrefix(path, "/symbols/") && path != "/symbols/lookup" && r.Method == http.MethodGet:
		parts := strings.Split(strings.TrimPrefix(path, "/symbols/"), "/")
		price, ok := f.Quotes[parts[len(parts)-1]]
		if !ok {
			http.NotFound(w, r)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"currency": "USD", "dataSource": parts[0], "symbol": parts[len(parts)-1], "marketPrice": price})
	case path == "/symbol/lookup":
		q := r.URL.Query().Get("query")
		items := []map[string]string{}
		if strings.Contains("vti vanguard total stock market", q) {
			items = append(items, map[string]string{"symbol": "VTI", "name": "Vanguard Total Stock Market", "currency": "USD", "dataSource": "YAHOO"})
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"items": items})
	case path == "/activities" && r.Method == http.MethodPost:
		var a Activity
		if json.NewDecoder(r.Body).Decode(&a) != nil || a.AccountID == "" {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]any{"message": []string{"accountId must be set"}})
			return
		}
		f.made++
		a.ID = "act-" + strconv.Itoa(f.made)
		f.Activities = append(f.Activities, a)
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte("{}"))
	case path == "/activities" && r.Method == http.MethodGet:
		id := r.URL.Query().Get("accounts")
		out := []map[string]any{}
		for _, a := range f.Activities {
			if a.AccountID == id {
				out = append(out, map[string]any{"id": a.ID, "accountId": a.AccountID, "date": a.Date, "type": a.Type, "quantity": a.Quantity, "unitPrice": a.UnitPrice, "fee": a.Fee, "currency": a.Currency,
					"assetProfile": map[string]any{"symbol": a.Symbol, "dataSource": a.DataSource, "currency": a.Currency, "name": a.Symbol + " Inc"}})
			}
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"activities": out, "count": len(out)})
	case one != path && r.Method == http.MethodPut:
		var a Activity
		_ = json.NewDecoder(r.Body).Decode(&a)
		for i := range f.Activities {
			if f.Activities[i].ID == one && a.ID == one && a.AccountID != "" {
				f.Activities[i] = a
				_ = json.NewEncoder(w).Encode(a)
				return
			}
		}
		http.NotFound(w, r)
	case one != path && r.Method == http.MethodDelete:
		for i := range f.Activities {
			if f.Activities[i].ID == one {
				_ = json.NewEncoder(w).Encode(f.Activities[i])
				f.Activities = append(f.Activities[:i], f.Activities[i+1:]...)
				return
			}
		}
		http.NotFound(w, r)
	default:
		http.NotFound(w, r)
	}
}

// worth is what an account's holdings are worth: 100 a share.
func (f *Fake) worth(id string) float64 {
	n := 0.0
	list := f.Activities
	if f.Behind && len(list) > 0 {
		list = list[:len(list)-1]
	}
	for _, a := range list {
		if a.AccountID == id {
			if a.Type == "SELL" {
				n -= a.Quantity
			} else {
				n += a.Quantity
			}
		}
	}
	return n * 100
}

// invested is a holding's investment as the fake answers it: none while unpriced.
func invested(paid float64, unpriced bool) float64 {
	if unpriced {
		return 0
	}
	return paid
}

// worthOf is a holding's worth as the fake answers it: $100 a share, or
// while unpriced only what was paid.
func worthOf(n, paid float64, unpriced bool) float64 {
	if unpriced {
		return paid
	}
	return n * 100
}
