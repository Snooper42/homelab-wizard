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
