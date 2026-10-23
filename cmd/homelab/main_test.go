package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/diskhealth"
	"github.com/Snooper42/homelab-wizard/internal/diskspace"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/notify"
	"github.com/Snooper42/homelab-wizard/internal/npm/npmtest"
	"github.com/Snooper42/homelab-wizard/internal/ports"
	"github.com/Snooper42/homelab-wizard/internal/releases"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// freePorts reports every host port as free, so end-to-end plans are the
// same on any machine (CI runners hold port 53 and refuse 80 and 443).
type freePorts struct{}

func (freePorts) Free(string, int, string) bool { return true }

func TestMain(m *testing.M) {
	newProber = func() ports.Prober { return freePorts{} }
	desktopNotify = func(context.Context, string, string) error { return nil }
	installJobs = func(context.Context, *homelab) error { return nil }
	releases.API = "http://127.0.0.1:1" // never GitHub
	os.Exit(m.Run())
}

// fakeDocker installs a `docker` script on PATH that serves the given
// containers, keeps networks in a folder, answers pg_dumpall, and records
// every call.
func fakeDocker(t *testing.T, ctrs []docker.FakeContainer) (callsLog string) {
	t.Helper()
	dir := t.TempDir()
	fake := &docker.FakeRunner{Containers: ctrs}
	ids, _ := fake.Output(context.Background(), "docker", "ps")
	inspect, _ := fake.Output(context.Background(), "docker", "inspect")
	info, _ := fake.Output(context.Background(), "docker", "info")
	for name, data := range map[string][]byte{"ids.txt": ids, "inspect.json": inspect, "info.json": info} {
		if err := os.WriteFile(filepath.Join(dir, name), data, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	script := `#!/bin/bash
d="$(dirname "$0")"
echo "$*" >> "$d/calls.log"
case "$1" in
  info) cat "$d/info.json" ;;
  ps) cat "$d/ids.txt" ;;
  inspect) cat "$d/inspect.json" ;;
  network)
    case "$2" in
      inspect) [ -e "$d/net-$3" ] || exit 1 ;;
      create) touch "$d/net-$3" ;;
    esac ;;
  exec)
    case "$*" in
      *pg_dumpall*) printf 'CREATE ROLE x;\n-- PostgreSQL database cluster dump complete\n' ;;
      *"from pg_database"*) echo "${FAKE_PG_DATABASES:-1}" ;;
      *"from pg_tables"*) echo "public|tx|public.tx" ;;
      *"(select * from"*) printf 'id,note\n1,coffee\n' ;;
      *albumName*) printf 'Summer,anna@example.com,IMG_1.HEIC,/data/library/anna/IMG_1.HEIC\n' ;;
      *"token add"*) echo "token tk_abc123def created for user homelab, never expires" ;;
      *"tailscale status --json"*) [ -n "$FAKE_TS_STATUS" ] && [ -f "$FAKE_TS_STATUS" ] && { cat "$FAKE_TS_STATUS"; exit 0; }; echo '{"BackendState":"Running","CertDomains":["homelab.tail1.ts.net"],"Self":{"DNSName":"homelab.tail1.ts.net.","TailscaleIPs":["100.101.102.103"]}}' ;;
      *"bouncers list"*) echo '[{"name":"nginx_proxy_manager","revoked":false,"last_pull":"2020-01-01T00:00:00Z"}]' ;;
    esac ;;
  run)
    case "$*" in
      *"tar czf -"*) tmp="$(mktemp -d)"; echo receipt > "$tmp/receipt.pdf"; tar czf - -C "$tmp" . ;;
    esac ;;
  compose) [ "$2" = version ] && echo 2.40.3 ;;
  system)
    [ "$2" = df ] && printf '%s\n' '{"Type":"Images","Size":"24.1GB","Reclaimable":"12.3GB (51%)"}' '{"Type":"Build Cache","Size":"0B","Reclaimable":"0B"}' ;;
esac
exit 0
`
	if err := os.WriteFile(filepath.Join(dir, "docker"), []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir+string(os.PathListSeparator)+os.Getenv("PATH"))
	return filepath.Join(dir, "calls.log")
}

func repoDir() string {
	_, file, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(file), "..", "..")
}

// repoCopy makes a throwaway homelab with the real compose files, an .env
// built from the given lines, and a mounted "media drive".
func repoCopy(t *testing.T, env ...string) (root, media string) {
	t.Helper()
	src := repoDir()
	root, media = t.TempDir(), t.TempDir()
	files, _ := filepath.Glob(filepath.Join(src, "stacks", "*", "compose.yaml"))
	parts, _ := filepath.Glob(filepath.Join(src, "compose", "*.yaml"))
	files = append(files, parts...)
	files = append(files, filepath.Join(src, "compose.yaml"), filepath.Join(src, ".env.example"), filepath.Join(src, "VERSION"), filepath.Join(src, "config", "crowdsec", "acquis.yaml"))
	for _, f := range files {
		rel, _ := filepath.Rel(src, f)
		data, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		_ = os.MkdirAll(filepath.Dir(filepath.Join(root, rel)), 0o755)
		if err := os.WriteFile(filepath.Join(root, rel), data, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	env = append([]string{"MEDIA_ROOT=" + media, "IMMICH_UPLOAD_LOCATION=" + filepath.Join(media, "photos"), "DOWNLOADS_ROOT=" + filepath.Join(media, "downloads"), "BACKUP_DESTINATION=" + t.TempDir()}, env...)
	if err := os.WriteFile(filepath.Join(root, ".env"), []byte(strings.Join(env, "\n")+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	return root, media
}

func homelabCmd(t *testing.T, root, input string, args ...string) (string, int) {
	t.Helper()
	var out bytes.Buffer
	u := &ui.UI{Out: &out, In: bufio.NewReader(strings.NewReader(input))}
	code := run(context.Background(), u, append([]string{"--root", root}, args...))
	return out.String(), code
}

func readCalls(t *testing.T, path string) string {
	t.Helper()
	data, _ := os.ReadFile(path)
	return string(data)
}

func TestUpStartsTheBaselineAcrossProjects(t *testing.T) {
	calls := fakeDocker(t, nil)
	root, media := repoCopy(t)

	out, code := homelabCmd(t, root, "", "up")
	if code != 0 || !strings.Contains(out, "Preview only") {
		t.Fatalf("up without --apply outside a terminal must only preview (exit %d):\n%s", code, out)
	}
	if strings.Contains(readCalls(t, calls), "compose --project-directory") {
		t.Fatal("a preview must not start anything")
	}

	out, code = homelabCmd(t, root, "", "up", "--apply")
	if code != 0 {
		t.Fatalf("up exit %d:\n%s", code, out)
	}
	if !strings.Contains(out, "cloudflared") || !strings.Contains(out, "set TUNNEL_TOKEN in .env first") {
		t.Errorf("the tunnel should wait for its token:\n%s", out)
	}
	log := readCalls(t, calls)
	for _, want := range []string{
		"network create homelab",
		"-p homelab_network --env-file " + filepath.Join(root, ".env") + " up --detach --no-recreate nginx-proxy-manager adguard-home",
		"-p homelab_security --env-file " + filepath.Join(root, ".env") + " up --detach --no-recreate crowdsec vaultwarden uptime-kuma ntfy",
		"-p homelab_media --env-file " + filepath.Join(root, ".env") + " up --detach --no-recreate navidrome feishin audiobookshelf calibre-web komga",
		"-p homelab_budget_tracker",
		"-p homelab_immich",
		"-p homelab_paperless",
	} {
		if !strings.Contains(log, want) {
			t.Errorf("missing %q in docker calls:\n%s", want, log)
		}
	}
	if strings.Contains(log, "homelab_cloudflare") || strings.Contains(log, "--profile optional") {
		t.Errorf("only the baseline should start:\n%s", log)
	}
	for _, dir := range []string{filepath.Join(root, "data", "appdata", "vaultwarden"), filepath.Join(root, "appdata", "paperless", "consume"), filepath.Join(media, "music")} {
		if _, err := os.Stat(dir); err != nil {
			t.Errorf("%s was not created", dir)
		}
	}
	env, _ := envfile.Load(filepath.Join(root, ".env"))
	if v, _ := env.Get("PAPERLESS_SECRET_KEY"); envfile.Placeholder.MatchString(v) || len(v) != 64 {
		t.Fatalf("secrets should be generated, got %q", v)
	}
}

func TestInstallSkipsRunningApps(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_media_automation-sonarr-1", Image: "lscr.io/linuxserver/sonarr", Running: true, Project: "homelab_media_automation", Service: "sonarr"},
		{Name: "radarr", Image: "hotio/radarr", Running: true},
	})
	root, _ := repoCopy(t)
	out, code := homelabCmd(t, root, "", "install", "sonarr", "radarr", "overseerr", "lidarr", "--apply")
	if code != 0 {
		t.Fatalf("install exit %d:\n%s", code, out)
	}
	for _, want := range []string{"overseerr is provided by seerr", "already running", `already running as container "radarr"`} {
		if !strings.Contains(out, want) {
			t.Errorf("output is missing %q:\n%s", want, out)
		}
	}
	if log := readCalls(t, calls); !strings.Contains(log, "--profile optional up --detach --no-recreate lidarr seerr") {
		t.Fatalf("compose was not called as expected:\n%s", log)
	}
}

func TestDomainSetupEndToEnd(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_network-nginx-proxy-manager-1", Image: "homelab/nginx-proxy-manager-crowdsec", Running: true, Project: "homelab_network", Service: "nginx-proxy-manager"},
		{Name: "homelab_network-adguard-home-1", Image: "adguard/adguardhome", Running: true, Project: "homelab_network", Service: "adguard-home"},
		{Name: "homelab_security-vaultwarden-1", Image: "vaultwarden/server", Running: true, Project: "homelab_security", Service: "vaultwarden"},
		{Name: "homelab_immich-immich-server-1", Image: "ghcr.io/immich-app/immich-server:v3", Running: true, Project: "homelab_immich", Service: "immich-server"},
		{Name: "homelab_security-uptime-kuma-1", Image: "louislam/uptime-kuma:2", Running: true, Project: "homelab_security", Service: "uptime-kuma"},
	})
	npmSrv := npmtest.NewFakeServer("homelab@example.com", "npm-pw")
	defer npmSrv.Close()

	rewrites := map[string]string{}
	agSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if u, p, _ := r.BasicAuth(); u != "admin" || p != "ag-pw" {
			w.WriteHeader(401)
			return
		}
		switch r.URL.Path {
		case "/control/rewrite/list":
			var list []map[string]string
			for d, a := range rewrites {
				list = append(list, map[string]string{"domain": d, "answer": a})
			}
			_ = json.NewEncoder(w).Encode(list)
		case "/control/rewrite/add":
			var in map[string]string
			_ = json.NewDecoder(r.Body).Decode(&in)
			rewrites[in["domain"]] = in["answer"]
		}
	}))
	defer agSrv.Close()

	var ingress []map[string]any
	dns := map[string]string{}
	cfSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ok := func(v any) { _ = json.NewEncoder(w).Encode(map[string]any{"success": true, "result": v}) }
		body, _ := io.ReadAll(r.Body)
		switch {
		case strings.HasSuffix(r.URL.Path, "/configurations") && r.Method == http.MethodGet:
			ok(map[string]any{"config": map[string]any{"ingress": ingress}})
		case strings.HasSuffix(r.URL.Path, "/configurations") && r.Method == http.MethodPut:
			var in struct {
				Config struct {
					Ingress []map[string]any `json:"ingress"`
				} `json:"config"`
			}
			_ = json.Unmarshal(body, &in)
			ingress = in.Config.Ingress
			ok(nil)
		case r.URL.Path == "/zones":
			ok([]map[string]string{{"id": "z1"}})
		case r.URL.Path == "/zones/z1/dns_records" && r.Method == http.MethodGet:
			name := r.URL.Query().Get("name")
			if target, ok2 := dns[name]; ok2 {
				ok([]map[string]any{{"id": name, "type": "CNAME", "content": target, "proxied": true}})
				return
			}
			ok([]any{})
		case r.URL.Path == "/zones/z1/dns_records" && r.Method == http.MethodPost:
			var rec map[string]any
			_ = json.Unmarshal(body, &rec)
			dns[rec["name"].(string)] = rec["content"].(string)
			ok(rec)
		default:
			w.WriteHeader(404)
		}
	}))
	defer cfSrv.Close()
	cloudflareAPI = cfSrv.URL
	defer func() { cloudflareAPI = "https://api.cloudflare.com/client/v4" }()

	npmURL, _ := url.Parse(npmSrv.URL)
	agURL, _ := url.Parse(agSrv.URL)
	token := base64.StdEncoding.EncodeToString([]byte(`{"a":"acct","t":"tun-1","s":"c2VjcmV0"}`))
	root, _ := repoCopy(t,
		"NPM_ADMIN_PORT="+npmURL.Port(), "NPM_API_EMAIL=homelab@example.com", "NPM_API_PASSWORD=npm-pw",
		"ADGUARD_PORT="+agURL.Port(), "ADGUARD_USER=admin", "ADGUARD_PASSWORD=ag-pw",
		"TUNNEL_TOKEN="+token, "CLOUDFLARE_API_TOKEN=cf-token", "HOMELAB_DOMAIN=example.com")

	out, code := homelabCmd(t, root, "", "domain", "setup", "Example.com", "--ip", "192.168.1.10", "--dry-run", "--ssl=false")
	if code != 0 || !strings.Contains(out, "http://photos.example.com") || !strings.Contains(out, "AdGuard Home: *.example.com → 192.168.1.10") {
		t.Fatalf("dry run exit %d:\n%s", code, out)
	}
	// With a Cloudflare token the certificate comes along by default.
	if out, _ = homelabCmd(t, root, "", "domain", "setup", "example.com", "--ip", "192.168.1.10", "--dry-run"); !strings.Contains(out, "https://photos.example.com") {
		t.Fatalf("dry run with a Cloudflare token should plan https:\n%s", out)
	}
	if len(npmSrv.Hosts) != 0 || len(rewrites) != 0 || len(dns) != 0 {
		t.Fatal("a dry run must not change anything")
	}

	// After an install, --auto waits for Set up the domain (no certificate yet).
	if out, code = homelabCmd(t, root, "", "domain", "setup", "--auto", "--apps", "vaultwarden"); code != 0 || !strings.Contains(out, "once Setup › Set up the domain has run") || len(npmSrv.Hosts) != 0 {
		t.Fatalf("auto before setup (exit %d, %d hosts):\n%s", code, len(npmSrv.Hosts), out)
	}

	out, code = homelabCmd(t, root, "", "domain", "setup", "example.com", "--ip", "192.168.1.10", "--apply")
	if code != 0 {
		t.Fatalf("domain setup exit %d:\n%s", code, out)
	}
	hosts := map[string]string{}
	for _, h := range npmSrv.Hosts {
		hosts[h.DomainNames[0]] = h.ForwardHost
		if h.CertificateID == 0 || !h.SSLForced {
			t.Errorf("%s should use the wildcard certificate", h.DomainNames[0])
		}
		if !h.TrustForwardedProto {
			t.Errorf("%s should trust X-Forwarded-Proto from the tunnel", h.DomainNames[0])
		}
	}
	for host, target := range map[string]string{
		"photos.example.com":    "immich-server",
		"passwords.example.com": "vaultwarden",
		"uptime.example.com":    "uptime-kuma",
		"npm.example.com":       "nginx-proxy-manager",
		"jellyfin.example.com":  "host.docker.internal",
	} {
		if hosts[host] != target {
			t.Errorf("%s -> %q, want %s (all: %v)", host, hosts[host], target, hosts)
		}
	}
	if rewrites["*.example.com"] != "192.168.1.10" {
		t.Errorf("AdGuard rewrites: %v", rewrites)
	}
	public := map[string]bool{}
	for _, r := range ingress {
		if h, ok := r["hostname"].(string); ok {
			public[h] = true
			if r["service"] != "http://nginx-proxy-manager:80" {
				t.Errorf("%s should go through the proxy, got %v", h, r["service"])
			}
		}
	}
	if !public["photos.example.com"] || !public["passwords.example.com"] || public["uptime.example.com"] || public["npm.example.com"] {
		t.Errorf("only public apps belong in the tunnel: %v", public)
	}
	if dns["photos.example.com"] != "tun-1.cfargotunnel.com" {
		t.Errorf("dns: %v", dns)
	}

	// Re-running changes nothing.
	out, code = homelabCmd(t, root, "", "domain", "setup", "example.com", "--ip", "192.168.1.10", "--apply")
	if code != 0 || strings.Contains(out, "created") || !strings.Contains(out, "unchanged") || !strings.Contains(out, "ingress unchanged") {
		t.Fatalf("second run exit %d:\n%s", code, out)
	}

	// A newly installed app gets its host by itself, without a prompt.
	n := len(npmSrv.Hosts)
	for id, h := range npmSrv.Hosts {
		if h.DomainNames[0] == "uptime.example.com" {
			delete(npmSrv.Hosts, id)
		}
	}
	out, code = homelabCmd(t, root, "", "domain", "setup", "--auto", "--apps", "uptime-kuma")
	if code != 0 || len(npmSrv.Hosts) != n || !strings.Contains(out, "https://uptime.example.com") {
		t.Fatalf("auto after setup (exit %d, %d of %d hosts):\n%s", code, len(npmSrv.Hosts), n, out)
	}
}

