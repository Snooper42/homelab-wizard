package setup

import (
	"context"
	"encoding/base64"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestTester(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/control/status", func(w http.ResponseWriter, r *http.Request) {
		if u, p, _ := r.BasicAuth(); u != "admin" || p != "right" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Write([]byte(`{}`))
	})
	mux.HandleFunc("/api/tokens", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"token":"t"}`))
	})
	mux.HandleFunc("/zones", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer good" {
			w.Write([]byte(`{"success":false,"errors":[{"message":"Invalid API Token"}]}`))
			return
		}
		w.Write([]byte(`{"success":true,"result":[{"id":"z1"}]}`))
	})
	mux.HandleFunc("/accounts/acct/cfd_tunnel/tun/configurations", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"success":true,"result":{"config":{"ingress":[]}}}`))
	})
	mux.HandleFunc("/ping/ok", func(w http.ResponseWriter, r *http.Request) {})
	srv := httptest.NewServer(mux)
	defer srv.Close()
	host, port, _ := net.SplitHostPort(strings.TrimPrefix(srv.URL, "http://"))

	tunnel := base64.StdEncoding.EncodeToString([]byte(`{"a":"acct","t":"tun","s":"secret"}`))
	dir := t.TempDir()
	if err := os.Mkdir(filepath.Join(dir, "backups"), 0o755); err != nil {
		t.Fatal(err)
	}
	env := map[string]string{
		"ADGUARD_PORT": port, "ADGUARD_USER": "admin", "ADGUARD_PASSWORD": "right",
		"NPM_ADMIN_PORT": port, "NPM_API_EMAIL": "a@b.c", "NPM_API_PASSWORD": "pw",
		"CLOUDFLARE_API_TOKEN": "good", "HOMELAB_DOMAIN": "example.com", "TUNNEL_TOKEN": tunnel,
		"HEARTBEAT_URL": srv.URL + "/ping/ok", "BACKUP_DESTINATION": "./backups", "MEDIA_ROOT": "/no/such/drive",
	}
	tr := Tester{Env: env, Root: dir, CloudflareURL: srv.URL, LocalHost: host}
	ctx := context.Background()
	for key, wantOK := range map[string]bool{
		"ADGUARD_PASSWORD": true, "NPM_API_EMAIL": true, "CLOUDFLARE_API_TOKEN": true, "TUNNEL_TOKEN": true,
		"HEARTBEAT_URL": true, "BACKUP_DESTINATION": true, "MEDIA_ROOT": false, "TZ": false,
	} {
		if r := tr.Test(ctx, key); r.OK != wantOK || r.Message == "" {
			t.Errorf("%s: %+v, want ok=%v", key, r, wantOK)
		}
	}
	if r := tr.Test(ctx, "CLOUDFLARE_API_TOKEN"); !strings.Contains(r.Message, "manage the tunnel") {
		t.Errorf("cloudflare with a tunnel: %q", r.Message)
	}

	env["HOMELAB_DOMAIN"] = ""
	if r := tr.Test(ctx, "CLOUDFLARE_API_TOKEN"); r.OK || !strings.Contains(r.Message, "set the Domain") {
		t.Errorf("cloudflare without a domain: %+v", r)
	}
	env["HOMELAB_DOMAIN"] = "example.com"

	env["ADGUARD_PASSWORD"] = "wrong"
	env["CLOUDFLARE_API_TOKEN"] = "bad"
	env["TUNNEL_TOKEN"] = "not-a-token"
	env["HEARTBEAT_URL"] = srv.URL + "/ping/missing"
	for _, key := range []string{"ADGUARD_USER", "CLOUDFLARE_API_TOKEN", "TUNNEL_TOKEN", "HEARTBEAT_URL"} {
		if r := tr.Test(ctx, key); r.OK {
			t.Errorf("%s should fail: %+v", key, r)
		}
	}
	if Testable("TZ") || !Testable("TUNNEL_TOKEN") {
		t.Error("Testable")
	}
}

