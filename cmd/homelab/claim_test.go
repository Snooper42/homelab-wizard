package main

import (
	"context"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// A public app whose first account anyone can make (Immich's first sign-up
// is its administrator) goes on the internet only once it has one: before
// that, the first stranger to open photos.example.com would own it.
func TestAnUnclaimedAppStaysOffTheInternet(t *testing.T) {
	initialized := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/server/config" {
			if initialized {
				_, _ = w.Write([]byte(`{"isInitialized":true,"isOnboarded":true}`))
			} else {
				_, _ = w.Write([]byte(`{"isInitialized":false,"isOnboarded":false}`))
			}
			return
		}
		w.WriteHeader(404)
	}))
	defer srv.Close()
	u, _ := url.Parse(srv.URL)
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_immich-immich-server-1", Image: "x", Running: true, Health: "healthy", Project: "homelab_immich", Service: "immich-server"},
	})
	token := base64.StdEncoding.EncodeToString([]byte(`{"a":"acct","t":"tun-1","s":"c2VjcmV0"}`))
	root, _ := repoCopy(t, "IMMICH_PORT="+u.Port(), "TUNNEL_TOKEN="+token, "HOMELAB_DOMAIN=example.com")
	out, _ := homelabCmd(t, root, "", "domain", "status")
	if strings.Contains(out, "public apps: photos.example.com") || !strings.Contains(out, "Immich stays off the internet until it has its first account") {
		t.Fatalf("an Immich no one has signed up to is public:\n%s", out)
	}
	initialized = true
	if out, _ = homelabCmd(t, root, "", "domain", "status"); !strings.Contains(out, "public apps: photos.example.com") {
		t.Fatalf("Immich with its first account is not public:\n%s", out)
	}
}

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
		got, why := claimedAt(context.Background(), c.app, srv.URL)
		srv.Close()
		if got != c.want {
			t.Errorf("%s answering %d %q: claimed %v (%s), want %v", c.app, c.status, c.answer, got, why, c.want)
		}
	}
	if ok, _ := claimedAt(context.Background(), "vaultwarden", "http://127.0.0.1:1"); !ok {
		t.Error("an app no one can claim from the web held back")
	}
}