func TestBackupWritesVerifiedFiles(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_paperless-paperless-db-1", Image: "postgres:18", Running: true, Project: "homelab_paperless", Service: "paperless-db"},
		{Name: "homelab_budget_tracker-moneymatter-backend-1", Image: "letehaha/budget-tracker-be:sha-f862f3d", Running: true, Project: "homelab_budget_tracker", Service: "moneymatter-backend"},
	})
	root, _ := repoCopy(t)
	out, code := homelabCmd(t, root, "", "backup", "--apply")
	if code != 0 {
		t.Fatalf("backup exit %d:\n%s", code, out)
	}
	dumps, _ := filepath.Glob(filepath.Join(root, "recovery-staging", "databases", "paperless-db", "paperless-db-*.sql.gz"))
	if len(dumps) != 1 || !strings.Contains(out, "immich-database (not installed, skipped)") {
		t.Fatalf("dumps %v\n%s", dumps, out)
	}
	if _, err := os.Stat(filepath.Join(root, "recovery-staging", "secrets", "homelab.env")); err != nil {
		t.Fatal(".env should be copied into recovery-staging/secrets")
	}
	archives, _ := filepath.Glob(filepath.Join(root, "recovery-staging", "volumes", "moneymatter-attachments", "moneymatter-attachments-*.tar.gz"))
	if len(archives) != 1 || !strings.Contains(readCalls(t, calls), "run --rm -v homelab_budget_tracker_moneymatter-attachments:/data:ro alpine:3 tar czf - -C /data .") {
		t.Fatalf("attachments archive: %v\n%s", archives, out)
	}
}

