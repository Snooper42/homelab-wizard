package claim

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
)

// How each app that can be claimed says whether it has been.
func TestClaimed(t *testing.T) {
	for _, c := range []struct {
		app, path, answer string
		status            int
		basic             bool // the default login still opens it
		want              bool
	}{
		{"immich-server", "/api/server/config", `{"isInitialized":true}`, 200, false, true},
		{"immich-server", "/api/server/config", `{"isInitialized":false}`, 200, false, false},
		{"audiobookshelf", "/status", `{"app":"audiobookshelf","isInit":false}`, 200, false, false},
		{"audiobookshelf", "/status", `{"app":"audiobookshelf","isInit":true}`, 200, false, true},
		{"komga", "/api/v1/claim", `{"isClaimed":false}`, 200, false, false},
		{"komga", "/api/v1/claim", `{"isClaimed":true}`, 200, false, true},
		{"navidrome", "/app/", `<script>window.__APP_CONFIG__ = "{\"firstTime\":true,\"version\":\"0.53\"}"</script>`, 200, false, false},
		{"navidrome", "/app/", `<script>window.__APP_CONFIG__ = "{\"firstTime\":false,\"version\":\"0.53\"}"</script>`, 200, false, true},
		{"calibre-web", "/opds", `<feed/>`, 200, true, false},
		{"calibre-web", "/opds", ``, 401, false, true},
		{"calibre-web", "/opds", ``, 302, true, false},  // a new one sends the default login to its setup page
		{"calibre-web", "/opds", ``, 429, false, false}, // turning sign-ins away: cannot tell
		{"paperless", "/accounts/signup/", `<p>Note: This is the first user account for this installation and will be granted superuser privileges.</p><input name="password1">`, 200, false, false},
		{"paperless", "/accounts/signup/", `<h1>Sign Up Closed</h1>`, 200, false, true},                         // its first account exists, sign-ups off
		{"paperless", "/accounts/signup/", `<input name="username"><input name="password1">`, 200, false, true}, // sign-ups allowed by the household, after its first account
		{"immich-server", "/api/server/config", `not json`, 200, false, false},                                  // can't tell: not yet
		{"immich-server", "/api/server/config", ``, 500, false, false},
	} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != c.path {
				w.WriteHeader(404)
				return
			}
			if user, pass, ok := r.BasicAuth(); c.basic && !(ok && user == "admin" && pass == "admin123") {
				w.WriteHeader(401)
				return
			}
			w.WriteHeader(c.status)
			_, _ = w.Write([]byte(c.answer))
		}))
		got, why := Claimed(context.Background(), c.app, srv.URL)
		srv.Close()
		if got != c.want {
			t.Errorf("%s answering %d %q: claimed %v (%s), want %v", c.app, c.status, c.answer, got, why, c.want)
		}
	}
	if ok, _ := Claimed(context.Background(), "vaultwarden", "http://127.0.0.1:1"); !ok {
		t.Error("an app no one can claim from the web held back")
	}
}

// The question (Calibre-Web's carries its default login) goes only to this
// machine's loopback: an address elsewhere is never asked.
func TestAskedOnlyOnThisMachine(t *testing.T) {
	for _, base := range []string{"http://192.0.2.10:8083", "http://example.com:8083", "https://127.0.0.1:8083", "http://user:pw@127.0.0.1:8083", "http://127.0.0.1", "not a url"} {
		if ok, why := Claimed(context.Background(), "calibre-web", base); ok || why == "" {
			t.Errorf("%s: claimed %v (%q), want held back", base, ok, why)
		}
	}
	if got, ok := onThisMachine("http://localhost:2283/", "/api/server/config"); !ok || got != "http://127.0.0.1:2283/api/server/config" {
		t.Errorf("localhost: %q %v", got, ok)
	}
}

// Every public app is safe from the first stranger to open it: it makes
// its first account from .env (login:), it is asked whether it has one
// before it goes through the tunnel (a claim check), or no one can make an
// account from the web at all (named here, with why). A new public app
// that is none of these fails here rather than going out unclaimed.
func TestEveryPublicAppIsClaimedBeforeItIsPublic(t *testing.T) {
	noWebAccount := map[string]string{
		"vaultwarden": "sign-ups are off (VAULTWARDEN_SIGNUPS_ALLOWED=false); people are invited",
		"ntfy":        "NTFY_AUTH_DEFAULT_ACCESS=deny-all; users are made with its own command",
		"feishin":     "a player for Navidrome, with no accounts of its own",
	}
	c, err := catalog.Load("../..")
	if err != nil {
		t.Fatal(err)
	}
	n := 0
	for _, a := range c.Apps {
		if !a.Public() {
			continue
		}
		n++
		_, checked := claimChecks[a.ID]
		if !checked && len(a.Meta.Login) == 0 && noWebAccount[a.ID] == "" {
			t.Errorf("%s is public, but nothing keeps a stranger from making its first account: give it a login from .env, a claim check, or say why no one can", a.ID)
		}
	}
	if n < 5 {
		t.Errorf("only %d public apps: the test no longer sees them", n)
	}
}
