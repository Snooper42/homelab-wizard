package companion

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
)

// TestMeSaysWhatTheComputerCanDo: /api/me names the computer's version and
// every call it answers, so a phone newer than the computer hides what the
// computer lacks and says to update it, rather than failing.
func TestMeSaysWhatTheComputerCanDo(t *testing.T) {
	store := NewStore(t.TempDir() + "/phones.json")
	noop := Method{Call: func(context.Context, []json.RawMessage) (any, []string, error) { return nil, nil, nil }}
	s := &Server{Store: store, Version: "0.27.9", Methods: map[string]Method{"Status": noop, "Catalog": noop, "AppAction": {Change: true, Call: noop.Call}}}
	srv := httptest.NewServer(s.Handler())
	defer srv.Close()
	code, _ := store.NewPairing("", false, "")
	_, token, err := store.Pair(code, "Phone")
	if err != nil {
		t.Fatal(err)
	}
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/me", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var me Me
	if err := json.NewDecoder(resp.Body).Decode(&me); err != nil || me.Computer == nil {
		t.Fatalf("me: %v %+v", err, me)
	}
	if me.Computer.Version != "0.27.9" || !slices.Equal(me.Computer.Methods, []string{"AppAction", "Catalog", "Status"}) || !slices.Equal(me.Computer.Features, []string{"tunnel", "away"}) {
		t.Fatalf("computer: %+v", me.Computer)
	}
	// Through the tunnel, the same.
	if a := s.tunnelCall(httptest.NewRequest(http.MethodPost, "/api/tunnel", nil), Device{ID: "x"}, TunnelRequest{Method: "me"}); a.Status != 200 || a.Result.(Me).Computer == nil {
		t.Fatalf("me through the tunnel: %+v", a)
	}
}