func TestBackupFailsWhenADatabaseIsStopped(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_paperless-paperless-db-1", Image: "postgres:18", Running: false, Project: "homelab_paperless", Service: "paperless-db"},
	})
	root, _ := repoCopy(t)
	out, code := homelabCmd(t, root, "", "backup", "--apply")
	if code == 0 || !strings.Contains(out, "paperless-db is not running: not backed up") {
		t.Fatalf("a stopped database must fail the backup, exit %d:\n%s", code, out)
	}
	if _, code := homelabCmd(t, root, "", "backup", "--apply", "--keep", "0"); code == 0 {
		t.Fatal("--keep 0 would delete the dump just made")
	}
}

func TestValidateAndUsage(t *testing.T) {
	root := repoDir()
	if out, code := homelabCmd(t, root, "", "validate"); code != 0 {
		t.Fatalf("validate failed:\n%s", out)
	}
	if out, code := homelabCmd(t, root, "", "frobnicate"); code != 2 || !strings.Contains(out, "unknown command") {
		t.Fatalf("unknown command: %d %s", code, out)
	}
	if out, code := homelabCmd(t, root, "", "apps", "--category", "media-automation"); code != 0 || !strings.Contains(out, "sonarr") || strings.Contains(out, "jellyfin") {
		t.Fatalf("apps --category media-automation:\n%s", out)
	}
}

