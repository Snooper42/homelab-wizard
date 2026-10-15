package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

func TestAdGuardSetupAnswersTheWizard(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{
		{Name: "adguard-home", Image: "adguard/adguardhome:latest", Running: true, Project: "homelab_network", Service: "adguard-home"},
		{Name: "tailscale", Image: "tailscale/tailscale:latest", Running: true, Project: "homelab_network", Service: "tailscale"},
		{Name: "tailnet-dns", Image: "alpine/socat:latest", Running: true, Project: "homelab_network", Service: "tailnet-dns"},
	})
	var user, password string
	wizard := true
	setupSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !wizard {
			w.WriteHeader(404)
			return
		}
		if r.URL.Path == "/control/install/configure" {
			var body struct{ Username, Password string }
			_ = json.NewDecoder(r.Body).Decode(&body)
			user, password, wizard = body.Username, body.Password, false
		}
	}))
	defer setupSrv.Close()
	admin := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if u, p, _ := r.BasicAuth(); wizard || u != user || p != password {
			w.WriteHeader(401)
		}
	}))
	defer admin.Close()
	port := func(s *httptest.Server) string { u, _ := url.Parse(s.URL); return u.Port() }
	root, _ := repoCopy(t, "HOMELAB_DOMAIN=", "ADGUARD_PORT="+port(admin), "ADGUARD_SETUP_PORT="+port(setupSrv), "ADGUARD_PASSWORD=")

	out, code := homelabCmd(t, root, "", "adguard", "setup")
	if code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	env, _ := envfile.Load(filepath.Join(root, ".env"))
	if v, _ := env.Get("ADGUARD_PASSWORD"); v == "" || v != password || user != "admin" {
		t.Errorf("the generated login (%q) is not the one AdGuard got (%q, %q)", v, user, password)
	}
	if !strings.Contains(out, "100.101.102.103") || !strings.Contains(out, "Override DNS servers") {
		t.Errorf("the tailnet DNS setting is missing:\n%s", out)
	}

	// Run again: the wizard is done and the login in .env works.
	if out, code = homelabCmd(t, root, "", "adguard", "setup"); code != 0 || !strings.Contains(out, "accepts the login") {
		t.Errorf("second run (exit %d):\n%s", code, out)
	}
}

func TestAdGuardSetupWithoutAdGuard(t *testing.T) {
	fakeDocker(t, nil)
	root, _ := repoCopy(t, "HOMELAB_DOMAIN=")
	if out, code := homelabCmd(t, root, "", "adguard", "setup"); code == 0 || !strings.Contains(out, "@adblock") {
		t.Errorf("exit %d:\n%s", code, out)
	}
	if out, code := homelabCmd(t, root, "", "adguard", "setup", "--auto"); code != 0 {
		t.Errorf("auto must stay quiet (exit %d):\n%s", code, out)
	}
}
