package domain

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/npm"
	"github.com/Snooper42/homelab-wizard/internal/npm/npmtest"
)

func apps(t *testing.T, ids ...string) []*catalog.App {
	t.Helper()
	_, file, _, _ := runtime.Caller(0)
	c, err := catalog.Load(filepath.Join(filepath.Dir(file), "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	var out []*catalog.App
	for _, id := range ids {
		a, ok := c.Get(id)
		if !ok {
			t.Fatalf("no app %s", id)
		}
		out = append(out, a)
	}
	return out
}

func TestNormalize(t *testing.T) {
	if d, err := Normalize("https://Example.com."); err != nil || d != "example.com" {
		t.Fatalf("got %q %v", d, err)
	}
	for _, bad := range []string{"", "localhost", "has space.com", "-bad.com"} {
		if _, err := Normalize(bad); err == nil {
			t.Errorf("%q should be rejected", bad)
		}
	}
}

func TestRoutes(t *testing.T) {
	routes := Routes(apps(t, "immich", "qbittorrent", "gluetun", "moneymatter-db", "nginx-proxy-manager", "jellyfin", "paperless"), "example.com", compose.MapLookup(nil))
	got := map[string]string{}
	for _, r := range routes {
		got[r.Host] = r.ForwardHost + ":" + strconv.Itoa(r.ForwardPort)
	}
	want := map[string]string{
		"photos.example.com":      "immich-server:2283",
		"qbittorrent.example.com": "gluetun:8082", // qBittorrent's UI lives in Gluetun's network namespace
		"npm.example.com":         "nginx-proxy-manager:81",
		"jellyfin.example.com":    "host.docker.internal:8096", // native app on the Mac
		"docs.example.com":        "paperless:8000",
	}
	if len(got) != len(want) {
		t.Fatalf("routes = %v", got)
	}
	for h, w := range want {
		if got[h] != w {
			t.Errorf("%s -> %s, want %s", h, got[h], w)
		}
	}
}

func TestSyncIsIdempotent(t *testing.T) {
	srv := npmtest.NewFakeServer("homelab@example.com", "pw")
	defer srv.Close()
	c := npm.New(srv.URL)
	ctx := context.Background()
	if err := c.Login(ctx, "homelab@example.com", "pw"); err != nil {
		t.Fatal(err)
	}
	routes := Routes(apps(t, "vaultwarden", "navidrome"), "example.com", compose.MapLookup(nil))
	res, err := Sync(ctx, c, routes, Settings{})
	if err != nil {
		t.Fatal(err)
	}
	if res[0].Action != "created" || res[1].Action != "created" || !srv.Hosts[1].TrustForwardedProto {
		t.Fatalf("first sync: %+v %+v", res, srv.Hosts[1])
	}
	res, err = Sync(ctx, c, routes, Settings{})
	if err != nil || res[0].Action != "unchanged" || res[1].Action != "unchanged" {
		t.Fatalf("second sync should change nothing: %+v %v", res, err)
	}
	cert, created, err := WildcardCertificate(ctx, c, "example.com", "cf-token")
	if err != nil || !created {
		t.Fatalf("cert: %+v %v %v", cert, created, err)
	}
	res, err = Sync(ctx, c, routes, Settings{CertificateID: cert.ID, ForceSSL: true})
	if err != nil || res[0].Action != "updated" {
		t.Fatalf("adding TLS should update hosts: %+v %v", res, err)
	}
	if h := srv.Hosts[1]; !h.SSLForced || h.CertificateID != cert.ID || !h.HTTP2Support {
		t.Fatalf("host not upgraded to TLS: %+v", h)
	}
	if _, created, _ := WildcardCertificate(ctx, c, "example.com", ""); created {
		t.Fatal("an existing wildcard certificate should be reused")
	}
	// A re-run without the certificate keeps each host's own.
	if res, err = Sync(ctx, c, routes, Settings{}); err != nil || res[0].Action != "unchanged" || srv.Hosts[1].CertificateID != cert.ID {
		t.Fatalf("a run without the certificate must not drop TLS: %+v %v %+v", res, err, srv.Hosts[1])
	}
	// An update keeps HSTS and caching set in the NPM UI.
	h := srv.Hosts[1]
	h.HSTSEnabled, h.CachingEnabled, h.ForwardPort = true, true, 1
	srv.Hosts[1] = h
	if res, err = Sync(ctx, c, routes, Settings{}); err != nil || !srv.Hosts[1].HSTSEnabled || !srv.Hosts[1].CachingEnabled || srv.Hosts[1].ForwardPort == 1 {
		t.Fatalf("update should fix the port and keep HSTS/caching: %+v %v %+v", res, err, srv.Hosts[1])
	}
}

func TestWithdrawRemovesLocalApps(t *testing.T) {
	srv := npmtest.NewFakeServer("homelab@example.com", "pw")
	defer srv.Close()
	c := npm.New(srv.URL)
	ctx := context.Background()
	if err := c.Login(ctx, "homelab@example.com", "pw"); err != nil {
		t.Fatal(err)
	}
	// What an earlier setup made for Dozzle, beside an app that stays and a
	// Dozzle host someone gave a second name by hand.
	for _, names := range [][]string{{"logs.example.com"}, {"vault.example.com"}, {"logs.example.com", "dozzle.lan"}} {
		if _, err := c.CreateProxyHost(ctx, npm.ProxyHost{DomainNames: names, ForwardHost: "x", ForwardPort: 1}); err != nil {
			t.Fatal(err)
		}
	}
	if Routes(apps(t, "dozzle"), "example.com", compose.MapLookup(nil)) != nil {
		t.Error("Dozzle has a route")
	}
	removed, err := Withdraw(ctx, c, apps(t, "dozzle", "vaultwarden"), "example.com")
	if err != nil || len(removed) != 1 || removed[0] != "logs.example.com" {
		t.Fatalf("removed %v, %v", removed, err)
	}
	if _, ok := srv.Hosts[1]; ok || len(srv.Hosts) != 2 {
		t.Errorf("hosts left: %+v", srv.Hosts)
	}
}

func TestHostsBlock(t *testing.T) {
	base := "127.0.0.1 localhost\n"
	once := HostsBlock(base, "127.0.0.1", []string{"sonarr.example.com", "radarr.example.com"})
	if !strings.HasPrefix(once, base) || !strings.Contains(once, "127.0.0.1 sonarr.example.com\n") {
		t.Fatalf("append: %q", once)
	}
	twice := HostsBlock(once, "127.0.0.1", []string{"sonarr.example.com"})
	if strings.Count(twice, hostsBegin) != 1 || strings.Contains(twice, "radarr") {
		t.Fatalf("replace: %q", twice)
	}
	if cleared := HostsBlock(twice, "127.0.0.1", nil); cleared != base {
		t.Fatalf("clear: %q", cleared)
	}
}

func TestAdGuardRewrite(t *testing.T) {
	var rewrites []Rewrite
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if u, p, _ := r.BasicAuth(); u != "admin" || p != "pw" {
			w.WriteHeader(401)
			return
		}
		switch r.URL.Path {
		case "/control/status":
			_, _ = w.Write([]byte(`{"running":true}`))
		case "/control/rewrite/list":
			_ = json.NewEncoder(w).Encode(rewrites)
		case "/control/rewrite/add":
			var rw Rewrite
			_ = json.NewDecoder(r.Body).Decode(&rw)
			rewrites = append(rewrites, rw)
		case "/control/rewrite/update":
			if r.Method != http.MethodPut {
				w.WriteHeader(405)
				return
			}
			var body map[string]Rewrite
			_ = json.NewDecoder(r.Body).Decode(&body)
			for i, rw := range rewrites {
				if rw.Domain == body["target"].Domain && rw.Answer == body["target"].Answer {
					rewrites[i] = body["update"]
				}
			}
		}
	}))
	defer srv.Close()
	ag := NewAdGuard(srv.URL, "admin", "pw")
	ctx := context.Background()
	for _, step := range []struct{ ip, want string }{{"192.168.1.10", "created"}, {"192.168.1.10", "unchanged"}, {"10.0.0.20", "updated"}} {
		got, err := ag.UpsertRewrite(ctx, "*.example.com", step.ip)
		if err != nil || got != step.want {
			t.Fatalf("%s: got %s %v, want %s", step.ip, got, err, step.want)
		}
	}
	if len(rewrites) != 1 || rewrites[0].Answer != "10.0.0.20" {
		t.Fatalf("rewrites = %+v", rewrites)
	}
	// A rewrite switched off in AdGuard is switched back on.
	off := false
	rewrites[0].Enabled = &off
	if got, err := ag.UpsertRewrite(ctx, "*.example.com", "10.0.0.20"); err != nil || got != "updated" || rewrites[0].Enabled == nil || !*rewrites[0].Enabled {
		t.Fatalf("disabled rewrite: %s %v %+v", got, err, rewrites[0])
	}
	if err := ag.Check(ctx); err != nil {
		t.Fatalf("Check: %v", err)
	}
	if _, err := NewAdGuard(srv.URL, "admin", "wrong").UpsertRewrite(ctx, "*.x.com", "1.2.3.4"); err == nil || !strings.Contains(err.Error(), "ADGUARD_PASSWORD") {
		t.Fatalf("expected auth error, got %v", err)
	}
}

