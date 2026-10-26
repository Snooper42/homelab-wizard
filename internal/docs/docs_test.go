package docs

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

func generator(t *testing.T, root string) Generator {
	t.Helper()
	c, err := catalog.Load(root)
	if err != nil {
		t.Fatal(err)
	}
	ex, err := envfile.Load(filepath.Join(root, ".env.example"))
	if err != nil {
		t.Fatal(err)
	}
	return Generator{Catalog: c, Env: ex.Map(), Version: "0.1.0-alpha"}
}

func repoRoot() string {
	_, file, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(file), "..", "..")
}

func TestServiceBlocks(t *testing.T) {
	g := generator(t, repoRoot())
	blocks := g.Blocks()
	immich := blocks["services/cloud and files/Immich.md"]
	for _, want := range []string{
		"`immich-server` in `stacks/immich/compose.yaml` (project `homelab_immich`)",
		"https://photos.example.com (LAN and public, through the Cloudflare Tunnel)",
		"http://localhost:8013 (`IMMICH_PORT`)",
		"`immich-database` `ghcr.io/immich-app/postgres:14-vectorchord0.4.3-pgvectors0.2.0@sha256:",
		"dumped daily by `./homelab backup`",
		"`/Volumes/Media/photos` → `/data`",
	} {
		if !strings.Contains(immich, want) {
			t.Errorf("Immich block is missing %q:\n%s", want, immich)
		}
	}
	npm := blocks["services/network/Nginx Proxy Manager.md"]
	if !strings.Contains(npm, "Built locally from `dockerfiles/npm-crowdsec`") || !strings.Contains(npm, "`./homelab update nginx-proxy-manager` rebuilds it. Carries the CrowdSec bouncer") {
		t.Errorf("NPM block:\n%s", npm)
	}
	qb := blocks["services/media automation/qBittorrent.md"]
	if !strings.Contains(qb, "No: optional, `./homelab install qbittorrent`") || !strings.Contains(qb, "http://localhost:8082 (`QBITTORRENT_PORT`)") {
		t.Errorf("qBittorrent block:\n%s", qb)
	}
	jf := blocks["services/media/Jellyfin.md"]
	if !strings.Contains(jf, "A native app, not a container") || !strings.Contains(jf, "http://localhost:8096") {
		t.Errorf("Jellyfin block:\n%s", jf)
	}
	inv := blocks["docs/Inventory.md"]
	if !strings.Contains(inv, "[Immich](<../services/cloud and files/Immich.md>)") || !strings.Contains(inv, "- photos.example.com") || strings.Contains(inv, "- npm.example.com") {
		t.Errorf("inventory:\n%s", inv)
	}
	if !strings.Contains(blocks["docs/Services.md"], "[Sonarr](<../services/media automation/Sonarr.md>)") {
		t.Error("services index should link notes by category folder")
	}
	upd := blocks["docs/Automation.md"]
	for _, want := range []string{
		"### Nightly, by Watchtower (",
		"| [Vaultwarden](<../services/security/Vaultwarden.md>) | `vaultwarden/server:latest` |\n",
		"### Built locally (1)",
		"| `moneymatter-db` | `postgres:16` | A database or cache",
		"| `moneymatter-rates` | `letehaha/currency-rates-api:latest` | Publishes only a latest tag",
	} {
		if !strings.Contains(upd, want) {
			t.Errorf("update table is missing %q:\n%s", want, upd)
		}
	}
}

func TestSyncCreatesAndRefreshes(t *testing.T) {
	root := t.TempDir()
	src := repoRoot()
	files, _ := filepath.Glob(filepath.Join(src, "stacks", "*", "compose.yaml"))
	parts, _ := filepath.Glob(filepath.Join(src, "compose", "*.yaml"))
	files = append(files, parts...)
	for _, f := range append(files, filepath.Join(src, "compose.yaml"), filepath.Join(src, ".env.example")) {
		rel, _ := filepath.Rel(src, f)
		data, _ := os.ReadFile(f)
		_ = os.MkdirAll(filepath.Dir(filepath.Join(root, rel)), 0o755)
		_ = os.WriteFile(filepath.Join(root, rel), data, 0o644)
	}
	g := generator(t, root)
	_, issues, err := g.Sync(false)
	if err != nil || len(issues) < 10 {
		t.Fatalf("an empty knowledge base should report missing notes: %v %v", issues, err)
	}
	_ = os.MkdirAll(filepath.Join(root, "docs"), 0o755)
	for _, name := range []string{"Inventory.md", "Services.md", "Automation.md"} {
		_ = os.WriteFile(filepath.Join(root, "docs", name), []byte("---\nversion: 0.1.0-alpha\n---\n# X\n\n"+Begin+"\nstale placeholder\n"+End+"\n\nHand-written.\n"), 0o644)
	}
	changed, issues, err := g.Sync(true)
	if err != nil || len(issues) != 0 || len(changed) < 10 {
		t.Fatalf("apply: changed %d, issues %v, %v", len(changed), issues, err)
	}
	note, _ := os.ReadFile(filepath.Join(root, "services", "media automation", "Sonarr.md"))
	if !strings.HasPrefix(string(note), "---\nversion: 0.1.0-alpha\n---\n\n# Sonarr") || !strings.Contains(string(note), "## Troubleshooting") {
		t.Fatalf("skeleton:\n%s", note)
	}
	inv, _ := os.ReadFile(filepath.Join(root, "docs", "Inventory.md"))
	if strings.Contains(string(inv), "stale placeholder") || !strings.Contains(string(inv), "Hand-written.") {
		t.Fatalf("only the generated block should change:\n%s", inv)
	}
	if changed, issues, _ := g.Sync(false); len(changed) != 0 || len(issues) != 0 {
		t.Fatalf("second run should be clean: %v %v", changed, issues)
	}
	if v := CheckVersions(root, "0.1.0-alpha", "docs", "services"); len(v) != 0 {
		t.Fatalf("versions: %v", v)
	}
	_ = os.WriteFile(filepath.Join(root, "docs", "Old.md"), []byte("# no front matter\n"), 0o644)
	if v := CheckVersions(root, "0.1.0-alpha", "docs"); len(v) != 1 || v[0].Path != "docs/Old.md" {
		t.Fatalf("versions: %v", v)
	}
}
