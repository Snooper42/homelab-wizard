package main

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/applist"
	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// fakeTunnel is a Cloudflare with one tunnel and one zone: its ingress
// rules and its CNAME records by name, as the homelab reads and writes
// them, and records of the household's own.
type fakeTunnel struct {
	ingress []map[string]any
	dns     map[string]string // name -> CNAME target
	other   map[string]string // name -> an A record's address, not the homelab's
}

func newFakeTunnel(t *testing.T) *fakeTunnel {
	f := &fakeTunnel{dns: map[string]string{}, other: map[string]string{}}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ok := func(v any) { _ = json.NewEncoder(w).Encode(map[string]any{"success": true, "result": v}) }
		body, _ := io.ReadAll(r.Body)
		switch {
		case strings.HasSuffix(r.URL.Path, "/configurations") && r.Method == http.MethodGet:
			ok(map[string]any{"config": map[string]any{"ingress": f.ingress}})
		case strings.HasSuffix(r.URL.Path, "/configurations") && r.Method == http.MethodPut:
			var in struct {
				Config struct {
					Ingress []map[string]any `json:"ingress"`
				} `json:"config"`
			}
			_ = json.Unmarshal(body, &in)
			f.ingress = in.Config.Ingress
			ok(nil)
		case r.URL.Path == "/zones":
			ok([]map[string]string{{"id": "z1"}})
		case r.URL.Path == "/zones/z1/dns_records" && r.Method == http.MethodGet:
			name := r.URL.Query().Get("name")
			switch {
			case f.dns[name] != "":
				ok([]map[string]any{{"id": name, "type": "CNAME", "content": f.dns[name], "proxied": true}})
			case f.other[name] != "":
				ok([]map[string]any{{"id": "own-" + name, "type": "A", "content": f.other[name]}})
			default:
				ok([]any{})
			}
		case r.URL.Path == "/zones/z1/dns_records" && r.Method == http.MethodPost:
			var rec map[string]any
			_ = json.Unmarshal(body, &rec)
			f.dns[rec["name"].(string)] = rec["content"].(string)
			ok(rec)
		case strings.HasPrefix(r.URL.Path, "/zones/z1/dns_records/") && r.Method == http.MethodDelete:
			delete(f.dns, strings.TrimPrefix(r.URL.Path, "/zones/z1/dns_records/"))
			ok(nil)
		default:
			w.WriteHeader(404)
		}
	}))
	t.Cleanup(srv.Close)
	saved := cloudflareAPI
	cloudflareAPI = srv.URL
	t.Cleanup(func() { cloudflareAPI = saved })
	return f
}

// public are the hostnames in the tunnel.
func (f *fakeTunnel) public() []string {
	var out []string
	for _, r := range f.ingress {
		if h, ok := r["hostname"].(string); ok {
			out = append(out, h)
		}
	}
	return out
}