func TestAdGuardFirstRun(t *testing.T) {
	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/control/install/get_addresses":
			_, _ = w.Write([]byte(`{"web_port":80,"dns_port":53}`))
		case "/control/install/configure":
			_ = json.NewDecoder(r.Body).Decode(&got)
		default:
			w.WriteHeader(404)
		}
	}))
	defer srv.Close()
	ctx := context.Background()
	ag := NewAdGuard("http://127.0.0.1:1", "admin", "pw12345678")
	if !ag.FirstRun(ctx, srv.URL) {
		t.Fatal("the wizard is waiting")
	}
	if ag.FirstRun(ctx, "http://127.0.0.1:1") {
		t.Fatal("nothing answers there")
	}
	if err := ag.Install(ctx, srv.URL); err != nil {
		t.Fatal(err)
	}
	web, _ := got["web"].(map[string]any)
	if got["username"] != "admin" || got["password"] != "pw12345678" || web["port"] != float64(80) {
		t.Fatalf("configure body = %v", got)
	}
}

func TestParseTunnelToken(t *testing.T) {
	tok := base64.StdEncoding.EncodeToString([]byte(`{"a":"acct","t":"tun-1","s":"c2VjcmV0"}`))
	tun, err := ParseTunnelToken(tok)
	if err != nil || tun.AccountID != "acct" || tun.ID != "tun-1" || tun.Target() != "tun-1.cfargotunnel.com" {
		t.Fatalf("got %+v %v", tun, err)
	}
	if _, err := ParseTunnelToken("not-a-token"); err == nil {
		t.Fatal("garbage should be rejected")
	}
}

