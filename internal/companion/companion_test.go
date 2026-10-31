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

func TestPairing(t *testing.T) {
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	s := NewStore(filepath.Join(t.TempDir(), "phones.json"))
	s.Now = func() time.Time { return now }
	code, err := s.NewPairing("Anna's iPhone", false, "")
	if err != nil || len(code) != 8 {
		t.Fatalf("code %q %v", code, err)
	}
	if _, _, err := s.Pair("WRONG123", ""); err != ErrBadCode {
		t.Fatalf("a wrong code: %v", err)
	}
	d, token, err := s.Pair(strings.ToLower(code[:4])+" "+code[4:], "ignored")
	if err != nil || d.Name != "Anna's iPhone" || d.CanChange || token == "" {
		t.Fatalf("pair: %+v %q %v", d, token, err)
	}
	if _, _, err := s.Pair(code, ""); err != ErrBadCode {
		t.Fatalf("a code works once: %v", err)
	}
	if got, ok := s.Lookup(token); !ok || got.ID != d.ID || !got.LastSeen.Equal(now) {
		t.Fatalf("lookup: %+v %v", got, ok)
	}
	if _, ok := s.Lookup("not-a-token"); ok {
		t.Fatal("a wrong token works")
	}

	// Codes expire.
	late, _ := s.NewPairing("", true, "")
	now = now.Add(PairFor + time.Second)
	if _, _, err := s.Pair(late, ""); err != ErrBadCode {
		t.Fatalf("an expired code works: %v", err)
	}

	if d, err := s.SetCanChange("anna's iphone", true); err != nil || !d.CanChange {
		t.Fatalf("allow: %+v %v", d, err)
	}
	if _, err := s.Remove(d.ID); err != nil {
		t.Fatal(err)
	}
	if _, ok := s.Lookup(token); ok || len(s.Devices()) != 0 {
		t.Fatal("a removed phone still works")
	}
}

func TestLocal(t *testing.T) {
	for addr, want := range map[string]bool{
		"127.0.0.1:5000":       true,
		"10.0.0.42:5000":       true,
		"192.168.1.9:5000":     true,
		"172.18.0.5:5000":      true,
		"100.101.102.103:5000": true,
		"0.250.250.254:5000":   true,
		"[::1]:5000":           true,
		"[fd7a:115c::1]:5000":  true,
		"8.8.8.8:5000":         false,
		"[2001:db8::1]:5000":   false,
	} {
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r.RemoteAddr = addr
		if got := Local(r); got != want {
			t.Errorf("%s: %v, want %v", addr, got, want)
		}
	}
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "172.18.0.5:5000"
	r.Header.Set("Cf-Connecting-Ip", "8.8.8.8")
	if Local(r) {
		t.Error("a request through Cloudflare is let in")
	}
}

