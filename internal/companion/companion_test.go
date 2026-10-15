package companion

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
	"time"
)

func TestPairing(t *testing.T) {
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	s := NewStore(filepath.Join(t.TempDir(), "phones.json"))
	s.Now = func() time.Time { return now }
	code, err := s.NewPairing("Anna's iPhone", false)
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
	late, _ := s.NewPairing("", true)
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
	pairCode, _ := store.NewPairing("", false)
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

	// Wrong codes are counted; after MaxFailures pairing waits.
	for i := 0; i < MaxFailures; i++ {
		if code, _ := do("POST", "/api/pair", "", `{"code":"NOPE"}`); code != 403 {
			t.Fatalf("wrong code %d: %d", i, code)
		}
	}
	good, _ := store.NewPairing("", false)
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