func TestJSONInstallWithFormSettings(t *testing.T) {
	calls := fakeDocker(t, nil)
	root, _ := repoCopy(t)
	out, code := homelabCmd(t, root, "# from the form\nPROTONVPN_WIREGUARD_PRIVATE_KEY=s3cret\n", "--json", "install", "qbittorrent", "--set-stdin", "--apply")
	if code != 0 {
		t.Fatalf("install exit %d:\n%s", code, out)
	}
	if strings.Contains(out, "s3cret") {
		t.Fatalf("output echoes the secret:\n%s", out)
	}
	var types []string
	var plan struct {
		Data struct {
			Start []string `json:"start"`
			Added map[string]string
			Env   []struct{ Key, Value string }
		}
	}
	steps := 0
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		var msg struct {
			Type string
			Data json.RawMessage
		}
		if err := json.Unmarshal([]byte(line), &msg); err != nil {
			t.Fatalf("not JSON: %q", line)
		}
		types = append(types, msg.Type)
		switch msg.Type {
		case "plan":
			_ = json.Unmarshal([]byte(line), &plan)
		case "progress":
			steps++
		}
	}
	if types[0] != "plan" || types[len(types)-1] != "done" || steps != 8 {
		t.Fatalf("message types %v", types)
	}
	if strings.Join(plan.Data.Start, ",") != "gluetun,qbittorrent" || plan.Data.Added["gluetun"] != "qbittorrent" {
		t.Fatalf("plan %+v", plan.Data)
	}
	env, _ := os.ReadFile(filepath.Join(root, ".env"))
	if !strings.Contains(string(env), "PROTONVPN_WIREGUARD_PRIVATE_KEY=s3cret") {
		t.Fatalf(".env is missing the setting:\n%s", env)
	}
	if log := readCalls(t, calls); !strings.Contains(log, "up --detach --no-recreate gluetun qbittorrent") {
		t.Fatalf("compose was not called as expected:\n%s", log)
	}

	out, code = homelabCmd(t, root, "", "--json", "apps")
	if code != 0 || !strings.Contains(out, `"token":"stack:immich"`) || !strings.Contains(out, `"token":"@arr"`) {
		t.Fatalf("apps exit %d, presets missing:\n%.400s", code, out)
	}
	out, code = homelabCmd(t, root, "", "--json", "install", "stack:paperless")
	if code != 0 || !strings.HasSuffix(strings.TrimSpace(out), `{"schema":1,"type":"preview"}`) || !strings.Contains(out, `"requested":["paperless"`) {
		t.Fatalf("install without --apply exit %d:\n%s", code, out)
	}
}

