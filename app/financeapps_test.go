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

// Wallos's subscriptions read with its key, in a payment's words: each
// rhythm Finances keeps as its Schedule, another named; one turned off
// marked; no key, a refused one, and no answer each say why, never with
// the key.
func TestFinancesFromWallos(t *testing.T) {
	a, _ := testApp(t)
	saved := wallosBase
	t.Cleanup(func() { wallosBase = saved })
	var path, query string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path, query = r.URL.Path, r.URL.RawQuery
		switch r.URL.Query().Get("api_key") {
		case "good":
		case "gone":
			w.WriteHeader(http.StatusUnauthorized)
			return
		default:
			_, _ = w.Write([]byte(`{"success":false,"title":"Invalid API key"}`))
			return
		}
		_, _ = w.Write([]byte(`{"success":true,"title":"subscriptions","subscriptions":[
			{"id":1,"name":"Netflix","price":15.49,"cycle":3,"frequency":1,"next_payment":"2026-11-12","category_name":"Entertainment","inactive":0},
			{"id":2,"name":" Proton Mail ","price":"119.88","cycle":"4","frequency":"1","next_payment":"2027-03-02","category_name":"No category","inactive":"0"},
			{"id":3,"name":"Car insurance","price":540,"cycle":3,"frequency":6,"next_payment":"2027-01-15","inactive":0},
			{"id":4,"name":"Hulu","price":7.99,"cycle":3,"frequency":1,"next_payment":"soon","inactive":1},
			{"id":5,"name":"Gym","price":12,"cycle":2,"frequency":2,"next_payment":"2026-11-03","inactive":false},
			{"id":6,"name":"","price":3,"cycle":3,"frequency":1},
			{"id":7,"name":"Odd","price":"lots","cycle":{"x":1},"frequency":1}]}`))
	}))
	defer srv.Close()
	wallosBase = func(map[string]string) string { return srv.URL + "/api" }
	env := func(s string) {
		if err := os.WriteFile(filepath.Join(a.root, ".env"), []byte(s), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	env("TZ=UTC\nWALLOS_API_KEY=\n")
	if _, err := a.FinancesFromWallos(); err == nil || !strings.Contains(err.Error(), "key is not set") {
		t.Fatalf("no key: %v", err)
	}
	for _, k := range []string{"wrong", "gone"} {
		env("TZ=UTC\nWALLOS_API_KEY=" + k + "\n")
		if _, err := a.FinancesFromWallos(); err == nil || !strings.Contains(err.Error(), "refused the API key") || strings.Contains(err.Error(), k) {
			t.Fatalf("a refused key %s: %v", k, err)
		}
	}
	env("TZ=UTC\nWALLOS_API_KEY=good\n")
	got, err := a.FinancesFromWallos()
	want := []AppSubscription{
		{Name: "Netflix", Amount: 15.49, Every: "month", Cycle: "every month", Next: "2026-11-12", Category: "Entertainment"},
		{Name: "Proton Mail", Amount: 119.88, Every: "year", Cycle: "every year", Next: "2027-03-02"},
		{Name: "Car insurance", Amount: 540, Every: "", Cycle: "every 6 months", Next: "2027-01-15"},
		{Name: "Hulu", Amount: 7.99, Every: "month", Cycle: "every month", Off: true},
		{Name: "Gym", Amount: 12, Every: "2 weeks", Cycle: "every 2 weeks", Next: "2026-11-03"},
		{Name: "Odd", Amount: 0, Every: "", Cycle: "an unknown rhythm"},
	}
	if err != nil || len(got) != len(want) {
		t.Fatalf("read %+v %v", got, err)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("%d: %+v, want %+v", i, got[i], want[i])
		}
	}
	if path != "/api/subscriptions/get_subscriptions.php" || !strings.Contains(query, "convert_currency=true") {
		t.Errorf("asked %s ? %s", path, query)
	}
	srv.Close()
	if _, err := a.FinancesFromWallos(); err == nil || !strings.Contains(err.Error(), "does not answer") || strings.Contains(err.Error(), "good") {
		t.Errorf("no answer: %v", err)
	}
	if got := saved(map[string]string{"WALLOS_PORT": "9001"}); got != "http://127.0.0.1:9001/api" {
		t.Errorf("the base: %s", got)
	}
	if got := saved(map[string]string{}); got != "http://127.0.0.1:8282/api" {
		t.Errorf("the default base: %s", got)
	}
}

// Each rhythm Wallos keeps, as Finances keeps it or named.
func TestWallosEvery(t *testing.T) {
	for _, c := range []struct {
		cycle, every int
		want, words  string
	}{
		{2, 1, "week", "every week"}, {2, 2, "2 weeks", "every 2 weeks"}, {3, 1, "month", "every month"}, {3, 0, "month", "every month"},
		{3, 3, "3 months", "every 3 months"}, {3, 12, "year", "every 12 months"}, {4, 1, "year", "every year"},
		{1, 1, "", "every day"}, {3, 6, "", "every 6 months"}, {4, 2, "", "every 2 years"}, {9, 1, "", "an unknown rhythm"},
	} {
		if got, words := wallosEvery(c.cycle, c.every); got != c.want || words != c.words {
			t.Errorf("%d×%d: %q %q", c.cycle, c.every, got, words)
		}
	}
}
