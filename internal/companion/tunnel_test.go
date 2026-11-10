package companion

import (
	"context"
	"crypto"
	"crypto/ecdh"
	"crypto/hkdf"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// cfTeam is a Cloudflare Access team for the tests: its signing key, served
// as Cloudflare serves a team's keys.
type cfTeam struct {
	key   *rsa.PrivateKey
	other *rsa.PrivateKey // a key that isn't the team's
	acc   Access
}

func newCFTeam(t *testing.T) *cfTeam {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	other, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	team := &cfTeam{key: key, other: other, acc: Access{Team: "household", Audience: "aud-tag-1", ClientID: "client-id.access", Secret: "the-service-secret", Host: "homelab-away.example.com"}}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/cdn-cgi/access/certs" {
			http.NotFound(w, r)
			return
		}
		pub := key.PublicKey
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []map[string]string{{
			"kid": "k1", "kty": "RSA", "alg": "RS256",
			"n": base64.RawURLEncoding.EncodeToString(pub.N.Bytes()),
			"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(pub.E)).Bytes()),
		}}})
	}))
	t.Cleanup(srv.Close)
	oldCerts, oldClient := accessCerts, accessClient
	accessCerts = func(Access) string { return srv.URL + "/cdn-cgi/access/certs" }
	accessClient = srv.Client()
	t.Cleanup(func() { accessCerts, accessClient = oldCerts, oldClient })
	return team
}

// pass is a pass as Cloudflare signs one, with change applied to its claims.
func (c *cfTeam) pass(t *testing.T, signer *rsa.PrivateKey, change func(map[string]any)) string {
	t.Helper()
	claims := map[string]any{"iss": "https://household.cloudflareaccess.com", "aud": []string{"aud-tag-1"},
		"exp": time.Now().Add(time.Hour).Unix(), "nbf": time.Now().Add(-time.Minute).Unix(), "common_name": "client-id.access", "type": "app"}
	if change != nil {
		change(claims)
	}
	head, _ := json.Marshal(map[string]string{"alg": "RS256", "kid": "k1", "typ": "JWT"})
	body, _ := json.Marshal(claims)
	signed := base64.RawURLEncoding.EncodeToString(head) + "." + base64.RawURLEncoding.EncodeToString(body)
	sum := sha256.Sum256([]byte(signed))
	sig, err := rsa.SignPKCS1v15(rand.Reader, signer, crypto.SHA256, sum[:])
	if err != nil {
		t.Fatal(err)
	}
	return signed + "." + base64.RawURLEncoding.EncodeToString(sig)
}

// tunnelPhone is a phone paired at home with a key for away from home.
type tunnelPhone struct {
	id, token string
	key       []byte
}

// pairForTunnel pairs a phone over the given address, sending its X25519
// key as the iPhone app does, and works out the key as the phone would.
func pairForTunnel(t *testing.T, h http.Handler, s *Store, remote string, kiosk bool, finances string) (tunnelPhone, map[string]any) {
	t.Helper()
	code, err := s.NewPairing("Sam's iPhone", true, finances)
	if err != nil {
		t.Fatal(err)
	}
	priv, err := ecdh.X25519().GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	body, _ := json.Marshal(map[string]any{"code": code, "kiosk": kiosk, "key": base64.StdEncoding.EncodeToString(priv.PublicKey().Bytes())})
	r := httptest.NewRequest(http.MethodPost, "/api/pair", strings.NewReader(string(body)))
	r.RemoteAddr = remote
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("pair: %d %s", w.Code, w.Body)
	}
	var got map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &got)
	p := tunnelPhone{token: got["token"].(string), id: got["device"].(map[string]any)["id"].(string)}
	if k, ok := got["tunnelKey"].(string); ok {
		pub, _ := base64.StdEncoding.DecodeString(k)
		theirs, err := ecdh.X25519().NewPublicKey(pub)
		if err != nil {
			t.Fatal(err)
		}
		shared, _ := priv.ECDH(theirs)
		p.key, _ = hkdf.Key(sha256.New, shared, []byte(p.id), tunnelInfo, 32)
	}
	return p, got
}

// sealed is a request as the phone seals it.
func (p tunnelPhone) sealed(t *testing.T, at time.Time, method string, args ...any) string {
	t.Helper()
	var raw []json.RawMessage
	for _, a := range args {
		b, _ := json.Marshal(a)
		raw = append(raw, b)
	}
	plain, _ := json.Marshal(TunnelRequest{Token: p.token, At: at.UnixMilli(), Method: method, Args: raw})
	n, b, err := Seal(p.key, tunnelAsk+p.id, plain)
	if err != nil {
		t.Fatal(err)
	}
	out, _ := json.Marshal(Sealed{Device: p.id, Nonce: base64.StdEncoding.EncodeToString(n), Box: base64.StdEncoding.EncodeToString(b)})
	return string(out)
}

