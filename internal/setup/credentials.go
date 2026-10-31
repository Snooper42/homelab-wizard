package setup

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/accounts"
	"github.com/Snooper42/homelab-wizard/internal/domain"
	"github.com/Snooper42/homelab-wizard/internal/duplicati"
	"github.com/Snooper42/homelab-wizard/internal/notify"
	"github.com/Snooper42/homelab-wizard/internal/npm"
)

// Tester checks a setting's saved value against the service it is for: a
// login, a token, a URL, or a folder. Settings shows a Test button for
// each setting it knows.
type Tester struct {
	Env  map[string]string
	Root string // the homelab folder, for relative paths
	// CloudflareURL, JellyfinURL, and LocalHost replace the real
	// endpoints in tests.
	CloudflareURL string
	JellyfinURL   string
	LocalHost     string
}

// Result is one test's outcome, in words for the person who ran it.
type Result struct {
	Key     string `json:"key"`
	OK      bool   `json:"ok"`
	Message string `json:"message"`
}

var tests = map[string]func(t Tester, ctx context.Context) (string, error){
	"ADGUARD_USER":             Tester.adguard,
	"ADGUARD_PASSWORD":         Tester.adguard,
	"CLOUDFLARE_API_TOKEN":     Tester.cloudflare,
	"TUNNEL_TOKEN":             Tester.tunnel,
	"NPM_API_EMAIL":            Tester.npm,
	"NPM_API_PASSWORD":         Tester.npm,
	"HEARTBEAT_URL":            Tester.heartbeat,
	"DUPLICATI_PASSWORD":       Tester.duplicati,
	"JELLYFIN_API_KEY":         Tester.jellyfin,
	"NAVIDROME_ADMIN_USER":     Tester.navidrome,
	"NAVIDROME_ADMIN_PASSWORD": Tester.navidrome,
	"NTFY_PUBLISH_TOKEN": func(t Tester, ctx context.Context) (string, error) {
		return t.ntfy(ctx, "NTFY_PUBLISH_TOKEN", "homelab")
	},
	"NTFY_READ_TOKEN": func(t Tester, ctx context.Context) (string, error) {
		return t.ntfy(ctx, "NTFY_READ_TOKEN", "homelab-reader")
	},
	"NTFY_PHONE_PASSWORD": func(t Tester, ctx context.Context) (string, error) {
		return t.ntfy(ctx, "NTFY_PHONE_PASSWORD", "phone")
	},
	"BACKUP_DESTINATION": func(t Tester, _ context.Context) (string, error) { return t.folder("BACKUP_DESTINATION", true) },
	"MEDIA_ROOT":         func(t Tester, _ context.Context) (string, error) { return t.folder("MEDIA_ROOT", false) },
}

// Testable reports whether key has a test.
func Testable(key string) bool { _, ok := tests[key]; return ok }