func TestServer(t *testing.T) {
	store := NewStore(filepath.Join(t.TempDir(), "phones.json"))
	changed := false
	s := &Server{Store: store, Files: fstest.MapFS{
		"index.html": {Data: []byte(`<html lang="en"><head></head><body><script src="app.js"></script></body></html>`)},
		"app.js":     {Data: []byte("//")},
	}, Methods: map[string]Method{
		"Status": {Call: func(context.Context, []json.RawMessage) (any, []string, error) {
			return map[string]int{"apps": 3}, nil, nil
		}},
		"AppAction": {Change: true, Call: func(_ context.Context, args []json.RawMessage) (any, []string, error) {
			changed = len(args) == 2
			return nil, []string{"$ homelab restart x"}, nil
		}},
	}}
	srv := httptest.NewServer(s.Handler()) // from 127.0.0.1
	defer srv.Close()
	do := func(method, path, token, body string) (int, map[string]any) {
		t.Helper()
		req, _ := http.NewRequest(method, srv.URL+path, strings.NewReader(body))
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		var out map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&out)
		return resp.StatusCode, out
	}

	if code, _ := do("POST", "/api/call/Status", "", "[]"); code != 401 {
		t.Fatalf("unpaired: %d", code)
	}
	pairCode, _ := store.NewPairing("", false, "")
	code, out := do("POST", "/api/pair", "", `{"code":"`+pairCode+`","name":"Kitchen iPad"}`)
	token, _ := out["token"].(string)
	if code != 200 || token == "" {
		t.Fatalf("pair: %d %v", code, out)
	}
	if code, out := do("POST", "/api/call/Status", token, "[]"); code != 200 || out["result"].(map[string]any)["apps"] != float64(3) {
		t.Fatalf("status: %d %v", code, out)
	}
	if code, out := do("GET", "/api/me", token, ""); code != 200 || out["name"] != "Kitchen iPad" || out["canChange"] != false {
		t.Fatalf("me: %d %v", code, out)
	}
	if code, _ := do("POST", "/api/call/AppAction", token, `["vikunja","restart"]`); code != 403 || changed {
		t.Fatalf("a read-only phone made a change: %d", code)
	}
	if code, _ := do("POST", "/api/call/SaveSettings", token, `[{}]`); code != 404 {
		t.Fatalf("a method not on the phone: %d", code)
	}
	d := store.Devices()[0]
	if _, err := store.SetCanChange(d.ID, true); err != nil {
		t.Fatal(err)
	}
	if code, out := do("POST", "/api/call/AppAction", token, `["vikunja","restart"]`); code != 200 || !changed || out["log"] == nil {
		t.Fatalf("allowed change: %d %v", code, out)
	}

	// A screen paired in kiosk mode is read-only, whatever its code allowed.
	kioskCode, _ := store.NewPairing("Hall TV", true, "")
	if code, out := do("POST", "/api/pair", "", `{"code":"`+kioskCode+`","kiosk":true}`); code != 200 || out["device"].(map[string]any)["canChange"] != false {
		t.Fatalf("kiosk pair: %d %v", code, out)
	}
	for _, p := range store.Devices() {
		if p.Name == "Hall TV" && p.CanChange {
			t.Error("a kiosk screen was kept able to make changes")
		}
	}

	// Wrong codes are counted; after MaxFailures pairing waits.
	for i := 0; i < MaxFailures; i++ {
		if code, _ := do("POST", "/api/pair", "", `{"code":"NOPE"}`); code != 403 {
			t.Fatalf("wrong code %d: %d", i, code)
		}
	}
	good, _ := store.NewPairing("", false, "")
	if code, _ := do("POST", "/api/pair", "", `{"code":"`+good+`"}`); code != 429 {
		t.Fatalf("after %d wrong codes: %d", MaxFailures, code)
	}

	// The page gets the companion's script before app.js.
	resp, err := http.Get(srv.URL + "/")
	if err != nil {
		t.Fatal(err)
	}
	var page strings.Builder
	buf := make([]byte, 4096)
	n, _ := resp.Body.Read(buf)
	page.Write(buf[:n])
	resp.Body.Close()
	if !strings.Contains(page.String(), `<script src="companion.js"></script>`+"\n"+`<script src="app.js">`) || !strings.Contains(page.String(), `class="companion"`) || !strings.Contains(page.String(), "manifest.webmanifest") {
		t.Fatalf("page:\n%s", page.String())
	}
	if resp.Header.Get("Content-Security-Policy") == "" {
		t.Error("no CSP")
	}
}

func TestLinks(t *testing.T) {
	got := Links(map[string]string{"HOMELAB_DOMAIN": "example.com", "TAILSCALE_HOST": "homelab.tail1.ts.net"}, "192.168.1.10", "ABCD2345")
	want := []string{"https://homelab.example.com/#pair=ABCD2345", "http://192.168.1.10:8099/#pair=ABCD2345"}
	if strings.Join(got, " ") != strings.Join(want, " ") {
		t.Errorf("domain: %v", got)
	}
	if got := Links(map[string]string{"TAILSCALE_HOST": "homelab.tail1.ts.net"}, "", "X"); len(got) != 2 || got[0] != "https://homelab.tail1.ts.net:8099/#pair=X" || !strings.Contains(got[1], ".local:8099/#pair=X") {
		t.Errorf("home mode: %v", got)
	}
}