func TestMergeIngressKeepsManualRules(t *testing.T) {
	existing := []map[string]any{
		{"hostname": "photos.example.com", "service": "http://host.docker.internal:8013", "originRequest": map[string]any{"noTLSVerify": true}},
		{"hostname": "ssh.example.com", "service": "ssh://localhost:22"},
		{"service": "http_status:404"},
	}
	out, changed := MergeIngress(existing, []string{"photos.example.com", "docs.example.com"}, "http://nginx-proxy-manager:80")
	if !changed || len(out) != 4 {
		t.Fatalf("out = %v", out)
	}
	if out[0]["hostname"] != "docs.example.com" || out[1]["service"] != "http://nginx-proxy-manager:80" || out[1]["originRequest"] == nil {
		t.Fatalf("our hosts should come first, keeping extra settings: %v", out)
	}
	if out[2]["hostname"] != "ssh.example.com" || out[3]["hostname"] != nil {
		t.Fatalf("manual rules and the catch-all must be kept: %v", out)
	}
	if _, changed := MergeIngress(out, []string{"photos.example.com", "docs.example.com"}, "http://nginx-proxy-manager:80"); changed {
		t.Fatal("re-running should change nothing")
	}
}

func TestPublish(t *testing.T) {
	config := map[string]any{"ingress": []map[string]any{{"service": "http_status:404"}}, "warp-routing": map[string]any{"enabled": false}}
	var records []map[string]any
	var puts int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ok := func(v any) { _ = json.NewEncoder(w).Encode(map[string]any{"success": true, "result": v}) }
		body, _ := io.ReadAll(r.Body)
		switch {
		case strings.HasSuffix(r.URL.Path, "/cfd_tunnel/tun-1/configurations") && r.Method == http.MethodGet:
			ok(map[string]any{"config": config})
		case strings.HasSuffix(r.URL.Path, "/cfd_tunnel/tun-1/configurations") && r.Method == http.MethodPut:
			puts++
			var in map[string]map[string]any
			_ = json.Unmarshal(body, &in)
			config = in["config"]
			ok(nil)
		case r.URL.Path == "/zones":
			ok([]map[string]string{{"id": "z1"}})
		case r.URL.Path == "/zones/z1/dns_records" && r.Method == http.MethodGet:
			name := r.URL.Query().Get("name")
			var hits []map[string]any
			for _, rec := range records {
				if rec["name"] == name {
					hits = append(hits, rec)
				}
			}
			ok(hits)
		case r.URL.Path == "/zones/z1/dns_records" && r.Method == http.MethodPost:
			var rec map[string]any
			_ = json.Unmarshal(body, &rec)
			rec["id"] = "r" + strconv.Itoa(len(records))
			records = append(records, rec)
			ok(rec)
		default:
			w.WriteHeader(404)
		}
	}))
	defer srv.Close()
	cf := NewCloudflare("tok")
	cf.BaseURL = srv.URL
	tun := Tunnel{AccountID: "acct", ID: "tun-1"}
	ctx := context.Background()
	pub, err := Publish(ctx, cf, tun, "example.com", []string{"photos.example.com"}, "http://nginx-proxy-manager:80")
	if err != nil || !pub.IngressChanged || pub.DNS["photos.example.com"] != "created" {
		t.Fatalf("first publish: %+v %v", pub, err)
	}
	if config["warp-routing"] == nil {
		t.Fatal("other tunnel settings must be kept")
	}
	if records[0]["content"] != "tun-1.cfargotunnel.com" || records[0]["proxied"] != true {
		t.Fatalf("dns record: %+v", records[0])
	}
	pub, err = Publish(ctx, cf, tun, "example.com", []string{"photos.example.com"}, "http://nginx-proxy-manager:80")
	if err != nil || pub.IngressChanged || pub.DNS["photos.example.com"] != "unchanged" || puts != 1 {
		t.Fatalf("second publish should change nothing: %+v %v (puts %d)", pub, err, puts)
	}
}

