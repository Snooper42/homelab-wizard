package claim

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
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
		{"calibre-web", "/opds", ``, 302, true, false},                         // a new one sends the default login to its setup page
		{"calibre-web", "/opds", ``, 429, false, false},                        // turning sign-ins away: cannot tell
		{"immich-server", "/api/server/config", `not json`, 200, false, false}, // can't tell: not yet
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
