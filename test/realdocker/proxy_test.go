//go:build realdocker

package realdocker

import (
	"cmp"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"testing"
	"time"
)

// proxyTestHost is the name the test's proxy host answers to.
const proxyTestHost = "ntfy.proxy.test"

// TestTheProxyBlocksABannedAddress is the homelab's own proxy image
// (dockerfiles/npm-crowdsec) built and run with CrowdSec (ISSUE-0001), on
// a homelab of its own: the bouncer is registered and pulling (CrowdSec's
// own list, and the watchdog's check), a request through the proxy
// answers, then a ban on the address the proxy sees it from gets 403, and
// lifting the ban lets it through again.
// REALDOCKER_PROXY=1 runs it (the nightly workflow's proxy job).
func TestTheProxyBlocksABannedAddress(t *testing.T) {
	if os.Getenv("REALDOCKER_PROXY") == "" {
		t.Skip("REALDOCKER_PROXY is not set")
	}
	l := newLab(t)
	t.Cleanup(func() {
		if t.Failed() {
			_, _ = l.try("logs", "nginx-proxy-manager")
			_, _ = l.try("logs", "crowdsec")
			l.keepReport()
		}
		_, _ = l.try("uninstall", "--data", "--apply")
	})
	l.run("install", "ntfy", "nginx-proxy-manager", "crowdsec", "--apply")
	l.up([]realApp{{id: "ntfy", page: "/v1/health"}, {id: "nginx-proxy-manager", page: "/api/"}})
	waitFor(t, "crowdsec running", 5*time.Minute, func() error {
		if s := l.status()["crowdsec"]; s.State != "running" || s.Health == "starting" || s.Health == "unhealthy" {
			return fmt.Errorf("state %q, health %q", s.State, s.Health)
		}
		return nil
	})

	// A proxy host for ntfy, as domain setup would make one.
	var tok string
	waitFor(t, "the proxy's API account", 3*time.Minute, func() (err error) {
		tok, err = l.npmToken()
		return err
	})
	host := map[string]any{
		"domain_names": []string{proxyTestHost}, "forward_scheme": "http", "forward_host": "ntfy", "forward_port": 80,
		"access_list_id": 0, "certificate_id": 0, "meta": map[string]any{}, "advanced_config": "", "locations": []any{},
		"block_exploits": false, "caching_enabled": false, "allow_websocket_upgrade": false, "http2_support": false, "hsts_enabled": false, "hsts_subdomains": false, "ssl_forced": false,
	}
	if err := request(http.MethodPost, l.url("nginx-proxy-manager")+"/api/nginx/proxy-hosts", host, nil, "Authorization", "Bearer "+tok); err != nil {
		t.Fatal(err)
	}
	proxy := "http://127.0.0.1:" + cmp.Or(l.env("NPM_HTTP_PORT"), "80")
	through := func() (int, error) {
		req, _ := http.NewRequest(http.MethodGet, proxy+"/v1/health", nil)
		req.Host = proxyTestHost
		resp, err := web.Do(req)
		if err != nil {
			return 0, err
		}
		resp.Body.Close()
		return resp.StatusCode, nil
	}
	waitFor(t, "ntfy through the proxy", 2*time.Minute, func() error {
		if code, err := through(); err != nil || code != http.StatusOK {
			return fmt.Errorf("%d %v", code, err)
		}
		return nil
	})

	// The bouncer, as CrowdSec lists it: registered, and pulling.
	crowdsec := l.container("crowdsec")
	waitFor(t, "the proxy's bouncer pulling from CrowdSec", 3*time.Minute, func() error {
		var bouncers []struct {
			Name     string `json:"name"`
			LastPull string `json:"last_pull"`
		}
		out := docker(t, "exec", crowdsec, "cscli", "bouncers", "list", "-o", "json")
		if err := json.Unmarshal([]byte(out), &bouncers); err != nil {
			return fmt.Errorf("%v: %s", err, tail(out, 3))
		}
		for _, b := range bouncers {
			if b.Name == "nginx_proxy_manager" && b.LastPull != "" && !strings.HasPrefix(b.LastPull, "0001") {
				return nil
			}
		}
		return fmt.Errorf("bouncers: %s", tail(out, 5))
	})
	// The watchdog's own check, which Status › Protection shows.
	if out, _ := l.try("watchdog"); !strings.Contains(out, "✓ crowdsec bouncer") {
		t.Errorf("the watchdog does not see the bouncer pulling:\n%s", tail(out, 15))
	}

	// The address the proxy sees this test's requests from (Docker's
	// gateway): from the proxy host's access log.
	logs := docker(t, "exec", l.container("nginx-proxy-manager"), "sh", "-c", "cat /data/logs/proxy-host-*_access.log")
	m := regexp.MustCompile(`\[Client ([0-9a-fA-F.:]+)\]`).FindAllStringSubmatch(logs, -1)
	if m == nil {
		t.Fatalf("no client address in the proxy's access log:\n%s", tail(logs, 5))
	}
	client := m[len(m)-1][1]
	docker(t, "exec", crowdsec, "cscli", "decisions", "add", "--ip", client, "--duration", "5m", "--reason", "nightly ban test")
	waitFor(t, "403 for the banned address "+client, 2*time.Minute, func() error {
		if code, err := through(); err != nil || code != http.StatusForbidden {
			return fmt.Errorf("%d %v", code, err)
		}
		return nil
	})
	docker(t, "exec", crowdsec, "cscli", "decisions", "delete", "--ip", client)
	waitFor(t, "ntfy through the proxy again once the ban is lifted", 2*time.Minute, func() error {
		if code, err := through(); err != nil || code != http.StatusOK {
			return fmt.Errorf("%d %v", code, err)
		}
		return nil
	})
	t.Logf("the bouncer pulls from CrowdSec; a ban on %s got 403 through the proxy, and lifting it let ntfy through again", client)

	// N21: the visitor's address in CF-Connecting-IP is taken from the
	// tunnel's own address alone (cloudflared's fixed place on its own
	// network), never from a device at home or another container.
	npm := l.container("nginx-proxy-manager")
	seenAs := func(mark string) string {
		t.Helper()
		var addr string
		waitFor(t, "the proxy's log of request "+mark, time.Minute, func() error {
			logs := docker(t, "exec", npm, "sh", "-c", "cat /data/logs/proxy-host-*_access.log")
			m := regexp.MustCompile(`\?n=`+mark+`" \[Client ([0-9a-fA-F.:]+)\]`).FindAllStringSubmatch(logs, -1)
			if m == nil {
				return fmt.Errorf("not in the log yet: %s", tail(logs, 3))
			}
			addr = m[len(m)-1][1]
			return nil
		})
		return addr
	}
	// from sends one request to the proxy from a container on network (at
	// ip, when given) claiming to be visitor, and gives its HTTP status.
	from := func(network, ip, visitor, mark string) string {
		t.Helper()
		args := []string{"run", "--rm", "--network", network}
		if ip != "" {
			args = append(args, "--ip", ip)
		}
		args = append(args, "alpine:3", "sh", "-c",
			"wget -S -q -O /dev/null --header 'Host: "+proxyTestHost+"' --header 'CF-Connecting-IP: "+visitor+"' 'http://nginx-proxy-manager/v1/health?n="+mark+"' 2>&1 | head -1 || true")
		return docker(t, args...)
	}
	from(tunnelNetwork, tunnelAddress, "203.0.113.9", "tunnel")
	if got := seenAs("tunnel"); got != "203.0.113.9" {
		t.Errorf("a request from the tunnel's address naming visitor 203.0.113.9 was seen as %s", got)
	}
	from("homelab", "", "203.0.113.10", "neighbour")
	if got := seenAs("neighbour"); got == "203.0.113.10" {
		t.Errorf("a container on the homelab network chose the address the proxy sees (%s)", got)
	}
	from(tunnelNetwork, "", "203.0.113.11", "stranger")
	if got := seenAs("stranger"); got == "203.0.113.11" {
		t.Errorf("a container on the tunnel's network, not at its address, chose the address the proxy sees (%s)", got)
	}
	req, _ := http.NewRequest(http.MethodGet, proxy+"/v1/health?n=home", nil)
	req.Host = proxyTestHost
	req.Header.Set("CF-Connecting-IP", "203.0.113.12")
	if resp, err := web.Do(req); err == nil {
		resp.Body.Close()
	}
	if got := seenAs("home"); got == "203.0.113.12" {
		t.Errorf("a device at home (the published port) chose the address the proxy sees (%s)", got)
	}
	// A ban on a visitor reaches them through the tunnel, and only them.
	docker(t, "exec", crowdsec, "cscli", "decisions", "add", "--ip", "203.0.113.9", "--duration", "5m", "--reason", "nightly tunnel ban test")
	waitFor(t, "403 through the tunnel for the banned visitor", 2*time.Minute, func() error {
		if out := from(tunnelNetwork, tunnelAddress, "203.0.113.9", "banned"); !strings.Contains(out, "403") {
			return fmt.Errorf("%s", out)
		}
		return nil
	})
	if out := from(tunnelNetwork, tunnelAddress, "203.0.113.13", "other"); !strings.Contains(out, "200") {
		t.Errorf("another visitor through the tunnel was refused while one was banned: %s", out)
	}
	docker(t, "exec", crowdsec, "cscli", "decisions", "delete", "--ip", "203.0.113.9")
	t.Log("the proxy takes the visitor's address from the tunnel's address only; a device at home and other containers are seen as themselves")

	// And the apps behind it get that one address in X-Forwarded-For, never
	// a chain the client began (NPM appends the client's own): an echo app
	// that keeps every request's headers, behind a proxy host of its own.
	const echoHost, echoName = "echo.proxy.test", "homelab-realdocker-echo"
	t.Cleanup(func() { _, _ = exec.Command("docker", "rm", "-f", echoName).CombinedOutput() })
	docker(t, "run", "-d", "--name", echoName, "--network", "homelab", "alpine:3", "sh", "-c",
		`while true; do { printf 'HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok'; sleep 2; } | nc -l -p 8080 >> /tmp/requests; done`)
	echo := map[string]any{
		"domain_names": []string{echoHost}, "forward_scheme": "http", "forward_host": echoName, "forward_port": 8080,
		"access_list_id": 0, "certificate_id": 0, "meta": map[string]any{}, "advanced_config": "", "locations": []any{},
		"block_exploits": false, "caching_enabled": false, "allow_websocket_upgrade": false, "http2_support": false, "hsts_enabled": false, "hsts_subdomains": false, "ssl_forced": false,
	}
	if err := request(http.MethodPost, l.url("nginx-proxy-manager")+"/api/nginx/proxy-hosts", echo, nil, "Authorization", "Bearer "+tok); err != nil {
		t.Fatal(err)
	}
	sendXFF := func(network, ip, mark string, headers ...string) {
		t.Helper()
		args := []string{"run", "--rm", "--network", network}
		if ip != "" {
			args = append(args, "--ip", ip)
		}
		cmd := "wget -q -T 5 -O /dev/null --header 'Host: " + echoHost + "'"
		for _, h := range headers {
			cmd += " --header '" + h + "'"
		}
		args = append(args, "alpine:3", "sh", "-c", cmd+" 'http://nginx-proxy-manager/?n="+mark+"' 2>&1 || true")
		docker(t, args...)
	}
	// forwardedFor sends the request until the echo app has it (it listens
	// again a moment after each answer), and gives its X-Forwarded-For.
	forwardedFor := func(mark, network, ip string, headers ...string) string {
		t.Helper()
		var got string
		waitFor(t, "the echo app's copy of request "+mark, 2*time.Minute, func() error {
			sendXFF(network, ip, mark, headers...)
			reqs := docker(t, "exec", echoName, "cat", "/tmp/requests")
			for _, req := range strings.Split(reqs, "GET ")[1:] {
				if !strings.Contains(req, "?n="+mark+" ") {
					continue
				}
				for _, line := range strings.Split(req, "\n") {
					if k, v, ok := strings.Cut(line, ":"); ok && strings.EqualFold(k, "X-Forwarded-For") {
						got = strings.TrimSpace(v)
						return nil
					}
				}
				return fmt.Errorf("request %s has no X-Forwarded-For:\n%s", mark, req)
			}
			return fmt.Errorf("not there yet: %s", tail(reqs, 5))
		})
		return got
	}
	if got := forwardedFor("visitor", tunnelNetwork, tunnelAddress, "CF-Connecting-IP: 203.0.113.21", "X-Forwarded-For: 198.51.100.7"); got != "203.0.113.21" {
		t.Errorf("an app behind the proxy was told the tunnel's visitor is %q, not 203.0.113.21 alone", got)
	}
	if got := forwardedFor("chain", "homelab", "", "X-Forwarded-For: 203.0.113.22"); strings.Contains(got, "203.0.113.22") || strings.Contains(got, ",") {
		t.Errorf("a container's own X-Forwarded-For reached the app behind the proxy: %q", got)
	}
	t.Log("the apps behind the proxy are told one address, the one the proxy settled on")
}

// The tunnel's own network and cloudflared's address on it (internal/docker).
const (
	tunnelNetwork = "homelab-tunnel"
	tunnelAddress = "198.18.89.2"
)
