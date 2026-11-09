package main

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/npm/npmtest"
)

// Setup's Reach Finances away from home (homelab phone away, ADR-0023):
// Access in front of the companion's own hostname, a proxy host for it, the
// hostname through the tunnel, and .env told, in that order; run again, it
// changes nothing.
func TestPhoneAwayEndToEnd(t *testing.T) {
	npmSrv := npmtest.NewFakeServer("homelab@example.com", "npm-pw")
	defer npmSrv.Close()
	var ingress []map[string]any
	dns := map[string]string{}
	tokens, apps, policies := 0, 0, 0
	refuse := false
	cfSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ok := func(v any) { _ = json.NewEncoder(w).Encode(map[string]any{"success": true, "result": v}) }
		if refuse {
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "errors": []map[string]any{{"message": "Authentication error"}}})
			return
		}
		body, _ := io.ReadAll(r.Body)
		p := r.URL.Path
		switch {
		case p == "/accounts/acct/access/organizations":
			ok(map[string]string{"auth_domain": "household.cloudflareaccess.com"})
		case p == "/accounts/acct/access/service_tokens" && r.Method == http.MethodGet:
			if tokens == 0 {
				ok([]any{})
				return
			}
			ok([]map[string]string{{"id": "tok-1", "client_id": "client-1.access"}})
		case p == "/accounts/acct/access/service_tokens" && r.Method == http.MethodPost:
			tokens++
			ok(map[string]string{"id": "tok-1", "client_id": "client-1.access", "client_secret": "secret-1"})
		case p == "/accounts/acct/access/apps" && r.Method == http.MethodGet:
			if apps == 0 {
				ok([]any{})
				return
			}
			ok([]map[string]string{{"id": "app-1", "aud": "aud-1", "domain": "homelab-away.example.com"}})
		case p == "/accounts/acct/access/apps" && r.Method == http.MethodPost:
			apps++
			ok(map[string]string{"id": "app-1", "aud": "aud-1"})
		case p == "/accounts/acct/access/apps/app-1/policies" && r.Method == http.MethodGet:
			if policies == 0 {
				ok([]any{})
				return
			}
			ok([]map[string]any{{"id": "pol-1", "decision": "non_identity", "include": []map[string]any{{"service_token": map[string]string{"token_id": "tok-1"}}}}})
		case p == "/accounts/acct/access/apps/app-1/policies" && r.Method == http.MethodPost:
			policies++
			ok(nil)
		case strings.HasSuffix(p, "/configurations") && r.Method == http.MethodGet:
			ok(map[string]any{"config": map[string]any{"ingress": ingress}})
		case strings.HasSuffix(p, "/configurations") && r.Method == http.MethodPut:
			var in struct {
				Config struct {
					Ingress []map[string]any `json:"ingress"`
				} `json:"config"`
			}
			_ = json.Unmarshal(body, &in)
			ingress = in.Config.Ingress
			ok(nil)
		case p == "/zones":
			ok([]map[string]string{{"id": "z1"}})
		case p == "/zones/z1/dns_records" && r.Method == http.MethodGet:
			if target, has := dns[r.URL.Query().Get("name")]; has {
				ok([]map[string]any{{"id": "r1", "type": "CNAME", "content": target, "proxied": true}})
				return
			}
			ok([]any{})
		case p == "/zones/z1/dns_records" && r.Method == http.MethodPost:
			var rec map[string]any
			_ = json.Unmarshal(body, &rec)
			dns[rec["name"].(string)] = rec["content"].(string)
			ok(rec)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer cfSrv.Close()
	cloudflareAPI = cfSrv.URL
	defer func() { cloudflareAPI = "https://api.cloudflare.com/client/v4" }()

	npmURL, _ := url.Parse(npmSrv.URL)
	token := base64.StdEncoding.EncodeToString([]byte(`{"a":"acct","t":"tun-1","s":"c2VjcmV0"}`))
	root, _ := repoCopy(t, "NPM_ADMIN_PORT="+npmURL.Port(), "NPM_API_EMAIL=homelab@example.com", "NPM_API_PASSWORD=npm-pw",
		"TUNNEL_TOKEN="+token, "CLOUDFLARE_API_TOKEN=cf-token", "HOMELAB_DOMAIN=example.com", "COMPANION_PROXY_KEY=proxy-key-0123456789abcdef")
	env := func() string {
		b, _ := os.ReadFile(filepath.Join(root, ".env"))
		return string(b)
	}

	// Without --apply: the plan, and nothing made.
	if out, code := homelabCmd(t, root, "", "phone", "away"); code != 0 || !strings.Contains(out, "homelab-away.example.com") || tokens+apps != 0 {
		t.Fatalf("the plan (exit %d):\n%s", code, out)
	}

	// The token without Access's permissions: says which to add, and the
	// companion isn't told anything.
	refuse = true
	if out, code := homelabCmd(t, root, "", "phone", "away", "--apply"); code == 0 || !strings.Contains(out, "Access: Service Tokens") || strings.Contains(env(), "COMPANION_ACCESS_AUD=aud") {
		t.Fatalf("refused (exit %d):\n%s", code, out)
	}
	refuse = false

	out, code := homelabCmd(t, root, "", "phone", "away", "--apply")
	if code != 0 {
		t.Fatalf("phone away exit %d:\n%s", code, out)
	}
	for _, want := range []string{"COMPANION_ACCESS_TEAM=household", "COMPANION_ACCESS_AUD=aud-1", "COMPANION_ACCESS_CLIENT_ID=client-1.access", "COMPANION_ACCESS_CLIENT_SECRET=secret-1", "COMPANION_AWAY_HOST=homelab-away.example.com"} {
		if !strings.Contains(env(), want) {
			t.Errorf(".env is missing %s", want)
		}
	}
	if strings.Contains(out, "secret-1") {
		t.Errorf("the service token's secret was printed:\n%s", out)
	}
	var host string
	for _, h := range npmSrv.Hosts {
		if h.DomainNames[0] == "homelab-away.example.com" {
			host = h.ForwardHost
			if !strings.Contains(h.AdvancedConfig, "X-Homelab-Proxy") {
				t.Errorf("the away host doesn't carry the companion's location: %+v", h)
			}
		}
	}
	if host == "" {
		t.Fatalf("no proxy host for the away hostname: %+v", npmSrv.Hosts)
	}
	if dns["homelab-away.example.com"] != "tun-1.cfargotunnel.com" || !strings.Contains(mustJSONCmd(ingress), "homelab-away.example.com") {
		t.Fatalf("not published through the tunnel: dns %v ingress %v", dns, ingress)
	}

	// Again: nothing new in Cloudflare.
	if out, code := homelabCmd(t, root, "", "phone", "away", "--apply"); code != 0 || tokens != 1 || apps != 1 || policies != 1 {
		t.Fatalf("run again (exit %d; tokens %d apps %d policies %d):\n%s", code, tokens, apps, policies, out)
	}
}

func mustJSONCmd(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
