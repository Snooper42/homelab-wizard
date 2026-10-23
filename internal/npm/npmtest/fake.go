// Package npmtest provides an in-memory Nginx Proxy Manager API for tests.
// Like NPM 2.16, it rejects request fields its schemas do not allow.
package npmtest

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/Snooper42/homelab-wizard/internal/npm"
)

// Fields NPM 2.16 accepts (app/schema/paths/nginx/...).
var (
	proxyHostFields = fields("domain_names", "forward_scheme", "forward_host", "forward_port", "certificate_id", "ssl_forced",
		"hsts_enabled", "hsts_subdomains", "trust_forwarded_proto", "http2_support", "block_exploits", "caching_enabled",
		"allow_websocket_upgrade", "access_list_id", "advanced_config", "enabled", "meta", "locations")
	certificateFields = fields("provider", "nice_name", "domain_names", "meta")
	certMetaFields    = fields("certificate", "certificate_key", "dns_challenge", "dns_provider_credentials", "dns_provider",
		"letsencrypt_certificate", "propagation_seconds", "key_type")
)

func fields(names ...string) map[string]bool {
	m := map[string]bool{}
	for _, n := range names {
		m[n] = true
	}
	return m
}

// FakeServer is an in-memory NPM API for tests.
type FakeServer struct {
	*httptest.Server
	mu        sync.Mutex
	Email     string
	Password  string
	TwoFactor bool
	Hosts     map[int]npm.ProxyHost
	Certs     []npm.Certificate
	nextID    int
	Requests  []string
}

// NewFakeServer starts a fake NPM whose only account is email/password.
func NewFakeServer(email, password string) *FakeServer {
	f := &FakeServer{Email: email, Password: password, Hosts: map[int]npm.ProxyHost{}, nextID: 1}
	f.Server = httptest.NewServer(http.HandlerFunc(f.handle))
	return f
}

func (f *FakeServer) handle(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.Requests = append(f.Requests, r.Method+" "+r.URL.Path)
	path := strings.TrimPrefix(r.URL.Path, "/api")
	authed := r.Header.Get("Authorization") == "Bearer token-"+f.Password
	reply := func(code int, v any) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(code)
		_ = json.NewEncoder(w).Encode(v)
	}
	fail := func(code int, msg string) {
		reply(code, map[string]any{"error": map[string]string{"message": msg}})
	}
	var raw map[string]json.RawMessage
	if r.Body != nil && (r.Method == http.MethodPost || r.Method == http.MethodPut) {
		_ = json.NewDecoder(r.Body).Decode(&raw)
	}
	decode := func(v any) {
		data, _ := json.Marshal(raw)
		_ = json.Unmarshal(data, v)
	}
	switch {
	case path == "/" && r.Method == http.MethodGet:
		reply(200, map[string]string{"status": "OK"})
	case path == "/tokens" && r.Method == http.MethodPost:
		var in map[string]string
		decode(&in)
		if in["identity"] != f.Email || in["secret"] != f.Password {
			fail(401, "Invalid email or password")
			return
		}
		if f.TwoFactor {
			reply(200, map[string]any{"requires_2fa": true, "challenge_token": "challenge"})
			return
		}
		reply(200, map[string]string{"token": "token-" + f.Password})
	case !authed:
		fail(401, "Unauthorized")
	case path == "/nginx/proxy-hosts" && r.Method == http.MethodGet:
		var out []npm.ProxyHost
		for id := 1; id < f.nextID; id++ {
			if h, ok := f.Hosts[id]; ok {
				h.ID = id
				out = append(out, h)
			}
		}
		reply(200, out)
	case (path == "/nginx/proxy-hosts" && r.Method == http.MethodPost) || (strings.HasPrefix(path, "/nginx/proxy-hosts/") && r.Method == http.MethodPut):
		if bad := unknown(raw, proxyHostFields); bad != "" {
			fail(400, "data must NOT have additional properties: "+bad)
			return
		}
		var h npm.ProxyHost
		decode(&h)
		if r.Method == http.MethodPost {
			h.ID = f.nextID
			f.nextID++
		} else {
			id, _ := strconv.Atoi(strings.TrimPrefix(path, "/nginx/proxy-hosts/"))
			if _, ok := f.Hosts[id]; !ok {
				fail(404, "Not Found")
				return
			}
			h.ID = id
		}
		f.Hosts[h.ID] = h
		reply(201, h)
	case strings.HasPrefix(path, "/nginx/proxy-hosts/") && r.Method == http.MethodDelete:
		id, _ := strconv.Atoi(strings.TrimPrefix(path, "/nginx/proxy-hosts/"))
		if _, ok := f.Hosts[id]; !ok {
			fail(404, "Not Found")
			return
		}
		delete(f.Hosts, id)
		reply(200, true)
	case path == "/nginx/certificates" && r.Method == http.MethodGet:
		reply(200, f.Certs)
	case path == "/nginx/certificates" && r.Method == http.MethodPost:
		var meta map[string]json.RawMessage
		_ = json.Unmarshal(raw["meta"], &meta)
		if bad := unknown(raw, certificateFields) + unknown(meta, certMetaFields); bad != "" {
			fail(400, "data must NOT have additional properties: "+bad)
			return
		}
		var in struct {
			DomainNames []string `json:"domain_names"`
		}
		decode(&in)
		c := npm.Certificate{ID: len(f.Certs) + 1, Provider: "letsencrypt", DomainNames: in.DomainNames}
		f.Certs = append(f.Certs, c)
		reply(201, c)
	default:
		fail(404, "Not Found")
	}
}

func unknown(m map[string]json.RawMessage, allowed map[string]bool) string {
	var bad []string
	for k := range m {
		if !allowed[k] {
			bad = append(bad, k)
		}
	}
	sort.Strings(bad)
	return strings.Join(bad, ",")
}
