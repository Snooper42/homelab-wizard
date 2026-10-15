package main

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/sso"
)

func TestSSOSetup(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "pocket-id", Image: "ghcr.io/pocket-id/pocket-id:v2", Running: true, Project: "homelab_security", Service: "pocket-id"},
		{Name: "karakeep", Image: "ghcr.io/karakeep-app/karakeep:release", Running: true, Project: "homelab_karakeep", Service: "karakeep"},
		{Name: "immich-server", Image: "ghcr.io/immich-app/immich-server:v3", Running: true, Project: "homelab_immich", Service: "immich-server"},
	})
	var callbacks []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Header.Get("X-API-Key") != "the-api-key-0123456789":
			w.WriteHeader(401)
		case r.Method == "GET":
			w.WriteHeader(404)
		case r.URL.Path == "/api/oidc/clients":
			body := make([]byte, 4096)
			n, _ := r.Body.Read(body)
			callbacks = append(callbacks, string(body[:n]))
			w.WriteHeader(201)
			_, _ = w.Write([]byte(`{"createdSecret":{"secret":"abc123"}}`))
		}
	}))
	defer srv.Close()
	u, _ := url.Parse(srv.URL)
	root, _ := repoCopy(t, "HOMELAB_DOMAIN=example.com", "POCKET_ID_PORT="+u.Port(), "POCKET_ID_API_KEY=the-api-key-0123456789")

	if out, code := homelabCmd(t, root, "", "sso"); code != 0 || !strings.Contains(out, "homelab sso setup connects the rest") {
		t.Fatalf("status (exit %d):\n%s", code, out)
	}
	out, code := homelabCmd(t, root, "", "sso", "setup", "--apply")
	if code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	env, err := sso.ReadEnv(filepath.Join(root, "data", "sso", "karakeep.env"))
	if err != nil || env["OAUTH_CLIENT_SECRET"] != "abc123" || env["OAUTH_WELLKNOWN_URL"] != "https://id.example.com/.well-known/openid-configuration" {
		t.Fatalf("karakeep.env: %v %v", env, err)
	}
	if !strings.Contains(strings.Join(callbacks, " "), "https://links.example.com/api/auth/callback/custom") {
		t.Errorf("callbacks: %v", callbacks)
	}
	if !strings.Contains(readCalls(t, calls), "up --detach --no-deps --force-recreate karakeep") {
		t.Errorf("karakeep was not recreated:\n%s", readCalls(t, calls))
	}
	if !strings.Contains(out, "Immich › Administration") {
		t.Errorf("no steps for Immich:\n%s", out)
	}
	if _, err := os.Stat(filepath.Join(root, "data", "sso", "immich-server.env")); err != nil {
		t.Errorf("Immich's client is not kept: %v", err)
	}
	f, _ := envfile.Load(filepath.Join(root, ".env"))
	if v, _ := f.Get("SSO_HOST"); v != "id.example.com" {
		t.Errorf("SSO_HOST = %q", v)
	}
}

func TestSSOInHomeMode(t *testing.T) {
	fakeDocker(t, nil)
	root, _ := repoCopy(t, "HOMELAB_DOMAIN=")
	if out, code := homelabCmd(t, root, "", "sso"); code == 0 || !strings.Contains(out, "needs a domain") {
		t.Errorf("exit %d:\n%s", code, out)
	}
}
