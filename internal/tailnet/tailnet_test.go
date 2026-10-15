package tailnet

import (
	"encoding/json"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
)

func repoCatalog(t *testing.T) *catalog.Catalog {
	t.Helper()
	_, file, _, _ := runtime.Caller(0)
	c, err := catalog.Load(filepath.Join(filepath.Dir(file), "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func TestRoutesAndServeConfig(t *testing.T) {
	c := repoCatalog(t)
	var apps []*catalog.App
	for _, id := range []string{"vaultwarden", "immich-server", "jellyfin", "immich-database", "tailscale"} {
		a, ok := c.Get(id)
		if !ok {
			t.Fatalf("no %s", id)
		}
		apps = append(apps, a)
	}
	lookup := compose.MapLookup(map[string]string{"VAULTWARDEN_PORT": "8087", "IMMICH_PORT": "8013"})
	routes := Routes(apps, lookup)
	got := map[string]string{}
	for _, r := range routes {
		got[r.App.ID] = Address("homelab.tail1.ts.net", r.Port) + " → " + r.Target
	}
	want := map[string]string{
		"vaultwarden":   "homelab.tail1.ts.net:8087 → http://vaultwarden:80",
		"immich-server": "homelab.tail1.ts.net:8013 → http://immich-server:2283",
		"jellyfin":      "homelab.tail1.ts.net:8096 → http://host.docker.internal:8096",
	}
	if len(got) != len(want) {
		t.Fatalf("routes %v", got)
	}
	for k, v := range want {
		if got[k] != v {
			t.Errorf("%s: %q, want %q", k, got[k], v)
		}
	}
	var cfg struct {
		TCP map[string]struct{ HTTPS bool }
		Web map[string]struct {
			Handlers map[string]struct{ Proxy string }
		}
	}
	if err := json.Unmarshal(ServeConfig(routes), &cfg); err != nil {
		t.Fatal(err)
	}
	if !cfg.TCP["8087"].HTTPS || cfg.Web["${TS_CERT_DOMAIN}:8087"].Handlers["/"].Proxy != "http://vaultwarden:80" {
		t.Errorf("serve config: %+v", cfg)
	}
}

func TestParseStatus(t *testing.T) {
	s, err := ParseStatus([]byte(`{"BackendState":"Running","Self":{"DNSName":"homelab.tail1.ts.net.","TailscaleIPs":["fd7a:115c:a1e0::1","100.101.102.103"]}}`))
	if err != nil || !s.Running || s.Host != "homelab.tail1.ts.net" || s.IP != "100.101.102.103" {
		t.Errorf("%+v %v", s, err)
	}
	if s, _ := ParseStatus([]byte(`{"BackendState":"NeedsLogin","Self":{}}`)); s.Running || !strings.EqualFold(s.State, "needslogin") {
		t.Errorf("%+v", s)
	}
}
