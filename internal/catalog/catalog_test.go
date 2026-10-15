package catalog

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

func repoRoot() string {
	_, file, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(file), "..", "..")
}

func load(t *testing.T) *Catalog {
	t.Helper()
	c, err := Load(repoRoot())
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func TestRepoCatalogIsValid(t *testing.T) {
	c := load(t)
	example, err := envfile.Load(filepath.Join(repoRoot(), ".env.example"))
	if err != nil {
		t.Fatal(err)
	}
	declared := map[string]bool{}
	for _, k := range example.Keys() {
		declared[k] = true
	}
	for _, issue := range c.Validate(declared) {
		if issue.Error {
			t.Error(issue)
		}
	}
}

func TestStacksAndProjects(t *testing.T) {
	c := load(t)
	if len(c.Files) < 5 || c.Files[0].Name != "homelab_core" {
		t.Fatalf("expected compose.yaml plus the stacks, got %d files", len(c.Files))
	}
	want := map[string]string{
		"nginx-proxy-manager": "homelab_network",
		"vaultwarden":         "homelab_security",
		"qbittorrent":         "homelab_media_automation",
		"immich-server":       "homelab_immich",
		"paperless":           "homelab_paperless",
		"moneymatter-db":      "homelab_budget_tracker",
		"cloudflared":         "homelab_cloudflare",
	}
	for id, project := range want {
		a, ok := c.Get(id)
		if !ok || a.Project() != project {
			t.Errorf("%s: project %v", id, a)
		}
	}
	if c.SharedNetwork() != "homelab" {
		t.Fatalf("shared network = %q", c.SharedNetwork())
	}
	immich, _ := c.Get("immich")
	if immich.ID != "immich-server" || !immich.Public() || immich.ProxyTarget() != "immich-server" {
		t.Fatalf("immich alias/public/proxy: %+v", immich.Meta)
	}
	if got := c.ExternalNetworks([]*App{immich}); len(got) != 1 || got[0] != "homelab" {
		t.Fatalf("external networks = %v", got)
	}
}

func TestBaselineAndOptional(t *testing.T) {
	c := load(t)
	base := map[string]bool{}
	for _, a := range c.Baseline() {
		base[a.ID] = true
	}
	for _, id := range []string{"nginx-proxy-manager", "crowdsec", "adguard-home", "vaultwarden", "immich-database", "paperless", "moneymatter-frontend", "cloudflared"} {
		if !base[id] {
			t.Errorf("%s should be in the baseline", id)
		}
	}
	for _, id := range []string{"sonarr", "qbittorrent", "homarr", "jellyfin"} {
		if base[id] {
			t.Errorf("%s should not be in the baseline", id)
		}
	}
	jf, ok := c.Get("jellyfin")
	if !ok || jf.Native() == nil || jf.ProxyTarget() != "host.docker.internal" || jf.WebContainerPort(nil) != 8096 {
		t.Fatalf("jellyfin native app: %+v", jf)
	}
	if qb, _ := c.Get("qbittorrent"); qb.ProxyTarget() != "gluetun" || !qb.Optional() {
		t.Fatal("qbittorrent should be optional and proxied through gluetun")
	}
	if npm, _ := c.Get("nginx-proxy-manager"); npm.Watchtower() != "off" {
		t.Fatal("npm must be excluded from Watchtower")
	}
	if mm, _ := c.Get("moneymatter-db"); mm.Watchtower() != "off" {
		t.Fatal("labels from a YAML anchor should be read")
	}
}

func TestDocPaths(t *testing.T) {
	c := load(t)
	for id, want := range map[string]string{
		"sonarr":   "services/media automation/Sonarr.md",
		"jellyfin": "services/media/Jellyfin.md",
		"crowdsec": "services/security/CrowdSec.md",
	} {
		a, _ := c.Get(id)
		if got := c.DocPath(a); got != want {
			t.Errorf("%s: %q, want %q", id, got, want)
		}
	}
}

func TestLookupByAlias(t *testing.T) {
	c := load(t)
	for alias, id := range map[string]string{"overseerr": "seerr", "Jellyseerr": "seerr", "moneymatter": "moneymatter-frontend", "paperless-ngx": "paperless"} {
		a, ok := c.Get(alias)
		if !ok || a.ID != id {
			t.Errorf("Get(%q) = %v, want %s", alias, a, id)
		}
	}
}

func TestValidateCatchesProblems(t *testing.T) {
	core, err := compose.Parse("/r/compose.yaml", []byte(`
name: homelab_core
x-homelab-categories: {media: Media, network: Network}
networks:
  default: {name: homelab, external: true}
services:
  app:
    image: a
    ports: ["${X_PORT}:80"]
    x-homelab: {name: App, category: media, web: 80, requires: [MISSING], dump: mysql}
  pub:
    image: p
    x-homelab: {name: Pub, category: media, web: false, public: true}
  proxy:
    image: x
    x-homelab: {name: Proxy, category: network, web: 81, public: true}
  monitor:
    image: m
    x-homelab: {name: Monitor, category: media, web: 3001, public: true, admin: true}
`))
	if err != nil {
		t.Fatal(err)
	}
	stack, err := compose.Parse("/r/stacks/s/compose.yaml", []byte(`
name: homelab_core
services:
  app:
    image: dup
    x-homelab: {name: Dup, category: media, web: false}
  lonely:
    image: l
    x-homelab: {name: Lonely, category: nope, web: 80, subdomain: app}
`))
	if err != nil {
		t.Fatal(err)
	}
	c := New(core, stack)
	var msgs []string
	for _, i := range c.Validate(map[string]bool{}) {
		msgs = append(msgs, i.String())
	}
	all := strings.Join(msgs, "\n")
	for _, want := range []string{
		"defined in both compose.yaml and stacks/s/compose.yaml",
		"use the same project name",
		"requires MISSING",
		`dump "mysql"`,
		"X_PORT has no default",
		"pub: public apps need a web UI",
		"proxy is an admin app and must not be public",
		"monitor is an admin app and must not be public",
		`category "nope"`,
		`does not join the shared "homelab" network`,
	} {
		if !strings.Contains(all, want) {
			t.Errorf("missing %q in:\n%s", want, all)
		}
	}
}

func TestNewerFormatIsRefused(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "compose.yaml"), []byte("name: homelab_core\nx-homelab-format: 99\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(dir); !errors.Is(err, ErrNewerFormat) {
		t.Fatalf("a newer layout: %v", err)
	}
}