func TestAdoptStopsTheOldContainerAndStartsTheApp(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "vaultwarden", Image: "vaultwarden/server:latest", Running: true},
	})
	root, _ := repoCopy(t)
	out, code := homelabCmd(t, root, "", "adopt", "vaultwarden")
	if code != 0 || !strings.Contains(out, "from container vaultwarden") || !strings.Contains(out, "Preview only") {
		t.Fatalf("preview exit %d:\n%s", code, out)
	}
	if log := readCalls(t, calls); strings.Contains(log, "stop") {
		t.Fatalf("the preview stopped something:\n%s", log)
	}
	out, code = homelabCmd(t, root, "", "adopt", "vaultwarden", "--apply")
	if code != 0 || !strings.Contains(out, "To go back: homelab remove vaultwarden --apply, then docker start vaultwarden") {
		t.Fatalf("adopt exit %d:\n%s", code, out)
	}
	// The fake keeps reporting the old container as running, so the install
	// that follows skips it; on a real engine the stopped container frees it.
	if log := readCalls(t, calls); !strings.Contains(log, "stop vaultwarden") || !strings.Contains(out, "Start in the homelab") {
		t.Fatalf("docker was not called as expected:\n%s\n%s", log, out)
	}
}

func TestParseSize(t *testing.T) {
	for in, want := range map[string]float64{"512KiB": 512 << 10, "1.5GiB": 1.5 * (1 << 30), "300MB": 300e6, " 20MiB ": 20 << 20, "0B": 0, "junk": 0} {
		if got := parseSize(in); got != want {
			t.Errorf("parseSize(%q) = %v, want %v", in, got, want)
		}
	}
}

func TestSignupsCloseRecreatesVaultwarden(t *testing.T) {
	calls := fakeDocker(t, nil)
	root, _ := repoCopy(t, "VAULTWARDEN_SIGNUPS_ALLOWED=true")
	if out, code := homelabCmd(t, root, "", "signups", "close"); code != 0 {
		t.Fatalf("close exit %d:\n%s", code, out)
	}
	env, _ := os.ReadFile(filepath.Join(root, ".env"))
	if !strings.Contains(string(env), "VAULTWARDEN_SIGNUPS_ALLOWED=false") {
		t.Fatalf(".env:\n%s", env)
	}
	if log := readCalls(t, calls); !strings.Contains(log, "up --detach vaultwarden") {
		t.Fatalf("vaultwarden was not recreated:\n%s", log)
	}
	if out, _ := homelabCmd(t, root, "", "signups"); !strings.Contains(out, "closed") {
		t.Fatalf("status: %s", out)
	}
}

func TestCleanupRemovesOnlyReplacedContainers(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-vaultwarden-1", Image: "vaultwarden/server:latest", Running: true, Project: "homelab_security", Service: "vaultwarden"},
		{Name: "vaultwarden", Image: "vaultwarden/server:latest"},
		{Name: "kavita", Image: "jvmilazz0/kavita:latest"}, // not moved yet: kept
	})
	root, _ := repoCopy(t)
	out, code := homelabCmd(t, root, "", "cleanup", "--apply")
	if code != 0 || !strings.Contains(out, "remove container vaultwarden") || strings.Contains(out, "container kavita") {
		t.Fatalf("cleanup exit %d:\n%s", code, out)
	}
	log := readCalls(t, calls)
	if !strings.Contains(log, "rm vaultwarden\n") || strings.Contains(log, "kavita") {
		t.Fatalf("docker calls:\n%s", log)
	}
}

func TestNotifySetupUsesAToken(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-ntfy-1", Image: "binwiederhier/ntfy:latest", Running: true, Project: "homelab_security", Service: "ntfy"},
	})
	root, _ := repoCopy(t)
	out, code := homelabCmd(t, root, "", "notify", "setup", "--apply")
	if code != 0 {
		t.Fatalf("notify setup exit %d:\n%s", code, out)
	}
	env, _ := os.ReadFile(filepath.Join(root, ".env"))
	if !strings.Contains(string(env), "NTFY_PUBLISH_TOKEN=tk_abc123def") || !strings.Contains(string(env), "NTFY_PUBLISH_AUTH=QmVhcmVyIHRrX2FiYzEyM2RlZg") {
		t.Fatalf(".env:\n%s", env)
	}
	log := readCalls(t, calls)
	for _, want := range []string{"access homelab watchtower write-only", "access --reset * watchtower", "token add --label=homelab homelab", "up --detach watchtower"} {
		if !strings.Contains(log, want) {
			t.Errorf("missing %q in:\n%s", want, log)
		}
	}
	if strings.Contains(out, "NTFY_PASSWORD=") {
		t.Fatal("the publisher password was printed")
	}
	// The phone's account: its generated password in .env, passed to docker
	// through the environment only.
	phone := regexp.MustCompile(`NTFY_PHONE_PASSWORD=(\S{32})`).FindStringSubmatch(string(env))
	if phone == nil {
		t.Fatalf("no phone password in .env:\n%s", env)
	}
	if !strings.Contains(log, "exec -e NTFY_PASSWORD homelab_security-ntfy-1 ntfy user add phone") || !strings.Contains(log, "access phone duplicati-alerts read-only") {
		t.Errorf("phone user not made:\n%s", log)
	}
	if strings.Contains(log, phone[1]) || strings.Contains(out, phone[1]) {
		t.Error("the phone password reached a command line or the output")
	}
	// Run again: the password is kept, not regenerated.
	if out, code := homelabCmd(t, root, "", "notify", "setup", "--apply"); code != 0 {
		t.Fatalf("second run exit %d:\n%s", code, out)
	}
	if env2, _ := os.ReadFile(filepath.Join(root, ".env")); !strings.Contains(string(env2), "NTFY_PHONE_PASSWORD="+phone[1]) {
		t.Error("the phone password changed on a second run")
	}
}

