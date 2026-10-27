//go:build realdocker

package realdocker

import (
	"cmp"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
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
}