func TestQR(t *testing.T) {
	text, err := QRText("https://homelab.tail1.ts.net:8099/#pair=ABCD2345")
	if err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(strings.TrimSuffix(text, "\n"), "\n")
	// A square of at least 21 modules plus the quiet zone, two rows to a line.
	if w := len([]rune(lines[0])); w < 21+2*quiet || len(lines) != (w+1)/2 {
		t.Errorf("%d lines of %d", len(lines), w)
	}
	u, err := QRDataURL("x")
	if err != nil || !strings.HasPrefix(u, "data:image/svg+xml;base64,") {
		t.Errorf("%q %v", u[:30], err)
	}
}

func TestEventsForPairedPhones(t *testing.T) {
	store := NewStore(filepath.Join(t.TempDir(), "phones.json"))
	code, _ := store.NewPairing("Anna's iPhone", false, "")
	_, token, err := store.Pair(code, "")
	if err != nil {
		t.Fatal(err)
	}
	hub := &engine.Hub{}
	srv := httptest.NewServer((&Server{Store: store, Changes: hub, Files: fstest.MapFS{}}).Handler())
	defer srv.Close()
	get := func(token string) *http.Response {
		req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/events", nil)
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		return resp
	}
	if resp := get(""); resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("unpaired: %s", resp.Status)
	}
	resp := get(token)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("paired: %s", resp.Status)
	}
	for hub.Subscribers() == 0 {
		time.Sleep(10 * time.Millisecond)
	}
	hub.Publish(engine.Change{Apps: []string{"immich"}})
	sc := bufio.NewScanner(resp.Body)
	for sc.Scan() {
		if data, ok := strings.CutPrefix(sc.Text(), "data: "); ok {
			if data != `{"apps":["immich"]}` {
				t.Errorf("change: %s", data)
			}
			return
		}
	}
	t.Fatal("no change streamed")
}