func TestNtfyTests(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/account" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		switch auth := r.Header.Get("Authorization"); {
		case auth == "Bearer tk_pub":
			w.Write([]byte(`{"username":"homelab","role":"user"}`))
		case auth == "Bearer tk_read":
			w.Write([]byte(`{"username":"homelab-reader","role":"user"}`))
		case strings.HasPrefix(auth, "Basic "):
			if u, p, _ := r.BasicAuth(); u == "phone" && p == "pw" {
				w.Write([]byte(`{"username":"phone","role":"user"}`))
				return
			}
			w.WriteHeader(http.StatusUnauthorized)
		default:
			w.WriteHeader(http.StatusUnauthorized)
		}
	}))
	defer srv.Close()
	host, port, _ := net.SplitHostPort(strings.TrimPrefix(srv.URL, "http://"))
	env := map[string]string{"NTFY_PORT": port, "NTFY_PUBLISH_TOKEN": "tk_pub", "NTFY_READ_TOKEN": "tk_pub", "NTFY_PHONE_PASSWORD": "pw"}
	tr := Tester{Env: env, LocalHost: host}
	ctx := context.Background()
	if r := tr.Test(ctx, "NTFY_PUBLISH_TOKEN"); !r.OK {
		t.Errorf("publisher: %+v", r)
	}
	if r := tr.Test(ctx, "NTFY_READ_TOKEN"); r.OK || !strings.Contains(r.Message, `"homelab"`) {
		t.Errorf("the publisher's token in the reader's place should fail: %+v", r)
	}
	if r := tr.Test(ctx, "NTFY_PHONE_PASSWORD"); !r.OK {
		t.Errorf("phone: %+v", r)
	}
	env["NTFY_PHONE_PASSWORD"] = "wrong"
	if r := tr.Test(ctx, "NTFY_PHONE_PASSWORD"); r.OK || !strings.Contains(r.Message, "refused") {
		t.Errorf("wrong phone password: %+v", r)
	}
	env["NTFY_READ_TOKEN"] = ""
	if r := tr.Test(ctx, "NTFY_READ_TOKEN"); r.OK || !strings.Contains(r.Message, "Set up the alert token") {
		t.Errorf("empty: %+v", r)
	}
}

func TestTesterAccounts(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/Users":
			if r.Header.Get("Authorization") != `MediaBrowser Token="good"` {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.Write([]byte(`[]`))
		case "/auth/login":
			body, _ := io.ReadAll(r.Body)
			if !strings.Contains(string(body), `"password":"right"`) {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.Write([]byte(`{"id":"a","token":"t","isAdmin":true}`))
		}
	}))
	defer srv.Close()
	host, port, _ := net.SplitHostPort(strings.TrimPrefix(srv.URL, "http://"))
	run := func(key string, env map[string]string) Result {
		env["NAVIDROME_PORT"] = port
		return Tester{Env: env, LocalHost: host, JellyfinURL: srv.URL}.Test(context.Background(), key)
	}
	for _, c := range []struct {
		key  string
		env  map[string]string
		ok   bool
		says string
	}{
		{"JELLYFIN_API_KEY", map[string]string{}, false, "is empty"},
		{"JELLYFIN_API_KEY", map[string]string{"JELLYFIN_API_KEY": "bad"}, false, "refused this key"},
		{"JELLYFIN_API_KEY", map[string]string{"JELLYFIN_API_KEY": "good"}, true, "accepted the key"},
		{"NAVIDROME_ADMIN_USER", map[string]string{"NAVIDROME_ADMIN_USER": "homelab"}, false, "set both"},
		{"NAVIDROME_ADMIN_PASSWORD", map[string]string{"NAVIDROME_ADMIN_USER": "homelab", "NAVIDROME_ADMIN_PASSWORD": "wrong"}, false, "refused this login"},
		{"NAVIDROME_ADMIN_PASSWORD", map[string]string{"NAVIDROME_ADMIN_USER": "homelab", "NAVIDROME_ADMIN_PASSWORD": "right"}, true, "accepted"},
	} {
		if r := run(c.key, c.env); r.OK != c.ok || !strings.Contains(r.Message, c.says) {
			t.Errorf("%s with %v: %+v", c.key, c.env, r)
		}
	}
}