func TestPickLAN(t *testing.T) {
	up := net.FlagUp | net.FlagBroadcast
	wifi := LANCandidate{IP: net.ParseIP("192.168.1.10").To4(), Flags: up, Name: "en0"}
	vpn := LANCandidate{IP: net.ParseIP("10.2.0.2").To4(), Flags: net.FlagUp | net.FlagPointToPoint, Name: "utun4"}
	docker0 := LANCandidate{IP: net.ParseIP("172.17.0.1").To4(), Flags: up, Name: "docker0"}
	orb := LANCandidate{IP: net.ParseIP("198.19.249.3").To4(), Flags: up, Name: "bridge100"}
	// A VPN carries the traffic: the Wi-Fi address still wins.
	if got := pickLAN([]LANCandidate{docker0, orb, vpn, wifi}, vpn.IP); got != "192.168.1.10" {
		t.Errorf("with a VPN: %s", got)
	}
	if got := pickLAN([]LANCandidate{wifi}, wifi.IP); got != "192.168.1.10" {
		t.Errorf("plain: %s", got)
	}
	if got := pickLAN([]LANCandidate{vpn, docker0}, vpn.IP); got != "" {
		t.Errorf("no home network: %s", got)
	}
	if !isTunnel(vpn) || isTunnel(wifi) {
		t.Error("tunnel detection")
	}
}

// A domain or address that is not one never reaches the administrator's
// prompt (a PowerShell script on Windows, a path under /etc/resolver).
func TestSetResolverRefusesWhatIsNotADomain(t *testing.T) {
	for _, c := range [][2]string{
		{"x.com' ; Start-Process calc ; '", "192.168.1.10"},
		{"../sudoers.d/x", "192.168.1.10"},
		{"example.com", "192.168.1.10'; calc"},
	} {
		if err := SetResolver(c[0], c[1]); err == nil || !strings.Contains(err.Error(), "not a") {
			t.Errorf("SetResolver(%q, %q): %v", c[0], c[1], err)
		}
		if FindsByName(c[0], c[1]) {
			t.Errorf("FindsByName(%q, %q) is true", c[0], c[1])
		}
	}
}