// A phone paired over plain HTTP from the home network may only look, for
// good; one paired through https may be allowed changes.
func TestPairingOverTheHomeWiFiIsReadOnly(t *testing.T) {
	store := NewStore(filepath.Join(t.TempDir(), "phones.json"))
	s := &Server{Store: store, Methods: map[string]Method{
		"AppAction": {Change: true, Call: func(context.Context, []json.RawMessage) (any, []string, error) { return nil, nil, nil }},
	}}
	h := s.Handler()
	do := func(path, body, token string, hdr map[string]string) (int, map[string]any) {
		t.Helper()
		r := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
		r.RemoteAddr = "192.168.1.20:52000"
		if token != "" {
			r.Header.Set("Authorization", "Bearer "+token)
		}
		for k, v := range hdr {
			r.Header.Set(k, v)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		var out map[string]any
		_ = json.NewDecoder(w.Body).Decode(&out)
		return w.Code, out
	}

	code, _ := store.NewPairing("Anna's iPhone", true, "")
	if status, out := do("/api/pair", `{"code":"`+code+`"}`, "", nil); status != 200 || out["device"].(map[string]any)["canChange"] != false {
		t.Fatalf("plain pair: %d %v", status, out)
	}
	phone := store.Phones()[0]
	if !phone.Unencrypted || phone.CanChange {
		t.Fatalf("plain pair kept: %+v", phone)
	}
	if _, err := store.SetCanChange(phone.ID, true); !errors.Is(err, ErrUnencrypted) {
		t.Errorf("allowed changes to a phone paired without encryption: %v", err)
	}

	code, _ = store.NewPairing("Ben's iPhone", true, "")
	status, out := do("/api/pair", `{"code":"`+code+`"}`, "", map[string]string{"X-Forwarded-Proto": "https"})
	if status != 200 || out["device"].(map[string]any)["canChange"] != true {
		t.Fatalf("https pair: %d %v", status, out)
	}
	token := out["token"].(string)
	// Its token sent over plain HTTP from the home network makes no change.
	if status, _ := do("/api/call/AppAction", `["vikunja","restart"]`, token, nil); status != 403 {
		t.Errorf("a change over plain HTTP: %d", status)
	}
	if status, _ := do("/api/call/AppAction", `["vikunja","restart"]`, token, map[string]string{"X-Forwarded-Proto": "https"}); status != 200 {
		t.Errorf("a change over https: %d", status)
	}
}

// A Stream method answers in lines as they come: the result reaches the
// phone while the slow event is still being read.
func TestStreamMethod(t *testing.T) {
	store := NewStore(filepath.Join(t.TempDir(), "phones.json"))
	slow := make(chan struct{})
	s := &Server{Store: store, Methods: map[string]Method{
		"StatusBoard": {Stream: func(_ context.Context, args []json.RawMessage, result func(any, error), event func(string, any)) {
			event("status:card", "quick")
			result(map[string]int{"apps": len(args)}, nil)
			<-slow
			event("status:card", "slow")
		}},
	}}
	srv := httptest.NewServer(s.Handler())
	defer srv.Close()
	pairCode, _ := store.NewPairing("", false, "")
	_, token, err := store.Pair(pairCode, "Phone")
	if err != nil {
		t.Fatal(err)
	}
	req, _ := http.NewRequest("POST", srv.URL+"/api/call/StatusBoard", strings.NewReader(`[1, ["watchdog"]]`))
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.Header.Get("Content-Type") != "application/x-ndjson" {
		t.Fatalf("%q", resp.Header.Get("Content-Type"))
	}
	dec := json.NewDecoder(resp.Body)
	var lines []map[string]any
	for range 2 {
		var l map[string]any
		if err := dec.Decode(&l); err != nil {
			t.Fatal(err)
		}
		lines = append(lines, l)
	}
	if lines[0]["event"] != "status:card" || lines[0]["data"] != "quick" || lines[1]["result"].(map[string]any)["apps"] != float64(2) {
		t.Fatalf("before the slow one: %v", lines)
	}
	close(slow)
	var last map[string]any
	if err := dec.Decode(&last); err != nil || last["data"] != "slow" {
		t.Fatalf("%v %v", last, err)
	}
}

// Finances reach only the phones allowed them, and only encrypted: a
// phone sees none until allowed, one allowed to look cannot save, a wall
// screen and a phone paired over the home Wi-Fi never see them, and a
// method learns which phone called it.
func TestFinancesOnPhones(t *testing.T) {
	store := NewStore(filepath.Join(t.TempDir(), "phones.json"))
	var savedBy string
	s := &Server{Store: store, Methods: map[string]Method{
		"Finances": {Finances: FinancesView, Call: func(ctx context.Context, _ []json.RawMessage) (any, []string, error) {
			d, _ := Caller(ctx)
			return map[string]string{"for": d.Name, "level": d.Finances}, nil, nil
		}},
		"SaveFinances": {Finances: FinancesEdit, Call: func(ctx context.Context, _ []json.RawMessage) (any, []string, error) {
			d, _ := Caller(ctx)
			savedBy = d.Name
			return nil, nil, nil
		}},
	}}
	h := s.Handler()
	do := func(path, body, token string, encrypted bool) (int, map[string]any) {
		t.Helper()
		r := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
		r.RemoteAddr = "192.168.1.20:52000"
		if encrypted {
			r.Header.Set("X-Forwarded-Proto", "https")
		}
		if token != "" {
			r.Header.Set("Authorization", "Bearer "+token)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		var out map[string]any
		_ = json.NewDecoder(w.Body).Decode(&out)
		return w.Code, out
	}
	pair := func(name string, finances string, kiosk, encrypted bool) (string, Me) {
		t.Helper()
		code, err := store.NewPairing(name, false, finances)
		if err != nil {
			t.Fatal(err)
		}
		status, out := do("/api/pair", `{"code":"`+code+`","kiosk":`+map[bool]string{true: "true", false: "false"}[kiosk]+`}`, "", encrypted)
		if status != 200 {
			t.Fatalf("pair %s: %d %v", name, status, out)
		}
		var me Me
		raw, _ := json.Marshal(out["device"])
		_ = json.Unmarshal(raw, &me)
		return out["token"].(string), me
	}

	if _, err := store.NewPairing("x", false, "sometimes"); err == nil {
		t.Error("a pairing with an unknown Finances level")
	}

	// Paired without Finances: none, whatever it asks.
	plain, me := pair("Ben's iPhone", "", false, true)
	if me.Finances != "" {
		t.Fatalf("finances without asking: %+v", me)
	}
	if status, out := do("/api/call/Finances", "[]", plain, true); status != 403 || !strings.Contains(out["error"].(string), "cannot see Finances") {
		t.Errorf("finances to a phone not allowed them: %d %v", status, out)
	}

	// Allowed to look: it reads them, encrypted only, and cannot save.
	looker, me := pair("Anna's iPhone", "VIEW", false, true)
	if me.Finances != FinancesView {
		t.Fatalf("view pairing: %+v", me)
	}
	if status, out := do("/api/call/Finances", "[]", looker, true); status != 200 || out["result"].(map[string]any)["for"] != "Anna's iPhone" {
		t.Errorf("finances to a phone allowed to look: %d %v", status, out)
	}
	if status, _ := do("/api/call/Finances", "[]", looker, false); status != 403 {
		t.Errorf("finances over plain HTTP: %d", status)
	}
	if status, out := do("/api/call/SaveFinances", "[{}]", looker, true); status != 403 || savedBy != "" || !strings.Contains(out["error"].(string), "not change them") {
		t.Errorf("a save from a phone allowed only to look: %d %v", status, out)
	}

	// Allowed to edit: it saves, and the method knows who saved.
	if d, err := store.SetFinances("anna's iphone", FinancesEdit); err != nil || d.Finances != FinancesEdit {
		t.Fatalf("set edit: %+v %v", d, err)
	}
	if status, out := do("/api/call/SaveFinances", "[{}]", looker, true); status != 200 || savedBy != "Anna's iPhone" {
		t.Errorf("a save from a phone allowed to edit: %d %v (by %q)", status, out, savedBy)
	}
	if status, out := do("/api/me", "", looker, true); status != 200 || out["finances"] != FinancesEdit {
		t.Errorf("me after edit: %d %v", status, out)
	}
	if d, _ := store.SetFinances("Anna's iPhone", "off"); d.Finances != "" {
		t.Errorf("off: %+v", d)
	}
	if status, _ := do("/api/call/Finances", "[]", looker, true); status != 403 {
		t.Errorf("finances after off: %d", status)
	}

	// A wall screen never shows them, whatever its code said.
	if _, me := pair("Hall TV", FinancesEdit, true, true); me.Finances != "" {
		t.Errorf("a kiosk screen kept Finances: %+v", me)
	}
	// Nor a phone paired over the home Wi-Fi, now or later.
	_, me = pair("Guest phone", FinancesView, false, false)
	if me.Finances != "" {
		t.Errorf("a phone paired without encryption kept Finances: %+v", me)
	}
	if _, err := store.SetFinances("Guest phone", FinancesView); !errors.Is(err, ErrNoFinances) {
		t.Errorf("finances allowed to a phone paired without encryption: %v", err)
	}
	if _, err := store.SetFinances("nobody", FinancesView); err == nil {
		t.Error("finances for an unknown phone")
	}
	if _, err := store.SetFinances("Ben's iPhone", "all of it"); err == nil {
		t.Error("an unknown Finances level")
	}
	for _, p := range store.Phones() {
		if p.Name == "Anna's iPhone" && p.Finances != "" {
			t.Errorf("phones list: %+v", p)
		}
	}
}