// throughCF sends body to path as Cloudflare's tunnel would deliver it.
func throughCF(h http.Handler, path, pass, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	r.RemoteAddr = "172.18.0.3:40000" // cloudflared, on the homelab's network
	r.Header.Set("Cf-Ray", "8f0-LHR")
	r.Header.Set("Cf-Connecting-Ip", "203.0.113.7")
	if pass != "" {
		r.Header.Set("Cf-Access-Jwt-Assertion", pass)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

// opened opens a sealed answer to body, as the phone does.
func (p tunnelPhone) opened(t *testing.T, w *httptest.ResponseRecorder, body string) TunnelAnswer {
	t.Helper()
	if w.Code != http.StatusOK {
		t.Fatalf("a sealed answer was expected: %d %s", w.Code, w.Body)
	}
	var req, out Sealed
	_ = json.Unmarshal([]byte(body), &req)
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(w.Body.String(), "Sam") || strings.Contains(w.Body.String(), "result") {
		t.Fatalf("the answer isn't sealed: %s", w.Body)
	}
	n, _ := base64.StdEncoding.DecodeString(out.Nonce)
	b, _ := base64.StdEncoding.DecodeString(out.Box)
	plain, err := Open(p.key, tunnelAnswer+p.id+"\x00"+req.Nonce, n, b)
	if err != nil {
		t.Fatalf("the answer doesn't open with the phone's key: %v", err)
	}
	var a TunnelAnswer
	_ = json.Unmarshal(plain, &a)
	return a
}

func tunnelServer(t *testing.T, acc *Access) (*Server, http.Handler) {
	t.Helper()
	s := &Server{Store: NewStore(filepath.Join(t.TempDir(), "phones.json")), Methods: map[string]Method{
		"Status":         {Member: true, Call: func(context.Context, []json.RawMessage) (any, []string, error) { return "all up", nil, nil }},
		"Restart":        {Change: true, Call: func(context.Context, []json.RawMessage) (any, []string, error) { return "restarted", nil, nil }},
		"Settings":       {Private: true, Call: func(context.Context, []json.RawMessage) (any, []string, error) { return "the settings", nil, nil }},
		"Follow":         {Stream: func(context.Context, []json.RawMessage, func(any, error), func(string, any)) {}},
		"FinancesRead":   {Finances: FinancesView, Call: func(context.Context, []json.RawMessage) (any, []string, error) { return "the plan", nil, nil }},
		"FinancesChange": {Finances: FinancesEdit, Call: func(context.Context, []json.RawMessage) (any, []string, error) { return "changed", nil, nil }},
	}}
	if acc != nil {
		s.Access = func() Access { return *acc }
	}
	return s, s.Handler()
}

// Away from home through the tunnel (ADR-0023): only a sealed look, from a
// phone paired at home, with Cloudflare Access's pass for the household's
// service token.
func TestTheTunnel(t *testing.T) {
	team := newCFTeam(t)
	s, h := tunnelServer(t, &team.acc)
	phone, _ := pairForTunnel(t, h, s.Store, "127.0.0.1:50000", false, FinancesView)
	if len(phone.key) != 32 {
		t.Fatal("pairing over the encrypted link gave no key for away from home")
	}
	good := team.pass(t, team.key, nil)
	now := time.Now()

	// It answers: me, Status, and Finances to look at, sealed both ways.
	body := phone.sealed(t, now, "me")
	if a := phone.opened(t, throughCF(h, TunnelPath, good, body), body); a.Status != http.StatusOK || !strings.Contains(mustJSON(a.Result), phone.id) {
		t.Fatalf("me through the tunnel: %+v", a)
	}
	body = phone.sealed(t, now, "Status")
	if a := phone.opened(t, throughCF(h, TunnelPath, good, body), body); a.Status != http.StatusOK || a.Result != "all up" {
		t.Fatalf("Status through the tunnel: %+v", a)
	}
	body = phone.sealed(t, now, "FinancesRead")
	if a := phone.opened(t, throughCF(h, TunnelPath, good, body), body); a.Status != http.StatusOK || a.Result != "the plan" {
		t.Fatalf("Finances to look at through the tunnel: %+v", a)
	}

	// Never a change, the settings, a stream, or more Finances than it has:
	// said to the phone, sealed.
	for _, m := range []string{"Restart", "Settings", "Follow", "FinancesChange", "NoSuchCall"} {
		body := phone.sealed(t, now, m)
		if a := phone.opened(t, throughCF(h, TunnelPath, good, body), body); a.Status == http.StatusOK || a.Error == "" {
			t.Errorf("%s through the tunnel: %+v", m, a)
		}
	}

	// Anything else through Cloudflare is refused, before any pass is read:
	// pairing, a plain call, the frontend, the events.
	for _, path := range []string{"/api/pair", "/api/call/Status", "/api/me", "/", "/api/events"} {
		if w := throughCF(h, path, good, "{}"); w.Code != http.StatusForbidden {
			t.Errorf("%s through Cloudflare: %d", path, w.Code)
		}
	}
}

// Lock 2: without Cloudflare Access's own pass for this application and the
// household's service token, nothing is opened.
func TestTheTunnelNeedsAccesssPass(t *testing.T) {
	team := newCFTeam(t)
	s, h := tunnelServer(t, &team.acc)
	phone, _ := pairForTunnel(t, h, s.Store, "127.0.0.1:50000", false, "")
	now := time.Now()
	for name, pass := range map[string]string{
		"no pass":               "",
		"not a pass":            "abc.def",
		"signed by another key": team.pass(t, team.other, nil),
		"another application":   team.pass(t, team.key, func(c map[string]any) { c["aud"] = "aud-tag-2" }),
		"another team":          team.pass(t, team.key, func(c map[string]any) { c["iss"] = "https://elsewhere.cloudflareaccess.com" }),
		"another service token": team.pass(t, team.key, func(c map[string]any) { c["common_name"] = "someone-else.access" }),
		"a person's login":      team.pass(t, team.key, func(c map[string]any) { delete(c, "common_name"); c["email"] = "a@example.com" }),
		"expired":               team.pass(t, team.key, func(c map[string]any) { c["exp"] = now.Add(-time.Hour).Unix() }),
		"not valid yet":         team.pass(t, team.key, func(c map[string]any) { c["nbf"] = now.Add(time.Hour).Unix() }),
	} {
		if w := throughCF(h, TunnelPath, pass, phone.sealed(t, now, "Status")); w.Code != http.StatusForbidden || strings.Contains(w.Body.String(), "box") {
			t.Errorf("%s: %d %s", name, w.Code, w.Body)
		}
	}

	// And with Access not set up on the computer, the tunnel is refused, as
	// it always was.
	_, off := tunnelServer(t, nil)
	if w := throughCF(off, TunnelPath, team.pass(t, team.key, nil), "{}"); w.Code != http.StatusForbidden {
		t.Errorf("no Access set up: %d", w.Code)
	}
}

// Locks 3 and 4: a valid pass alone opens nothing. The message must be
// sealed with the phone's key, carry its device token, be recent, and be
// new; a phone unpaired on the computer is cut off.
func TestTheTunnelNeedsThePhone(t *testing.T) {
	team := newCFTeam(t)
	s, h := tunnelServer(t, &team.acc)
	phone, _ := pairForTunnel(t, h, s.Store, "127.0.0.1:50000", false, "")
	other, _ := pairForTunnel(t, h, s.Store, "127.0.0.1:50001", false, "")
	good := team.pass(t, team.key, nil)
	now := time.Now()

	refused := func(name, body string) {
		t.Helper()
		if w := throughCF(h, TunnelPath, good, body); w.Code == http.StatusOK {
			t.Errorf("%s: answered %s", name, w.Body)
		}
	}
	// No device token, or another phone's, inside its own sealed box.
	noToken := phone
	noToken.token = ""
	refused("no device token", noToken.sealed(t, now, "Status"))
	stolen := phone
	stolen.token = other.token
	refused("another phone's token", stolen.sealed(t, now, "Status"))
	// Sealed with another phone's key, or a key made up.
	wrongKey := phone
	wrongKey.key = other.key
	refused("another phone's key", wrongKey.sealed(t, now, "Status"))
	// A box changed on the way.
	body := phone.sealed(t, now, "Status")
	var env Sealed
	_ = json.Unmarshal([]byte(body), &env)
	b, _ := base64.StdEncoding.DecodeString(env.Box)
	b[0] ^= 1
	env.Box = base64.StdEncoding.EncodeToString(b)
	tampered, _ := json.Marshal(env)
	refused("a changed box", string(tampered))
	// Too old, or from the future.
	refused("an old message", phone.sealed(t, now.Add(-TunnelSkew-time.Minute), "Status"))
	refused("a message from the future", phone.sealed(t, now.Add(TunnelSkew+time.Minute), "Status"))
	// The same message twice.
	again := phone.sealed(t, now, "Status")
	if w := throughCF(h, TunnelPath, good, again); w.Code != http.StatusOK {
		t.Fatalf("first time: %d", w.Code)
	}
	refused("a replayed message", again)

	// Unpaired on the computer: cut off at once.
	if _, err := s.Store.Remove(other.id); err != nil {
		t.Fatal(err)
	}
	refused("an unpaired phone", other.sealed(t, now, "Status"))
}

// Wrong attempts lock out, by address and by phone, for a while.
func TestTheTunnelLocksOutAfterWrongAttempts(t *testing.T) {
	team := newCFTeam(t)
	s, h := tunnelServer(t, &team.acc)
	phone, _ := pairForTunnel(t, h, s.Store, "127.0.0.1:50000", false, "")
	now := time.Now()
	clock := now
	s.Now = func() time.Time { return clock }
	forged := team.pass(t, team.other, nil)
	for range TunnelFailures {
		throughCF(h, TunnelPath, forged, phone.sealed(t, now, "Status"))
	}
	if w := throughCF(h, TunnelPath, team.pass(t, team.key, nil), phone.sealed(t, now, "Status")); w.Code != http.StatusTooManyRequests {
		t.Fatalf("after %d wrong attempts from one address: %d", TunnelFailures, w.Code)
	}
	clock = now.Add(TunnelLockout + time.Second)
	if w := throughCF(h, TunnelPath, team.pass(t, team.key, nil), phone.sealed(t, clock, "Status")); w.Code != http.StatusOK {
		t.Fatalf("once the lockout passed: %d %s", w.Code, w.Body)
	}
}

// The key for away from home is agreed only at home over a connection
// nobody on the Wi-Fi can read, and never for a wall screen.
func TestTheTunnelKeyIsGivenOnlyWhereItIsSafe(t *testing.T) {
	team := newCFTeam(t)
	s, h := tunnelServer(t, &team.acc)
	if _, got := pairForTunnel(t, h, s.Store, "192.168.1.20:52000", false, ""); got["tunnelKey"] != nil || got["away"] != nil {
		t.Error("a key, or the service token, over the plain home Wi-Fi")
	}
	if _, got := pairForTunnel(t, h, s.Store, "127.0.0.1:50000", true, ""); got["tunnelKey"] != nil || got["away"] != nil {
		t.Error("a key, or the service token, for a wall screen")
	}
	// A phone paired over the encrypted link learns how to go out: the
	// tunnel's address and the household's service token (lock 1).
	_, got := pairForTunnel(t, h, s.Store, "127.0.0.1:50001", false, "")
	away, _ := got["away"].(map[string]any)
	if away["url"] != "https://homelab-away.example.com"+TunnelPath || away["clientId"] != "client-id.access" || away["clientSecret"] != "the-service-secret" {
		t.Errorf("how to go out: %+v", got["away"])
	}
	if strings.Contains(mustJSON(s.Store.Phones()), "tunnel") {
		t.Error("the screens' list of phones shows a key")
	}
}

func mustJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

// Away from home the phone only looks (ADR-0023), Finances included: a
// phone allowed to edit Finances at home still only reads them through the
// tunnel, since the methods that write them aren't marked Change.
func TestTheTunnelNeverChangesFinances(t *testing.T) {
	team := newCFTeam(t)
	s, h := tunnelServer(t, &team.acc)
	phone, _ := pairForTunnel(t, h, s.Store, "127.0.0.1:50000", false, FinancesEdit)
	good := team.pass(t, team.key, nil)
	now := time.Now()
	body := phone.sealed(t, now, "FinancesRead")
	if a := phone.opened(t, throughCF(h, TunnelPath, good, body), body); a.Status != http.StatusOK || a.Result != "the plan" {
		t.Fatalf("Finances to look at through the tunnel: %+v", a)
	}
	body = phone.sealed(t, now, "FinancesChange")
	if a := phone.opened(t, throughCF(h, TunnelPath, good, body), body); a.Status != http.StatusForbidden || a.Result != nil {
		t.Fatalf("a Finances change through the tunnel, from a phone allowed to edit them: %+v", a)
	}
}
