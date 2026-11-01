package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/core"
)

// Finances reads from the homelab's own apps, on a click and only reading:
// the balances Firefly III keeps (Update balances). Each answers on this
// machine (127.0.0.1), never anywhere else.

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