func TestWatchdogChecksEveryApp(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-vaultwarden-1", Image: "vaultwarden/server:latest", Running: true, Health: "unhealthy", Project: "homelab_security", Service: "vaultwarden"},
		{Name: "homelab_security-ntfy-1", Image: "binwiederhier/ntfy:latest", Running: true, Health: "healthy", Project: "homelab_security", Service: "ntfy"},
	})
	root, _ := repoCopy(t, "UPDATES_PAUSED=true", "TUNNEL_TOKEN=")
	out, code := homelabCmd(t, root, "", "watchdog")
	if code == 0 {
		t.Fatalf("watchdog passed with failures:\n%s", out)
	}
	for _, want := range []string{"vaultwarden: container unhealthy", "nginx-proxy-manager: not running", "✓ ntfy"} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q:\n%s", want, out)
		}
	}
	for _, unwanted := range []string{"watchtower", "cloudflared", "sonarr", "moneymatter-db"} {
		if strings.Contains(out, unwanted) {
			t.Errorf("%s should not be checked:\n%s", unwanted, out)
		}
	}
}

func TestWatchdogNoticesACrashLoop(t *testing.T) {
	// Docker reports a container waiting to be restarted as running; its
	// health check may still say starting.
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-vaultwarden-1", Image: "vaultwarden/server:latest", Running: true, Status: "restarting", Health: "starting", Project: "homelab_security", Service: "vaultwarden"},
	})
	root, _ := repoCopy(t, "UPDATES_PAUSED=true", "TUNNEL_TOKEN=")
	out, _ := homelabCmd(t, root, "", "watchdog")
	if !strings.Contains(out, "vaultwarden: keeps restarting (homelab logs vaultwarden says why)") {
		t.Errorf("the crash loop was not reported:\n%s", out)
	}
}

func TestWatchdogNoticesStaleBouncer(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_network-nginx-proxy-manager-1", Image: "homelab/nginx-proxy-manager-crowdsec:2.16.0", Running: true, Health: "healthy", Project: "homelab_network", Service: "nginx-proxy-manager"},
		{Name: "homelab_security-crowdsec-1", Image: "crowdsecurity/crowdsec:latest", Running: true, Health: "healthy", Project: "homelab_security", Service: "crowdsec"},
	})
	root, _ := repoCopy(t, "UPDATES_PAUSED=true", "TUNNEL_TOKEN=")
	out, _ := homelabCmd(t, root, "", "watchdog")
	if !strings.Contains(out, "crowdsec bouncer: the proxy's bouncer last pulled CrowdSec's decisions") {
		t.Errorf("stale bouncer not reported:\n%s", out)
	}
}

func TestWatchdogNoticesALowDisk(t *testing.T) {
	fakeDocker(t, nil)
	root, _ := repoCopy(t, "UPDATES_PAUSED=true", "TUNNEL_TOKEN=")
	var asked []diskspace.Location
	checkDisks = func(locs []diskspace.Location) []diskspace.Volume {
		asked = locs
		return []diskspace.Volume{
			{Names: []string{"homelab folder", "backups"}, Path: root, Free: 6 << 30, Total: 494 << 30},
			{Names: []string{"photos", "media"}, Path: "/Volumes/Media", Free: 900 << 30, Total: 4000 << 30},
		}
	}
	t.Cleanup(func() { checkDisks = diskspace.Check })
	out, code := homelabCmd(t, root, "", "watchdog")
	if code == 0 || !strings.Contains(out, "disk space (homelab folder): "+root+" holds homelab folder, backups, 6.0 GB free of 494 GB (1%)") {
		t.Errorf("the low disk was not reported (exit %d):\n%s", code, out)
	}
	if !strings.Contains(out, "docker image prune -a would free 12.3GB of unused images") {
		t.Errorf("the low disk's alert should say what pruning images frees:\n%s", out)
	}
	if !strings.Contains(out, "✓ disk space (photos)") {
		t.Errorf("the roomy disk should pass:\n%s", out)
	}
	if len(asked) == 0 || asked[0] != (diskspace.Location{Name: "homelab folder", Path: root}) {
		t.Errorf("asked about %+v", asked)
	}
}

func TestDriveHealth(t *testing.T) {
	fakeDocker(t, nil)
	root, _ := repoCopy(t, "UPDATES_PAUSED=true", "TUNNEL_TOKEN=")
	saved := checkDrives
	checkDrives = func(context.Context) ([]diskhealth.Disk, error) {
		return []diskhealth.Disk{
			{Device: "/dev/disk0", Model: "APPLE SSD", Readable: true, Passed: true, TempC: 38},
			{Device: "/dev/disk4", Model: "WDC WD40EFRX", Readable: true, Passed: false},
			{Device: "/dev/disk5", Why: "Unknown USB bridge"},
		}, nil
	}
	t.Cleanup(func() { checkDrives = saved })
	out, code := homelabCmd(t, root, "", "watchdog")
	if code == 0 || !strings.Contains(out, "drive health (WDC WD40EFRX): WDC WD40EFRX (/dev/disk4) FAILING") || !strings.Contains(out, "✓ drive health (APPLE SSD)") || strings.Contains(out, "disk5") {
		t.Errorf("watchdog (exit %d):\n%s", code, out)
	}
	out, _ = homelabCmd(t, root, "", "doctor")
	if !strings.Contains(out, "WDC WD40EFRX (/dev/disk4): FAILING") || !strings.Contains(out, "/dev/disk5): no health report: Unknown USB bridge") {
		t.Errorf("doctor:\n%s", out)
	}
	checkDrives = func(context.Context) ([]diskhealth.Disk, error) { return nil, diskhealth.ErrNoSmartctl }
	if out, _ := homelabCmd(t, root, "", "doctor"); !strings.Contains(out, diskhealth.Install(runtime.GOOS)) {
		t.Errorf("doctor without smartctl:\n%s", out)
	}
}