// TestableKeys lists the settings that have a test.
func TestableKeys() []string {
	keys := make([]string, 0, len(tests))
	for k := range tests {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// Test runs key's test with the saved settings.
func (t Tester) Test(ctx context.Context, key string) Result {
	fn, ok := tests[key]
	if !ok {
		return Result{Key: key, Message: "there is no test for " + key}
	}
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	msg, err := fn(t, ctx)
	if err != nil {
		return Result{Key: key, Message: err.Error()}
	}
	return Result{Key: key, OK: true, Message: msg}
}

func (t Tester) local(port string) string {
	return "http://" + or(t.LocalHost, "127.0.0.1") + ":" + port
}

func (t Tester) adguard(ctx context.Context) (string, error) {
	if t.Env["ADGUARD_PASSWORD"] == "" {
		return "", errors.New("ADGUARD_PASSWORD is empty: put in the password you made in AdGuard's wizard")
	}
	if err := domain.NewAdGuard(t.local(or(t.Env["ADGUARD_PORT"], "3003")), or(t.Env["ADGUARD_USER"], "admin"), t.Env["ADGUARD_PASSWORD"]).Check(ctx); err != nil {
		return "", err
	}
	return "AdGuard Home accepted this login.", nil
}

func (t Tester) cloudflareClient() (*domain.Cloudflare, error) {
	token := t.Env["CLOUDFLARE_API_TOKEN"]
	if token == "" {
		return nil, errors.New("CLOUDFLARE_API_TOKEN is empty")
	}
	cf := domain.NewCloudflare(token)
	if t.CloudflareURL != "" {
		cf.BaseURL = t.CloudflareURL
	}
	return cf, nil
}

func (t Tester) cloudflare(ctx context.Context) (string, error) {
	cf, err := t.cloudflareClient()
	if err != nil {
		return "", err
	}
	zone := t.Env["HOMELAB_DOMAIN"]
	if zone == "" {
		return "", errors.New("set the Domain (above) first: the token is checked against it")
	}
	if _, err := cf.ZoneID(ctx, zone); err != nil {
		return "", fmt.Errorf("the token cannot read %s (it needs Zone › Zone › Read and Zone › DNS › Edit for it): %w", zone, err)
	}
	msg := "The token can read " + zone + "."
	if tun, err := domain.ParseTunnelToken(t.Env["TUNNEL_TOKEN"]); err == nil {
		if _, _, err := cf.TunnelIngress(ctx, tun); err != nil {
			return "", fmt.Errorf("the token reads %s but not the tunnel (it needs Account › Cloudflare Tunnel › Edit): %w", zone, err)
		}
		msg += " It can also manage the tunnel."
	}
	return msg, nil
}

func (t Tester) tunnel(ctx context.Context) (string, error) {
	tun, err := domain.ParseTunnelToken(t.Env["TUNNEL_TOKEN"])
	if err != nil {
		return "", errors.New("this is not a tunnel token: copy the long value after --token in the tunnel's Docker command (it usually starts with eyJ)")
	}
	cf, err := t.cloudflareClient()
	if err != nil {
		return "The tunnel token is well formed. Add CLOUDFLARE_API_TOKEN to check it with Cloudflare.", nil
	}
	if _, _, err := cf.TunnelIngress(ctx, tun); err != nil {
		return "", fmt.Errorf("Cloudflare does not know this tunnel for the API token's account: %w", err)
	}
	return "Cloudflare knows this tunnel.", nil
}

func (t Tester) npm(ctx context.Context) (string, error) {
	if t.Env["NPM_API_EMAIL"] == "" || t.Env["NPM_API_PASSWORD"] == "" {
		return "", errors.New("NPM_API_EMAIL and NPM_API_PASSWORD both need a value")
	}
	if err := npm.New(t.local(or(t.Env["NPM_ADMIN_PORT"], "8181"))).Login(ctx, t.Env["NPM_API_EMAIL"], t.Env["NPM_API_PASSWORD"]); err != nil {
		return "", err
	}
	return "Nginx Proxy Manager accepted this login.", nil
}

func (t Tester) duplicati(ctx context.Context) (string, error) {
	jobs, err := duplicati.Jobs(ctx, t.local(or(t.Env["DUPLICATI_PORT"], "8200")), t.Env["DUPLICATI_PASSWORD"], time.Now())
	if err != nil {
		return "", err
	}
	if len(jobs) == 0 {
		return "Duplicati accepted the password. It has no backup jobs yet (docs/Automation.md lists them).", nil
	}
	return fmt.Sprintf("Duplicati accepted the password and has %d backup job(s).", len(jobs)), nil
}

func (t Tester) heartbeat(ctx context.Context) (string, error) {
	u := t.Env["HEARTBEAT_URL"]
	if !strings.HasPrefix(u, "https://") && !strings.HasPrefix(u, "http://") {
		return "", errors.New("HEARTBEAT_URL should be the check's ping URL, such as https://hc-ping.com/…")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return "", err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("the ping did not get through: %w", err)
	}
	resp.Body.Close()
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("the ping URL answered %s; copy it again from the check's page", resp.Status)
	}
	return "The ping arrived (it counts as one, so the check turns green).", nil
}

// folder checks that the setting names an existing folder, and with write
// that a file can be created in it.
func (t Tester) folder(key string, write bool) (string, error) {
	p := t.Env[key]
	if p == "" {
		return "", fmt.Errorf("%s is empty", key)
	}
	if strings.HasPrefix(p, "~/") {
		home, _ := os.UserHomeDir()
		p = filepath.Join(home, p[2:])
	} else if !filepath.IsAbs(p) {
		p = filepath.Join(t.Root, p)
	}
	st, err := os.Stat(p)
	if err != nil || !st.IsDir() {
		return "", fmt.Errorf("%s is not a folder on this machine (is the drive connected?)", p)
	}
	if !write {
		return "The folder is there.", nil
	}
	f, err := os.CreateTemp(p, ".homelab-test-*")
	if err != nil {
		return "", fmt.Errorf("cannot write in %s: %w", p, err)
	}
	name := f.Name()
	f.Close()
	os.Remove(name)
	return "The folder is there and this machine can write in it.", nil
}

// ntfy signs in to ntfy with a token or the phone's password and checks it
// belongs to the account user.
func (t Tester) ntfy(ctx context.Context, key, user string) (string, error) {
	v := t.Env[key]
	if v == "" {
		return "", fmt.Errorf("%s is empty: Setup › Set up the alert token makes it", key)
	}
	auth := "Bearer " + v
	if strings.HasSuffix(key, "_PASSWORD") {
		auth = "Basic " + base64.StdEncoding.EncodeToString([]byte(user+":"+v))
	}
	got, err := notify.New(t.local(or(t.Env["NTFY_PORT"], "9293"))).Account(ctx, auth)
	if err != nil {
		return "", fmt.Errorf("%v; Set up the alert token again", err)
	}
	if got != user {
		return "", fmt.Errorf("ntfy took it as %q, not %s; Set up the alert token again", got, user)
	}
	return "ntfy accepted it for the " + user + " account.", nil
}

func (t Tester) jellyfin(ctx context.Context) (string, error) {
	key := t.Env["JELLYFIN_API_KEY"]
	if key == "" {
		return "", errors.New("JELLYFIN_API_KEY is empty: make a key in Jellyfin › Dashboard › API Keys and paste it here")
	}
	if err := accounts.NewJellyfin(or(t.JellyfinURL, t.local("8096")), key).Check(ctx); err != nil {
		if errors.Is(err, accounts.ErrNoAccess) {
			return "", errors.New("Jellyfin refused this key: make a new one in Dashboard › API Keys")
		}
		return "", err
	}
	return "Jellyfin accepted the key: Settings › People can make and reset its accounts.", nil
}

func (t Tester) navidrome(ctx context.Context) (string, error) {
	user, pw := t.Env["NAVIDROME_ADMIN_USER"], t.Env["NAVIDROME_ADMIN_PASSWORD"]
	if user == "" || pw == "" {
		return "", errors.New("set both NAVIDROME_ADMIN_USER and NAVIDROME_ADMIN_PASSWORD: an administrator's login in Navidrome")
	}
	if err := accounts.NewNavidrome(t.local(or(t.Env["NAVIDROME_PORT"], "4533")), user, pw).Check(ctx); err != nil {
		if errors.Is(err, accounts.ErrNoAccess) {
			return "", errors.New("Navidrome refused this login")
		}
		return "", err
	}
	return "Navidrome accepted the administrator's login: Settings › People can make and reset its accounts.", nil
}