// Reach it away from home, off: the app goes on the household's list and
// its hostname comes out of the tunnel and Cloudflare's DNS, and nothing
// else does; on puts it back. An app that is never public has no switch.
func TestAwayOffKeepsAnAppHomeOnly(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-vaultwarden-1", Image: "vaultwarden/server", Running: true, Project: "homelab_security", Service: "vaultwarden"},
	})
	f := newFakeTunnel(t)
	f.ingress = []map[string]any{
		{"hostname": "passwords.example.com", "service": tunnelService},
		{"hostname": "photos.example.com", "service": tunnelService},
		{"hostname": "homelab-away.example.com", "service": "http://host.docker.internal:8099"},
		{"service": "http_status:404"},
	}
	f.dns["passwords.example.com"] = "tun-1.cfargotunnel.com"
	f.dns["photos.example.com"] = "tun-1.cfargotunnel.com"
	token := base64.StdEncoding.EncodeToString([]byte(`{"a":"acct","t":"tun-1","s":"c2VjcmV0"}`))
	root, _ := repoCopy(t, "TUNNEL_TOKEN="+token, "CLOUDFLARE_API_TOKEN=cf-token", "HOMELAB_DOMAIN=example.com")

	out, code := homelabCmd(t, root, "", "away", "off", "vaultwarden")
	if code != 0 || !strings.Contains(out, "Vaultwarden is home only: passwords.example.com opens on the home network, and nowhere else") {
		t.Fatalf("away off (exit %d):\n%s", code, out)
	}
	if !slices.Contains(applist.HomeOnly.Load(root, nil), "vaultwarden") {
		t.Error("vaultwarden is not on the home-only list")
	}
	if got := strings.Join(f.public(), ","); got != "photos.example.com,homelab-away.example.com" {
		t.Errorf("tunnel after off: %s", got)
	}
	if _, ok := f.dns["passwords.example.com"]; ok || f.dns["photos.example.com"] == "" {
		t.Errorf("dns after off: %v", f.dns)
	}

	out, code = homelabCmd(t, root, "", "away", "on", "vaultwarden")
	if code != 0 || !strings.Contains(out, "Vaultwarden opens away from home at https://passwords.example.com") {
		t.Fatalf("away on (exit %d):\n%s", code, out)
	}
	if slices.Contains(applist.HomeOnly.Load(root, nil), "vaultwarden") {
		t.Error("vaultwarden is still on the home-only list")
	}
	if !slices.Contains(f.public(), "passwords.example.com") || f.dns["passwords.example.com"] != "tun-1.cfargotunnel.com" {
		t.Errorf("on: tunnel %v, dns %v", f.public(), f.dns)
	}

	// A record the household made for the name is theirs: said, not removed.
	delete(f.dns, "passwords.example.com")
	f.other["passwords.example.com"] = "203.0.113.7"
	if out, code = homelabCmd(t, root, "", "away", "off", "vaultwarden"); code != 0 || !strings.Contains(out, "passwords.example.com has its own A record: left as it is") {
		t.Errorf("own record (exit %d):\n%s", code, out)
	}

	if out, code = homelabCmd(t, root, "", "away", "off", "sonarr"); code == 0 || !strings.Contains(out, "never put on the internet") {
		t.Errorf("an app that is never public (exit %d):\n%s", code, out)
	}
	if out, code = homelabCmd(t, root, "", "away", "maybe", "vaultwarden"); code == 0 || !strings.Contains(out, "usage: homelab away on|off") {
		t.Errorf("a wrong word (exit %d):\n%s", code, out)
	}
}

// Without the tunnel set up, the switch is kept for when it is.
func TestAwayWithoutTheTunnelIsKept(t *testing.T) {
	fakeDocker(t, nil)
	root, _ := repoCopy(t)
	out, code := homelabCmd(t, root, "", "away", "off", "paperless")
	if code != 0 || !strings.Contains(out, "Paperless-ngx is home only: it isn't on the internet now") {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	if data, _ := os.ReadFile(filepath.Join(root, "data", "home-only.json")); !strings.Contains(string(data), `"paperless"`) {
		t.Errorf("home-only.json: %s", data)
	}
}

// A public app installed new starts home only; one already there, and an
// app that is never public, are left as they were.
func TestANewPublicAppStartsHomeOnly(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-vaultwarden-1", Image: "vaultwarden/server", Running: false, Project: "homelab_security", Service: "vaultwarden"},
	})
	root, _ := repoCopy(t)
	out, code := homelabCmd(t, root, "", "install", "audiobookshelf", "vaultwarden", "uptime-kuma", "--apply")
	if code != 0 {
		t.Fatalf("install exit %d:\n%s", code, out)
	}
	if got := strings.Join(applist.HomeOnly.Load(root, nil), ","); got != "audiobookshelf" {
		t.Errorf("home only after the install: %q, want audiobookshelf alone", got)
	}
}