func TestCustomAppLifecycle(t *testing.T) {
	calls := fakeDocker(t, nil)
	root, _ := repoCopy(t)
	// The test copy has no docs; give it the folder the generator writes into.
	out, code := homelabCmd(t, root, "", "custom", "add", "whiteboard", "--image", "docker.io/excalidraw/excalidraw:latest", "--port", "80", "--name", "Whiteboard", "--volume", "/data", "--apply")
	if code != 0 || !strings.Contains(out, "added whiteboard") {
		t.Fatalf("add exit %d:\n%s", code, out)
	}
	if out, code := homelabCmd(t, root, "", "custom"); code != 0 || !strings.Contains(out, "whiteboard") {
		t.Fatalf("list exit %d:\n%s", code, out)
	}
	out, code = homelabCmd(t, root, "", "install", "whiteboard", "--apply")
	if code != 0 || !strings.Contains(readCalls(t, calls), "up --detach --no-recreate whiteboard") {
		t.Fatalf("install exit %d:\n%s\n%s", code, out, readCalls(t, calls))
	}
	if out, code := homelabCmd(t, root, "", "custom", "remove", "whiteboard", "--apply"); code != 0 || !strings.Contains(out, "removed whiteboard") {
		t.Fatalf("remove exit %d:\n%s", code, out)
	}
}

func TestTailscaleVerdict(t *testing.T) {
	cases := []struct {
		status, routes string
		ok             bool
		want           string
	}{
		{`{"BackendState":"NeedsLogin","Self":{}}`, "", false, "needslogin, not connected"},
		{`{"BackendState":"Running","Self":{}}`, "", false, "route 192.168.1.0/24 is not approved"},
		{`{"BackendState":"Running","Self":{"PrimaryRoutes":["10.10.0.0/24"]}}`, "10.10.0.0/24,192.168.1.0/24", false, "route 192.168.1.0/24 is not approved"},
		{`{"BackendState":"Running","Self":{"PrimaryRoutes":["192.168.1.0/24"]}}`, "", true, "is approved"},
		{`not json`, "", false, "could not be read"},
	}
	for _, c := range cases {
		ok, msg := tailscaleVerdict([]byte(c.status), c.routes)
		if ok != c.ok || !strings.Contains(msg, c.want) {
			t.Errorf("tailscaleVerdict(%s, %q) = %v, %q; want %v, …%s…", c.status, c.routes, ok, msg, c.ok, c.want)
		}
	}
}

func TestPersonal(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USER", "andrea")
	in := "use Proton Drive: " + home + "/Library/CloudStorage/ProtonDrive-andrea@proton.me-folder\nandrea@Andreas-Mac ~ % ls\nNPM_API_EMAIL=homelab@example.com\nsandreas stays"
	out := personal(in)
	for _, gone := range []string{home, "andrea@proton.me", "homelab@example.com", "andrea@Andreas"} {
		if strings.Contains(out, gone) {
			t.Errorf("%q is still in:\n%s", gone, out)
		}
	}
	if !strings.Contains(out, "~/Library/CloudStorage/ProtonDrive-[email]-folder") || !strings.Contains(out, "sandreas stays") {
		t.Errorf("%s", out)
	}
}

func TestRedact(t *testing.T) {
	secrets := map[string]string{"NPM_API_PASSWORD": "hunter2-long", "TUNNEL_TOKEN": "eyJhIjoiYWNjdCIsInQiOiJ0dW4tMSJ9"}
	in := strings.Join([]string{
		"password hunter2-long in a log",
		"token eyJhIjoiYWNjdCIsInQiOiJ0dW4tMSJ9",
		"other jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abc_def",
		"ntfy tk_AbCdEf123456789 and ?auth=QmVhcmVyIHRrX2FiY2RlZg",
		"Authorization: Bearer abcdefghijklmnop",
		"ping https://hc-ping.com/1234abcd-5678-90ef",
		"db postgres://immich:s3cret@db:5432/immich",
		"plain words stay",
	}, "\n")
	out := redact(in, secrets)
	for _, leak := range []string{"hunter2-long", "eyJhIjoi", "eyJhbGci", "tk_AbCdEf", "QmVhcmVy", "abcdefghijklmnop", "1234abcd", "s3cret"} {
		if strings.Contains(out, leak) {
			t.Errorf("%q leaked:\n%s", leak, out)
		}
	}
	for _, keep := range []string{"[redacted NPM_API_PASSWORD]", "[redacted TUNNEL_TOKEN]", "Bearer [redacted]", "hc-ping.com/[redacted]", "postgres://[redacted]db:5432", "auth=[redacted]", "plain words stay"} {
		if !strings.Contains(out, keep) {
			t.Errorf("want %q in:\n%s", keep, out)
		}
	}
}

func TestTransientPath(t *testing.T) {
	cases := []struct {
		path, appDir string
		want         bool
	}{
		{"/tmp/.mount_HomelaAbC123/usr/bin/homelab", "", true},
		{"/tmp/appimage_extracted_d0f6/usr/bin/homelab", "", true},
		{"/opt/apps/AppDir/usr/bin/homelab", "/opt/apps/AppDir", true},
		{"/private/var/folders/x/AppTranslocation/1234/d/Homelab Wizard.app/Contents/Helpers/homelab", "", true},
		{"/Applications/Homelab Wizard.app/Contents/Helpers/homelab", "", false},
		{"/home/deck/Homelab/bin/homelab", "/opt/apps/AppDir", false},
		{"/usr/bin/homelab", "", false},
	}
	for _, c := range cases {
		if got := transientPath(c.path, c.appDir); got != c.want {
			t.Errorf("transientPath(%q, %q) = %v", c.path, c.appDir, got)
		}
	}
}