func TestSmallBaseline(t *testing.T) {
	full := load(t)
	c := load(t)
	c.Shrink()
	got := map[string]bool{}
	for _, a := range c.Baseline() {
		got[a.ID] = true
	}
	for _, id := range []string{"watchtower", "duplicati", "ntfy", "uptime-kuma"} {
		if !got[id] {
			t.Errorf("%s left the small baseline", id)
		}
	}
	for _, id := range []string{"immich-server", "paperless", "vaultwarden", "nginx-proxy-manager", "adguard-home"} {
		if got[id] {
			t.Errorf("%s is still in the small baseline", id)
		}
	}
	if len(got) >= len(full.Baseline()) {
		t.Errorf("small baseline has %d apps, full %d", len(got), len(full.Baseline()))
	}

	dir := t.TempDir()
	if SmallBaseline(dir) {
		t.Error("a folder without the kit manifest is full")
	}
	os.WriteFile(filepath.Join(dir, ".homelab-kit.json"), []byte(`{"commit":"abc"}`), 0o644)
	if !SmallBaseline(dir) {
		t.Error("a kit folder before its .env is small")
	}
	os.WriteFile(filepath.Join(dir, ".env"), []byte("TZ=UTC\n"), 0o600)
	if SmallBaseline(dir) {
		t.Error("an existing .env without HOMELAB_BASELINE keeps the full baseline")
	}
	os.WriteFile(filepath.Join(dir, ".env"), []byte("HOMELAB_BASELINE=small\n"), 0o600)
	if !SmallBaseline(dir) {
		t.Error("HOMELAB_BASELINE=small")
	}
}
