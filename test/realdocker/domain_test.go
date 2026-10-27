//go:build realdocker

package realdocker

import (
	"cmp"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"slices"
	"testing"
	"time"
)

// domainUnderTest is a name no one owns (RFC 2606's .test), so nothing
// outside this run can answer for it.
const domainUnderTest = "example.test"

// TestTheDomainThroughTheProxy is `homelab domain setup` against the real
// Nginx Proxy Manager and AdGuard Home (ISSUE-0004), without Cloudflare,
// which stays a fake: it needs a real account. On a homelab of its own with
// ntfy, the proxy, and AdGuard Home, domain setup makes a proxy host for
// each running app and AdGuard's *.domain rewrite; then the name resolves
// through AdGuard's DNS, and ntfy answers through the proxy by its name.
// REALDOCKER_DOMAIN=1 runs it (the nightly workflow's domain job).
func TestTheDomainThroughTheProxy(t *testing.T) {
	if os.Getenv("REALDOCKER_DOMAIN") == "" {
		t.Skip("REALDOCKER_DOMAIN is not set")
	}
	l := newLab(t)
	t.Cleanup(func() {
		if t.Failed() {
			l.keepReport()
		}
		_, _ = l.try("uninstall", "--data", "--apply")
	})
	ids := []string{"ntfy", "nginx-proxy-manager", "adguard-home"}
	l.run(append([]string{"install"}, append(ids, "--apply")...)...)
	l.up([]realApp{{id: "ntfy", page: "/v1/health"}, {id: "nginx-proxy-manager", page: "/api/"}, {id: "adguard-home", page: "/"}})
	if l.env("ADGUARD_PASSWORD") == "" {
		// The install sets AdGuard Home up; a slow first start leaves it to this.
		l.run("adguard", "setup", "--apply")
	}
	// The proxy's admin page before its address becomes a name.
	admin := l.url("nginx-proxy-manager")
	var tok string
	waitFor(t, "the proxy's API account", 3*time.Minute, func() (err error) {
		tok, err = l.npmToken()
		return err
	})

	// This machine's address as the names' answer: the runner's loopback,
	// where the proxy listens too.
	l.run("domain", "setup", domainUnderTest, "--dns", "adguard", "--ip", "127.0.0.1", "--no-tunnel", "--apply")

	var hosts []struct {
		DomainNames   []string `json:"domain_names"`
		ForwardHost   string   `json:"forward_host"`
		ForwardPort   int      `json:"forward_port"`
		CertificateID any      `json:"certificate_id"`
	}
	if err := request(http.MethodGet, admin+"/api/nginx/proxy-hosts", nil, &hosts, "Authorization", "Bearer "+tok); err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, h := range hosts {
		names = append(names, h.DomainNames...)
	}
	for _, want := range []string{"ntfy." + domainUnderTest, "ads." + domainUnderTest, "npm." + domainUnderTest} {
		if !slices.Contains(names, want) {
			t.Errorf("no proxy host for %s: %v", want, names)
		}
	}

	var rewrites []struct{ Domain, Answer string }
	if err := request(http.MethodGet, "http://127.0.0.1:"+cmp.Or(l.env("ADGUARD_PORT"), "3003")+"/control/rewrite/list", nil, &rewrites,
		"Authorization", basicAuth(cmp.Or(l.env("ADGUARD_USER"), "admin"), l.env("ADGUARD_PASSWORD"))); err != nil {
		t.Fatal(err)
	}
	if !slices.ContainsFunc(rewrites, func(r struct{ Domain, Answer string }) bool {
		return r.Domain == "*."+domainUnderTest && r.Answer == "127.0.0.1"
	}) {
		t.Errorf("AdGuard has no *.%s rewrite to 127.0.0.1: %+v", domainUnderTest, rewrites)
	}

	// The name, asked of AdGuard's own DNS as a device at home would.
	dnsAt := net.JoinHostPort(cmp.Or(l.env("ADGUARD_DNS_BIND_IP"), "127.0.0.1"), "53")
	resolver := &net.Resolver{PreferGo: true, Dial: func(ctx context.Context, network, _ string) (net.Conn, error) {
		return (&net.Dialer{Timeout: 5 * time.Second}).DialContext(ctx, "udp", dnsAt)
	}}
	waitFor(t, "ntfy's name through AdGuard", time.Minute, func() error {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		addrs, err := resolver.LookupHost(ctx, "ntfy."+domainUnderTest)
		if err != nil {
			return err
		}
		if !slices.Contains(addrs, "127.0.0.1") {
			return fmt.Errorf("answered %v", addrs)
		}
		return nil
	})

	// ntfy by its name, through the proxy on port 80.
	proxy := "http://127.0.0.1:" + cmp.Or(l.env("NPM_HTTP_PORT"), "80")
	waitFor(t, "ntfy through the proxy by its name", 2*time.Minute, func() error {
		req, _ := http.NewRequest(http.MethodGet, proxy+"/v1/health", nil)
		req.Host = "ntfy." + domainUnderTest
		resp, err := web.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		var health struct {
			Healthy bool `json:"healthy"`
		}
		if resp.StatusCode != http.StatusOK || decodeJSON(resp, &health) != nil || !health.Healthy {
			return fmt.Errorf("%s answered %s", req.Host, resp.Status)
		}
		return nil
	})
	t.Logf("domain setup made %d proxy hosts and AdGuard's *.%s rewrite; ntfy.%s resolves through AdGuard and answers through the proxy", len(hosts), domainUnderTest, domainUnderTest)
}

// basicAuth is an Authorization header's value for a user and password.
func basicAuth(user, password string) string {
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(user+":"+password))
}

// decodeJSON reads a response's JSON body into out.
func decodeJSON(resp *http.Response, out any) error {
	return json.NewDecoder(resp.Body).Decode(out)
}