func TestScheduleCopiesTransientCLI(t *testing.T) {
	root, _ := repoCopy(t)
	appDir := t.TempDir()
	cli := filepath.Join(appDir, "usr", "bin", "homelab")
	if err := os.MkdirAll(filepath.Dir(cli), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(cli, []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("APPDIR", appDir)
	h := &homelab{root: root, ui: &ui.UI{Out: io.Discard}}
	got, err := h.lastingBinary(cli)
	if err != nil || got != filepath.Join(root, "bin", "homelab") {
		t.Fatalf("lastingBinary = %q, %v", got, err)
	}
	if fi, err := os.Stat(got); err != nil || fi.Mode().Perm()&0o100 == 0 {
		t.Fatalf("copy missing or not executable: %v", err)
	}
	if same, _ := h.lastingBinary("/usr/bin/homelab"); same != "/usr/bin/homelab" {
		t.Errorf("a lasting path was replaced: %q", same)
	}
}

func TestAlertsShowOnTheDesktop(t *testing.T) {
	var shown []string
	saved := desktopNotify
	desktopNotify = func(_ context.Context, title, _ string) error { shown = append(shown, title); return nil }
	t.Cleanup(func() { desktopNotify = saved })
	for _, c := range []struct {
		env  string
		want int
	}{{"", 1}, {"DESKTOP_ALERTS=false", 0}} {
		shown = nil
		root, _ := repoCopy(t, c.env)
		h := &homelab{root: root, envFile: filepath.Join(root, ".env"), ui: &ui.UI{Out: io.Discard}}
		h.alert(context.Background(), "tunnel-watchdog", notify.Message{Title: "Homelab: something is down"})
		if len(shown) != c.want {
			t.Errorf("%q: shown %v", c.env, shown)
		}
	}
}

func TestFixRestartsThenRecreatesAnUnwellApp(t *testing.T) {
	fixWait = 0
	t.Cleanup(func() { fixWait = 90 * time.Second })
	var ctrs []docker.FakeContainer
	for _, id := range []string{"nginx-proxy-manager", "adguard-home", "crowdsec", "vaultwarden", "uptime-kuma", "ntfy", "watchtower", "duplicati", "navidrome", "feishin", "audiobookshelf", "calibre-web", "komga"} {
		a, _ := catalogOf(t).Get(id)
		ctrs = append(ctrs, docker.FakeContainer{Name: a.Project() + "-" + id + "-1", Image: "x", Running: true, Health: "healthy", Project: a.Project(), Service: id})
	}
	ctrs[8].Health = "unhealthy" // navidrome
	calls := fakeDocker(t, ctrs)
	root, _ := repoCopy(t, "UPDATES_PAUSED=true", "TUNNEL_TOKEN=")
	out, code := homelabCmd(t, root, "", "fix", "--apply")
	log := readCalls(t, calls)
	if code != 0 || !strings.Contains(out, "restart the apps that are unwell") || !strings.Contains(out, "Navidrome") {
		t.Fatalf("fix exit %d:\n%s", code, out)
	}
	if !strings.Contains(log, "restart navidrome") || !strings.Contains(log, "up --detach --force-recreate --no-deps navidrome") {
		t.Errorf("want a restart, then a recreate:\n%s", log)
	}
	if !strings.Contains(log, "up --detach --no-recreate") {
		t.Errorf("the baseline apps that are down should be started:\n%s", log)
	}
	if !strings.Contains(out, "still unwell: Navidrome") {
		t.Errorf("an app that stays unwell should be named:\n%s", out)
	}
	// The fake bouncer last pulled in 2020.
	if !strings.Contains(out, "reconnect the proxy to CrowdSec") || !strings.Contains(log, "cscli bouncers delete nginx_proxy_manager") || !strings.Contains(log, "restart nginx-proxy-manager") {
		t.Errorf("a stale bouncer should be reconnected:\n%s\n%s", out, log)
	}
}

func catalogOf(t *testing.T) *catalog.Catalog {
	t.Helper()
	c, err := catalog.Load(repoDir())
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func TestMigrateMovesAppsIntoTheirCategoryProjects(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_core-stirling-pdf-1", Image: "stirlingtools/stirling-pdf:latest", Running: true, Project: "homelab_core", Service: "stirling-pdf"},
		{Name: "homelab_core-bazarr-1", Image: "lscr.io/linuxserver/bazarr", Running: false, Project: "homelab_core", Service: "bazarr"},
		{Name: "homelab_media-feishin-1", Image: "ghcr.io/jeffvli/feishin", Running: true, Project: "homelab_media", Service: "feishin"},
	})
	root, _ := repoCopy(t)
	out, code := homelabCmd(t, root, "", "doctor")
	if !strings.Contains(out, "2 app(s) still run in an old Compose project (homelab_core): homelab migrate") {
		t.Errorf("doctor should point at migrate (exit %d):\n%s", code, out)
	}
	if out, _ := homelabCmd(t, root, "", "migrate"); !strings.Contains(out, "homelab_documents: Stirling PDF") || !strings.Contains(out, "homelab_media_automation: Bazarr") || strings.Contains(readCalls(t, calls), "rm --force") {
		t.Fatalf("the preview should list the moves and change nothing:\n%s", out)
	}
	out, code = homelabCmd(t, root, "", "migrate", "--apply")
	log := readCalls(t, calls)
	if code != 0 || !strings.Contains(out, "moved 2 app(s)") {
		t.Fatalf("migrate exit %d:\n%s\n%s", code, out, log)
	}
	for _, want := range []string{"rm --force homelab_core-stirling-pdf-1", "rm --force homelab_core-bazarr-1", "-p homelab_documents --env-file " + filepath.Join(root, ".env") + " --profile optional up --detach --no-recreate stirling-pdf"} {
		if !strings.Contains(log, want) {
			t.Errorf("missing %q in:\n%s", want, log)
		}
	}
	if strings.Contains(log, "rm --force homelab_media-feishin-1") || strings.Contains(log, "up --detach --no-recreate bazarr") {
		t.Error("an app already in its project, or one that was stopped, must not be started")
	}
	if _, err := os.Stat(filepath.Join(root, "recovery-staging", "secrets", "homelab.env")); err != nil {
		t.Error("the backup should run before anything is removed")
	}
}
