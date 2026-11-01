package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Firefly III's asset accounts read with its token: active ones, their
// balances as numbers; no token, a refused one, and no answer each say why.
func TestFinancesFromFirefly(t *testing.T) {
	a, _ := testApp(t)
	saved := fireflyBase
	t.Cleanup(func() { fireflyBase = saved })
	var auth, accept, query string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth, accept, query = r.Header.Get("Authorization"), r.Header.Get("Accept"), r.URL.RawQuery
		if auth != "Bearer good" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_, _ = w.Write([]byte(`{"data":[
			{"attributes":{"name":"Chase Checking","current_balance":"2512.40","currency_code":"usd","active":true}},
			{"attributes":{"name":" BofA Savings ","current_balance":"6500","currency_code":"USD"}},
			{"attributes":{"name":"Old account","current_balance":"0","active":false}},
			{"attributes":{"name":"Broken","current_balance":"lots"}}]}`))
	}))
	defer srv.Close()
	fireflyBase = func(map[string]string) string { return srv.URL + "/api/v1" }
	env := func(s string) {
		if err := os.WriteFile(filepath.Join(a.root, ".env"), []byte(s), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	env("TZ=UTC\nFIREFLY_IMPORTER_TOKEN=\n")
	if _, err := a.FinancesFromFirefly(); err == nil || !strings.Contains(err.Error(), "token is not set") {
		t.Fatalf("no token: %v", err)
	}
	env("TZ=UTC\nFIREFLY_IMPORTER_TOKEN=bad\n")
	if _, err := a.FinancesFromFirefly(); err == nil || !strings.Contains(err.Error(), "refused the token") {
		t.Fatalf("a refused token: %v", err)
	}
	env("TZ=UTC\nFIREFLY_IMPORTER_TOKEN=good\n")
	got, err := a.FinancesFromFirefly()
	if err != nil || len(got) != 2 || got[0] != (AppBalance{Name: "Chase Checking", Balance: 2512.40, Currency: "USD"}) || got[1] != (AppBalance{Name: "BofA Savings", Balance: 6500, Currency: "USD"}) {
		t.Fatalf("read %+v %v", got, err)
	}
	if accept != "application/vnd.api+json" || !strings.Contains(query, "type=asset") {
		t.Errorf("asked with %q %q", accept, query)
	}
	srv.Close()
	if _, err := a.FinancesFromFirefly(); err == nil || !strings.Contains(err.Error(), "does not answer") {
		t.Errorf("no answer: %v", err)
	}
	if got := saved(map[string]string{"FIREFLY_PORT": "9000"}); got != "http://127.0.0.1:9000/api/v1" {
		t.Errorf("the base: %s", got)
	}
}
