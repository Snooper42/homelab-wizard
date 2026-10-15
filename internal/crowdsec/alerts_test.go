package crowdsec

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

// sampleAlerts is cscli alerts list -o json as CrowdSec prints it: an
// expired probe, an active virtual-patching ban, and the runbook's manual
// ban test.
const sampleAlerts = `[
 {"id": 3, "scenario": "crowdsecurity/vpatch-CVE-2017-9841", "created_at": "2026-10-11T06:50:00Z",
  "source": {"ip": "203.0.113.7", "cn": "NL", "as_name": "Example Hosting", "scope": "Ip", "value": "203.0.113.7"},
  "decisions": [{"type": "ban", "duration": "3h12m4s", "value": "203.0.113.7", "origin": "crowdsec"}]},
 {"id": 1, "scenario": "crowdsecurity/http-probing", "created_at": "2026-10-09T22:10:00Z",
  "source": {"ip": "198.51.100.4", "cn": "US", "as_name": "Example Cloud", "scope": "Ip", "value": "198.51.100.4"},
  "decisions": [{"type": "ban", "duration": "-30h1m2s", "value": "198.51.100.4", "origin": "crowdsec"}]},
 {"id": 2, "scenario": "manual 'ban' from 'localhost'", "created_at": "2026-10-10T12:00:00Z",
  "source": {"scope": "Ip", "value": "10.0.0.42"},
  "decisions": [{"type": "ban", "duration": "-20h", "value": "10.0.0.42", "origin": "cscli"}]}
]`

func TestParseAlerts(t *testing.T) {
	attacks, err := ParseAlerts([]byte(sampleAlerts))
	if err != nil {
		t.Fatal(err)
	}
	if len(attacks) != 3 {
		t.Fatalf("got %d attacks", len(attacks))
	}
	first := attacks[0]
	if first.Scenario != "vpatch-CVE-2017-9841" || first.IP != "203.0.113.7" || first.Country != "NL" || first.Network != "Example Hosting" || !first.Banned {
		t.Errorf("newest = %+v", first)
	}
	if attacks[1].IP != "10.0.0.42" || attacks[1].Banned || attacks[2].Scenario != "http-probing" || attacks[2].Banned {
		t.Errorf("order or bans wrong: %+v", attacks)
	}
	if empty, err := ParseAlerts([]byte("[]\n")); err != nil || len(empty) != 0 {
		t.Errorf("no alerts: %v %v", empty, err)
	}
}

func TestRead(t *testing.T) {
	now := time.Date(2026, 10, 11, 7, 0, 0, 0, time.UTC)
	exec := func(_ context.Context, args ...string) ([]byte, error) {
		switch strings.Join(args[:2], " ") {
		case "cscli bouncers":
			return []byte(`[{"name":"nginx_proxy_manager","revoked":false,"last_pull":"2026-10-11T06:59:52Z"}]`), nil
		case "cscli alerts":
			return []byte(sampleAlerts), nil
		}
		return nil, errors.New("unexpected " + strings.Join(args, " "))
	}
	p, err := Read(context.Background(), exec, now)
	if err != nil {
		t.Fatal(err)
	}
	if !p.Enforced || p.Week != 3 || p.BannedNow != 1 || len(p.Recent) != 3 || !strings.Contains(p.Bouncer, "8 seconds ago") {
		t.Errorf("protection = %+v", p)
	}
	down := func(context.Context, ...string) ([]byte, error) { return nil, errors.New("container not running") }
	if _, err := Read(context.Background(), down, now); err == nil {
		t.Error("an unreachable CrowdSec should be an error")
	}
}
