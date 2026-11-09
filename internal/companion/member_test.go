package companion

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/engine"
)

// A household member's phone calls only the methods marked Member; every
// other answers it 403, whatever else it may do. The owner's phone is as
// before.
func TestAMembersPhoneCallsOnlyMemberMethods(t *testing.T) {
	store := NewStore(filepath.Join(t.TempDir(), "phones.json"))
	s := &Server{Store: store, Methods: map[string]Method{
		"Status":   {Member: true, Call: func(ctx context.Context, _ []json.RawMessage) (any, []string, error) { d, _ := Caller(ctx); return d.Person, nil, nil }},
		"Backups":  {Call: func(context.Context, []json.RawMessage) (any, []string, error) { return "all of them", nil, nil }},
		"Finances": {Member: true, Finances: FinancesView, Call: func(ctx context.Context, _ []json.RawMessage) (any, []string, error) { d, _ := Caller(ctx); return "plan of " + d.Person, nil, nil }},
	}}
	h := s.Handler()
	call := func(name, token string) (int, map[string]any) {
		t.Helper()
		r := httptest.NewRequest(http.MethodPost, "/api/call/"+name, strings.NewReader("[]"))
		r.RemoteAddr = "192.168.1.20:52000"
		r.Header.Set("X-Forwarded-Proto", "https")
		r.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		var out map[string]any
		_ = json.NewDecoder(w.Body).Decode(&out)
		return w.Code, out
	}
	pair := func(name string) (Device, string) {
		t.Helper()
		code, err := store.NewPairing(name, true, FinancesEdit)
		if err != nil {
			t.Fatal(err)
		}
		d, token, err := store.Pair(code, "")
		if err != nil {
			t.Fatal(err)
		}
		return d, token
	}
	owner, ownerToken := pair("Kait's iPhone")
	if code, _ := call("Backups", ownerToken); code != http.StatusOK {
		t.Errorf("the owner's phone: Backups %d", code)
	}
	wife, wifeToken := pair("Sam's iPhone")
	d, err := store.SetPerson(wife.ID, "sam", "Sam")
	if err != nil {
		t.Fatal(err)
	}
	if d.CanChange {
		t.Error("a member's phone kept Allow changes")
	}
	if _, err := store.SetCanChange(wife.ID, true); !errors.Is(err, ErrMember) {
		t.Errorf("Allow changes on a member's phone: %v", err)
	}
	if code, out := call("Backups", wifeToken); code != http.StatusForbidden || !strings.Contains(out["error"].(string), "Sam's phone") {
		t.Errorf("a member's phone: Backups %d %v", code, out)
	}
	if code, out := call("Status", wifeToken); code != http.StatusOK || out["result"] != "sam" {
		t.Errorf("a member's phone: Status %d %v", code, out)
	}
	if code, out := call("Finances", wifeToken); code != http.StatusOK || out["result"] != "plan of sam" {
		t.Errorf("a member's phone: Finances %d %v", code, out)
	}
	// /api/me says whose it is.
	r := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	r.RemoteAddr = "192.168.1.20:52000"
	r.Header.Set("Authorization", "Bearer "+wifeToken)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	var me Me
	_ = json.NewDecoder(w.Body).Decode(&me)
	if me.Person != "sam" || me.PersonName != "Sam" || me.CanChange {
		t.Errorf("me: %+v", me)
	}
	// Given back, it's the owner's again; a wall screen is nobody's.
	if d, err := store.SetPerson(wife.ID, "", "Sam"); err != nil || d.Person != "" || d.PersonName != "" {
		t.Errorf("given back: %+v %v", d, err)
	}
	if code, _ := call("Backups", wifeToken); code != http.StatusOK {
		t.Errorf("given back: Backups %d", code)
	}
	if _, err := store.MarkKiosk(owner.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := store.SetPerson(owner.ID, "sam", "Sam"); !errors.Is(err, ErrKiosk) {
		t.Errorf("a wall screen given to someone: %v", err)
	}
}

// A member's phone follows only what ForMember lets through, and nothing
// at all without it.
func TestAMembersPhoneFollowsOnlyItsOwnChanges(t *testing.T) {
	store := NewStore(filepath.Join(t.TempDir(), "phones.json"))
	code, _ := store.NewPairing("Sam's iPhone", false, "")
	d, token, err := store.Pair(code, "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.SetPerson(d.ID, "sam", "Sam"); err != nil {
		t.Fatal(err)
	}
	hub := &engine.Hub{}
	get := func(s *Server) *http.Response {
		srv := httptest.NewServer(s.Handler())
		t.Cleanup(srv.Close)
		req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/events", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		return resp
	}
	if resp := get(&Server{Store: store, Changes: hub, Files: fstest.MapFS{}}); resp.StatusCode != http.StatusNotFound {
		t.Errorf("no ForMember: %s", resp.Status)
	}
	only := func(_ Device, c engine.Change) (engine.Change, bool) {
		for _, id := range c.Apps {
			if id == "immich" {
				return engine.Change{Apps: []string{"immich"}}, true
			}
		}
		return engine.Change{}, false
	}
	resp := get(&Server{Store: store, Changes: hub, Files: fstest.MapFS{}, ForMember: only})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("with ForMember: %s", resp.Status)
	}
	for hub.Subscribers() == 0 {
		time.Sleep(10 * time.Millisecond)
	}
	hub.Publish(engine.Change{Apps: []string{"vaultwarden"}})
	hub.Publish(engine.Change{Apps: []string{"immich", "vaultwarden"}})
	sc := bufio.NewScanner(resp.Body)
	for sc.Scan() {
		if data, ok := strings.CutPrefix(sc.Text(), "data: "); ok {
			if data != `{"apps":["immich"]}` {
				t.Errorf("first change it saw: %s", data)
			}
			return
		}
	}
	t.Fatal("no change streamed")
}
