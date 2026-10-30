package crowdsec

import (
	"strings"
	"testing"
	"time"
)

func TestVerdict(t *testing.T) {
	now := time.Date(2026, 10, 11, 12, 0, 0, 0, time.UTC)
	cases := []struct {
		name, out string
		ok        bool
		want      string
	}{
		{"pulling", `[{"name":"nginx_proxy_manager","revoked":false,"last_pull":"2026-10-11T11:59:20Z"}]`, true, "pulled decisions 40 seconds ago"},
		{"stale", `[{"name":"nginx_proxy_manager","revoked":false,"last_pull":"2026-10-11T11:00:00Z"}]`, false, "60 minutes ago"},
		{"never", `[{"name":"nginx_proxy_manager","revoked":false,"last_pull":null}]`, false, "never pulled"},
		{"revoked", `[{"name":"nginx_proxy_manager","revoked":true,"last_pull":"2026-10-11T11:59:50Z"}]`, false, "revoked"},
		{"missing", `[{"name":"other","revoked":false,"last_pull":"2026-10-11T11:59:50Z"}]`, false, "not registered"},
		// The proxy recreated with a new address: CrowdSec records its pulls
		// under name@address, and the first entry stops moving.
		{"moved", `[{"name":"nginx_proxy_manager","revoked":false,"last_pull":"2026-10-09T08:00:00Z"},{"name":"nginx_proxy_manager@172.18.0.9","revoked":false,"last_pull":"2026-10-11T11:59:30Z"}]`, true, "pulled decisions 30 seconds ago"},
		{"moved, both stale", `[{"name":"nginx_proxy_manager@172.18.0.9","revoked":false,"last_pull":"2026-10-11T11:00:00Z"},{"name":"nginx_proxy_manager","revoked":false,"last_pull":"2026-10-09T08:00:00Z"}]`, false, "60 minutes ago"},
		{"revoked, moved", `[{"name":"nginx_proxy_manager","revoked":true,"last_pull":"2026-10-11T11:59:50Z"},{"name":"nginx_proxy_manager@172.18.0.9","revoked":false,"last_pull":"2026-10-11T11:59:50Z"}]`, true, "10 seconds ago"},
		{"never, year one", `[{"name":"nginx_proxy_manager","revoked":false,"last_pull":"0001-01-01T00:00:00Z"}]`, false, "never pulled"},
		{"another's address", `[{"name":"nginx_proxy_manager_old","revoked":false,"last_pull":"2026-10-11T11:59:50Z"}]`, false, "not registered"},
		{"empty", `[]`, false, "not registered"},
		{"unreadable", "level=fatal msg=\"unable to list bouncers\"\n", false, "could not be read: level=fatal"},
	}
	for _, c := range cases {
		ok, msg := Verdict([]byte(c.out), now)
		if ok != c.ok || !strings.Contains(msg, c.want) {
			t.Errorf("%s: Verdict = %v, %q; want %v, …%s…", c.name, ok, msg, c.ok, c.want)
		}
	}
}

func TestNames(t *testing.T) {
	out := `[{"name":"nginx_proxy_manager"},{"name":"other"},{"name":"nginx_proxy_manager@172.18.0.9"}]`
	if got := strings.Join(Names([]byte(out)), " "); got != "nginx_proxy_manager nginx_proxy_manager@172.18.0.9" {
		t.Errorf("Names = %q", got)
	}
	for _, out := range []string{"not json", "[]"} {
		if got := strings.Join(Names([]byte(out)), " "); got != ProxyBouncer {
			t.Errorf("Names(%q) = %q, want the bouncer's own name", out, got)
		}
	}
}
