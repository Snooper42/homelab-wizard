package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/core"
)

// Finances reads from the homelab's own apps, on a click and only reading:
// the balances Firefly III keeps (Update balances), and the subscriptions
// Wallos keeps (Recurring). Each answers on this machine (127.0.0.1),
// never anywhere else.

// AppBalance is an account's balance as another app on the homelab keeps it.
type AppBalance struct {
	Name     string  `json:"name"`
	Balance  float64 `json:"balance"`
	Currency string  `json:"currency,omitempty"`
}

// fireflyBase is Firefly III's API on this machine, at its port.
var fireflyBase = func(env map[string]string) string {
	port := env["FIREFLY_PORT"]
	if port == "" {
		port = "8094"
	}
	return "http://127.0.0.1:" + port + "/api/v1"
}

// FinancesFromFirefly reads the asset accounts' balances from Firefly III
// with its personal access token (FIREFLY_IMPORTER_TOKEN), for Update
// balances to offer; nothing is changed in either.
func (a *App) FinancesFromFirefly() ([]AppBalance, error) {
	env := core.Env(a.root)
	token := env["FIREFLY_IMPORTER_TOKEN"]
	if token == "" {
		return nil, errors.New("Firefly III's token is not set: make one in Firefly III (Profile › OAuth › Personal access tokens) and put it in Settings › FIREFLY_IMPORTER_TOKEN")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fireflyBase(env)+"/accounts?type=asset&limit=200", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.api+json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, errors.New("Firefly III does not answer on this machine: is it running? (Status)")
	}
	defer res.Body.Close()
	switch {
	case res.StatusCode == http.StatusUnauthorized:
		return nil, errors.New("Firefly III refused the token: make a new one (Profile › OAuth) and put it in Settings › FIREFLY_IMPORTER_TOKEN")
	case res.StatusCode != http.StatusOK:
		return nil, fmt.Errorf("Firefly III answered %s", res.Status)
	}
	var body struct {
		Data []struct {
			Attributes struct {
				Name           string `json:"name"`
				CurrentBalance string `json:"current_balance"`
				CurrencyCode   string `json:"currency_code"`
				Active         *bool  `json:"active"`
			} `json:"attributes"`
		} `json:"data"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("Firefly III's answer could not be read: %v", err)
	}
	out := []AppBalance{}
	for _, d := range body.Data {
		at := d.Attributes
		if at.Active != nil && !*at.Active {
			continue
		}
		n, err := strconv.ParseFloat(strings.TrimSpace(at.CurrentBalance), 64)
		if err != nil || strings.TrimSpace(at.Name) == "" {
			continue
		}
		out = append(out, AppBalance{Name: strings.TrimSpace(at.Name), Balance: n, Currency: strings.ToUpper(at.CurrencyCode)})
	}
	return out, nil
}

// AppSubscription is a subscription as Wallos keeps it, in the words of a
// Finances payment: Every is a Schedule's ("month", "year"), or "" for a
// rhythm Finances does not keep (each day, every 6 months), with Cycle
// saying which in words.
type AppSubscription struct {
	Name     string  `json:"name"`
	Amount   float64 `json:"amount"`
	Every    string  `json:"every"`
	Cycle    string  `json:"cycle"`
	Next     string  `json:"next,omitempty"`
	Category string  `json:"category,omitempty"`
	Off      bool    `json:"off,omitempty"`
}

// wallosBase is Wallos's API on this machine, at its port.
var wallosBase = func(env map[string]string) string {
	port := env["WALLOS_PORT"]
	if port == "" {
		port = "8282"
	}
	return "http://127.0.0.1:" + port + "/api"
}

// flexNum is a number Wallos may write as a number, a string, or true/false;
// anything else is 0, so one odd row does not stop the rest being read.
type flexNum float64

func (n *flexNum) UnmarshalJSON(b []byte) error {
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
	*n = flexNum(f)
	return nil
}

// wallosEvery is a Wallos cycle (1 a day, 2 a week, 3 a month, 4 a year)
// every so many: the Schedule it is, "" when Finances keeps no such
// rhythm, and the rhythm in words.
func wallosEvery(cycle, every int) (string, string) {
	if every < 1 {
		every = 1
	}
	unit := map[int]string{1: "day", 2: "week", 3: "month", 4: "year"}[cycle]
	words := "every " + unit
	if every > 1 {
		words = fmt.Sprintf("every %d %ss", every, unit)
	}
	if unit == "" {
		words = "an unknown rhythm"
	}
	switch {
	case cycle == 2 && every == 1:
		return "week", words
	case cycle == 2 && every == 2:
		return "2 weeks", words
	case cycle == 3 && every == 1:
		return "month", words
	case cycle == 3 && every == 3:
		return "3 months", words
	case cycle == 3 && every == 12, cycle == 4 && every == 1:
		return "year", words
	}
	return "", words
}

// FinancesFromWallos reads the subscriptions Wallos keeps, with its API key
// (WALLOS_API_KEY, Profile › API Key), prices in its main currency, for
// Recurring to offer; nothing is changed in either.
func (a *App) FinancesFromWallos() ([]AppSubscription, error) {
	env := core.Env(a.root)
	key := strings.TrimSpace(env["WALLOS_API_KEY"])
	if key == "" {
		return nil, errors.New("Wallos's API key is not set: copy it from Wallos (Profile › API Key) and put it in Settings › WALLOS_API_KEY")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	q := url.Values{"api_key": {key}, "convert_currency": {"true"}}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, wallosBase(env)+"/subscriptions/get_subscriptions.php?"+q.Encode(), nil)
	if err != nil {
		return nil, errors.New("Wallos's address could not be made from WALLOS_PORT")
	}
	req.Header.Set("Accept", "application/json")
	// The key is in the address: no error here repeats it.
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, errors.New("Wallos does not answer on this machine: is it running? (Status)")
	}
	defer res.Body.Close()
	refused := errors.New("Wallos refused the API key: copy it again from Wallos (Profile › API Key) into Settings › WALLOS_API_KEY")
	switch {
	case res.StatusCode == http.StatusUnauthorized || res.StatusCode == http.StatusForbidden:
		return nil, refused
	case res.StatusCode != http.StatusOK:
		return nil, fmt.Errorf("Wallos answered %s", res.Status)
	}
	var body struct {
		Success *bool `json:"success"`
		Subs    []struct {
			Name     string  `json:"name"`
			Price    flexNum `json:"price"`
			Cycle    flexNum `json:"cycle"`
			Every    flexNum `json:"frequency"`
			Next     string  `json:"next_payment"`
			Category string  `json:"category_name"`
			Inactive flexNum `json:"inactive"`
		} `json:"subscriptions"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return nil, errors.New("Wallos's answer could not be read: is WALLOS_PORT Wallos's port?")
	}
	if body.Success != nil && !*body.Success {
		return nil, refused
	}
	out := []AppSubscription{}
	for _, x := range body.Subs {
		name := strings.TrimSpace(x.Name)
		if name == "" || x.Price < 0 {
			continue
		}
		every, words := wallosEvery(int(x.Cycle), int(x.Every))
		next := strings.TrimSpace(x.Next)
		if _, err := time.Parse("2006-01-02", next); err != nil {
			next = ""
		}
		cat := strings.TrimSpace(x.Category)
		if strings.EqualFold(cat, "No category") {
			cat = ""
		}
		out = append(out, AppSubscription{Name: name, Amount: float64(x.Price), Every: every, Cycle: words, Next: next, Category: cat, Off: x.Inactive != 0})
	}
	return out, nil
}
