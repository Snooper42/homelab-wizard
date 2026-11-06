package main

import (
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
