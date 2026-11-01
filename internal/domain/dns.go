package domain

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// Hosts-file block markers. Everything between them is owned by the CLI.
const (
	hostsBegin = "# >>> homelab (managed by ./homelab domain) >>>"
	hostsEnd   = "# <<< homelab <<<"
)

// HostsBlock replaces (or appends) the managed block in a hosts file.
func HostsBlock(current string, ip string, hosts []string) string {
	var block strings.Builder
	if len(hosts) > 0 {
		block.WriteString(hostsBegin + "\n")
		for _, h := range hosts {
			fmt.Fprintf(&block, "%s %s\n", ip, h)
		}
		block.WriteString(hostsEnd + "\n")
	}
	start := strings.Index(current, hostsBegin)
	end := strings.Index(current, hostsEnd)
	if start >= 0 && end > start {
		rest := current[end+len(hostsEnd):]
		rest = strings.TrimPrefix(rest, "\n")
		return current[:start] + block.String() + rest
	}
	if block.Len() == 0 {
		return current
	}
	if current != "" && !strings.HasSuffix(current, "\n") {
		current += "\n"
	}
	return current + block.String()
}

// ResolverPath is the macOS file that sends every lookup under domain to
// one DNS server, whatever DNS the network or a VPN sets.
func ResolverPath(domain string) string { return "/etc/resolver/" + domain }

// Resolver is that file's content: AdGuard Home on this machine.
func Resolver(domain, ip string) string {
	return "# Written by homelab: every " + domain + " name is looked up in AdGuard Home on this machine.\nnameserver " + ip + "\n"
}

// ResolverSet reports whether the resolver file points domain at ip.
func ResolverSet(domain, ip string) bool {
	data, err := os.ReadFile(sysRoot + ResolverPath(domain))
	return err == nil && strings.Contains(string(data), "nameserver "+ip+"\n")
}

// HostsPath is this system's hosts file.
func HostsPath() string {
	if goos == "windows" {
		root := os.Getenv("SystemRoot")
		if root == "" {
			root = `C:\Windows`
		}
		return filepath.Join(root, "System32", "drivers", "etc", "hosts")
	}
	return "/etc/hosts"
}

// WriteHosts writes the hosts file as an administrator (WriteSystemFile).
func WriteHosts(path, content string) error {
	return WriteSystemFile(path, content, "add your apps' addresses to the hosts file")
}

// WriteSystemFile writes a file only an administrator may change (making
// its folder), then flushes the DNS cache. As root it just writes; in a
// terminal it uses sudo; from the app, with no terminal, the system asks
// for approval in a window: the Mac's password window (why finishes
// "Homelab needs to …"), pkexec on Linux, Windows' approval prompt.
func WriteSystemFile(path, content, why string) error {
	if goos == "windows" {
		return writeElevatedWindows(path, content)
	}
	if euid() == 0 {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return err
		}
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			return err
		}
	} else if goos == "darwin" && !terminal() {
		// No terminal for sudo's password (the desktop app runs this):
		// macOS asks for it in a window instead.
		return writeWithPrompt(path, content, why)
	} else if !terminal() {
		return writeWithPkexec(path, content)
	} else {
		if err := run(exec.Command("sudo", "mkdir", "-p", filepath.Dir(path))); err != nil {
			return fmt.Errorf("making %s with sudo: %w", filepath.Dir(path), err)
		}
		cmd := exec.Command("sudo", "tee", path)
		cmd.Stdin = strings.NewReader(content)
		cmd.Stdout = io.Discard
		cmd.Stderr = os.Stderr
		if err := run(cmd); err != nil {
			return fmt.Errorf("updating %s with sudo: %w", path, err)
		}
	}
	if goos == "darwin" {
		_ = run(exec.Command("sudo", "-n", "dscacheutil", "-flushcache"))
		_ = run(exec.Command("sudo", "-n", "killall", "-HUP", "mDNSResponder"))
	}
	return nil
}

// staged writes content to a file of its own, for an administrator's
// command to copy into place; the caller removes it.
func staged(content string) (string, error) {
	tmp, err := os.CreateTemp("", "homelab-system-*")
	if err != nil {
		return "", err
	}
	if _, err := tmp.WriteString(content); err != nil {
		tmp.Close()
		return "", err
	}
	return tmp.Name(), tmp.Close()
}

// writeWithPkexec copies content over path as root on Linux, through
// pkexec, which asks for the password in a window (the app has no
// terminal for sudo).
func writeWithPkexec(path, content string) error {
	tmp, err := staged(content)
	if err != nil {
		return err
	}
	defer os.Remove(tmp)
	return asRoot("mkdir -p "+shQuote(filepath.Dir(path))+" && cp "+shQuote(tmp)+" "+shQuote(path)+" && chmod 644 "+shQuote(path), "changing "+path, "")
}

// writeElevatedWindows copies content over path with Windows' approval
// prompt (an elevated PowerShell), then clears the DNS cache.
func writeElevatedWindows(path, content string) error {
	tmp, err := staged(content)
	if err != nil {
		return err
	}
	defer os.Remove(tmp)
	q := func(s string) string { return "'" + strings.ReplaceAll(s, "'", "''") + "'" }
	script := "New-Item -ItemType Directory -Force -Path " + q(filepath.Dir(path)) + " | Out-Null; Copy-Item -LiteralPath " + q(tmp) + " -Destination " + q(path) + " -Force; Clear-DnsClientCache"
	if err := elevatePS(script); err != nil {
		return fmt.Errorf("changing %s: %v", path, err)
	}
	if got, err := os.ReadFile(path); err != nil || string(got) != content {
		return fmt.Errorf("%s was not changed (was the approval declined?)", path)
	}
	return nil
}

// What a system file's change depends on, which tests replace: the
// system, whether this runs as root or in a terminal, the folder the
// system's own files are read under ("" is /), and how a command runs.
var (
	goos     = runtime.GOOS
	euid     = os.Geteuid
	terminal = func() bool { return ui.IsTTY(os.Stdin) }
	sysRoot  = ""
	run      = (*exec.Cmd).Run
)

// combined runs c through run and returns what it printed.
func combined(c *exec.Cmd) ([]byte, error) {
	var out bytes.Buffer
	c.Stdout, c.Stderr = &out, &out
	err := run(c)
	return out.Bytes(), err
}

// writeWithPrompt copies content over path as an administrator, with the
// macOS password window, and flushes the DNS cache.
func writeWithPrompt(path, content, why string) error {
	tmp, err := staged(content)
	if err != nil {
		return err
	}
	defer os.Remove(tmp)
	return withPasswordWindow("/bin/mkdir -p "+shQuote(filepath.Dir(path))+"; /bin/cp "+shQuote(tmp)+" "+shQuote(path)+"; /bin/chmod 644 "+shQuote(path)+"; "+flushMac,
		"updating "+path, why)
}

// flushMac flushes the Mac's DNS cache, as root.
const flushMac = "/usr/bin/dscacheutil -flushcache; /usr/bin/killall -HUP mDNSResponder"

// withPasswordWindow runs sh as an administrator on the Mac, asking in the
// password window: "Homelab needs to <why>."
func withPasswordWindow(sh, what, why string) error {
	script := `do shell script "` + strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(sh) + `" with prompt "Homelab needs to ` + strings.ReplaceAll(why, `"`, "'") + `." with administrator privileges`
	if out, err := combined(exec.Command("osascript", "-e", script)); err != nil {
		return fmt.Errorf("%s: %v %s", what, err, strings.TrimSpace(string(out)))
	}
	return nil
}

// AdGuard edits DNS rewrites through AdGuard Home's API.
type AdGuard struct {
	BaseURL, User, Password string
	HTTP                    *http.Client
}

// NewAdGuard returns a client for the AdGuard Home admin API.
func NewAdGuard(baseURL, user, password string) *AdGuard {
	return &AdGuard{BaseURL: strings.TrimRight(baseURL, "/"), User: user, Password: password, HTTP: &http.Client{Timeout: 15 * time.Second}}
}

// Rewrite is one AdGuard DNS rewrite. Enabled is reported by AdGuard
// v0.107.57 and later, where a rewrite can be switched off.
type Rewrite struct {
	Domain  string `json:"domain"`
	Answer  string `json:"answer"`
	Enabled *bool  `json:"enabled,omitempty"`
}

func (a *AdGuard) call(ctx context.Context, method, path string, body, out any) error {
	var rd io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		rd = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, a.BaseURL+"/control"+path, rd)
	if err != nil {
		return err
	}
	req.SetBasicAuth(a.User, a.Password)
	req.Header.Set("Content-Type", "application/json")
	resp, err := a.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return fmt.Errorf("AdGuard Home rejected ADGUARD_USER/ADGUARD_PASSWORD")
	}
	if resp.StatusCode >= 300 {
		return fmt.Errorf("AdGuard %s %s: %d %s", method, path, resp.StatusCode, strings.TrimSpace(string(data)))
	}
	if out != nil && len(data) > 0 {
		return json.Unmarshal(data, out)
	}
	return nil
}

// Check logs in and reads AdGuard's status, to test the credentials.
func (a *AdGuard) Check(ctx context.Context) error {
	return a.call(ctx, http.MethodGet, "/status", nil, nil)
}

// FirstRun reports whether AdGuard Home is still waiting for its first-run
// wizard: only then does it answer on the setup port (container port 3000).
func (a *AdGuard) FirstRun(ctx context.Context, setupURL string) bool {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(setupURL, "/")+"/control/install/get_addresses", nil)
	if err != nil {
		return false
	}
	resp, err := a.HTTP.Do(req)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// Install answers the first-run wizard: the admin pages on container port
// 80 and DNS on 53 (what the container publishes), with this login.
// AdGuard then moves its admin pages from the setup port to port 80.
func (a *AdGuard) Install(ctx context.Context, setupURL string) error {
	type addr struct {
		IP   string `json:"ip"`
		Port int    `json:"port"`
	}
	body, _ := json.Marshal(map[string]any{
		"web":      addr{IP: "0.0.0.0", Port: 80},
		"dns":      addr{IP: "0.0.0.0", Port: 53},
		"username": a.User,
		"password": a.Password,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(setupURL, "/")+"/control/install/configure", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := a.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		data, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("AdGuard's first-run setup: %d %s", resp.StatusCode, strings.TrimSpace(string(data)))
	}
	return nil
}

// UpsertRewrite points domain (e.g. *.example.com) at answer and returns
// "created", "updated", or "unchanged".
func (a *AdGuard) UpsertRewrite(ctx context.Context, domain, answer string) (string, error) {
	var list []Rewrite
	if err := a.call(ctx, http.MethodGet, "/rewrite/list", nil, &list); err != nil {
		return "", err
	}
	for _, r := range list {
		if !strings.EqualFold(r.Domain, domain) {
			continue
		}
		off := r.Enabled != nil && !*r.Enabled
		if r.Answer == answer && !off {
			return "unchanged", nil
		}
		update := Rewrite{Domain: domain, Answer: answer}
		if r.Enabled != nil {
			on := true
			update.Enabled = &on
		}
		return "updated", a.call(ctx, http.MethodPut, "/rewrite/update", map[string]Rewrite{"target": r, "update": update}, nil)
	}
	return "created", a.call(ctx, http.MethodPost, "/rewrite/add", Rewrite{Domain: domain, Answer: answer}, nil)
}

// Cloudflare is a minimal client for the Cloudflare v4 API.
type Cloudflare struct {
	Token   string
	BaseURL string
	HTTP    *http.Client
}

// NewCloudflare returns a client for an API token.
func NewCloudflare(token string) *Cloudflare {
	return &Cloudflare{Token: token, BaseURL: "https://api.cloudflare.com/client/v4", HTTP: &http.Client{Timeout: 30 * time.Second}}
}

type cfResponse struct {
	Success bool                       `json:"success"`
	Errors  []struct{ Message string } `json:"errors"`
	Result  json.RawMessage            `json:"result"`
}

func (c *Cloudflare) call(ctx context.Context, method, path string, body, out any) error {
	var rd io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		rd = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, rd)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	var r cfResponse
	if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
		return fmt.Errorf("cloudflare %s %s: %d", method, path, resp.StatusCode)
	}
	if !r.Success {
		var msgs []string
		for _, e := range r.Errors {
			msgs = append(msgs, e.Message)
		}
		return fmt.Errorf("cloudflare %s %s: %s", method, path, strings.Join(msgs, "; "))
	}
	if out != nil {
		return json.Unmarshal(r.Result, out)
	}
	return nil
}

// ZoneID looks up a zone (e.g. example.com) in the token's account.
func (c *Cloudflare) ZoneID(ctx context.Context, zone string) (string, error) {
	var zones []struct{ ID string }
	if err := c.call(ctx, http.MethodGet, "/zones?name="+url.QueryEscape(zone), nil, &zones); err != nil {
		return "", err
	}
	if len(zones) == 0 {
		return "", fmt.Errorf("zone %s not found for this Cloudflare token", zone)
	}
	return zones[0].ID, nil
}

// UpsertCNAME points name at target (proxied through Cloudflare) and returns
// "created", "updated", or "unchanged".
func (c *Cloudflare) UpsertCNAME(ctx context.Context, zoneID, name, target string) (string, error) {
	var records []struct {
		ID      string `json:"id"`
		Type    string `json:"type"`
		Content string `json:"content"`
		Proxied bool   `json:"proxied"`
	}
	if err := c.call(ctx, http.MethodGet, fmt.Sprintf("/zones/%s/dns_records?name=%s", zoneID, url.QueryEscape(name)), nil, &records); err != nil {
		return "", err
	}
	rec := map[string]any{"type": "CNAME", "name": name, "content": target, "ttl": 1, "proxied": true, "comment": "managed by homelab"}
	for _, r := range records {
		if r.Type != "CNAME" {
			return "", fmt.Errorf("%s already has a %s record; remove it in Cloudflare DNS first", name, r.Type)
		}
		if r.Content == target && r.Proxied {
			return "unchanged", nil
		}
		return "updated", c.call(ctx, http.MethodPut, fmt.Sprintf("/zones/%s/dns_records/%s", zoneID, r.ID), rec, nil)
	}
	return "created", c.call(ctx, http.MethodPost, fmt.Sprintf("/zones/%s/dns_records", zoneID), rec, nil)
}

// HomeComment marks the record UpsertHome writes.
const HomeComment = "managed by homelab: this machine's address at home"

// UpsertHome points name (*.example.com) at ip, this machine's address on
// the home network, as a DNS-only A record, and returns "created",
// "updated", or "unchanged". Any DNS server then answers the apps' names
// with that address, so they open at home with a VPN on or the network's
// own DNS, and lead nowhere elsewhere. A record of another kind, or one
// the homelab did not write that points anywhere but ip, is someone
// else's and is left as it is.
func (c *Cloudflare) UpsertHome(ctx context.Context, zoneID, name, ip string) (string, error) {
	var records []struct {
		ID      string `json:"id"`
		Type    string `json:"type"`
		Content string `json:"content"`
		Proxied bool   `json:"proxied"`
		Comment string `json:"comment"`
	}
	if err := c.call(ctx, http.MethodGet, fmt.Sprintf("/zones/%s/dns_records?name=%s", zoneID, url.QueryEscape(name)), nil, &records); err != nil {
		return "", err
	}
	rec := map[string]any{"type": "A", "name": name, "content": ip, "ttl": 1, "proxied": false, "comment": HomeComment}
	for _, r := range records {
		if r.Type != "A" {
			return "", fmt.Errorf("%s already has a %s record, so it was left as it is", name, r.Type)
		}
		// Not one the homelab wrote: it becomes the homelab's only when it
		// already points here; one made for another machine (a NAS at home)
		// or a public address is the household's own.
		if r.Comment != HomeComment && r.Content != ip {
			return "", fmt.Errorf("%s already points at %s, so it was left as it is", name, r.Content)
		}
		if r.Content == ip && !r.Proxied && r.Comment == HomeComment {
			return "unchanged", nil
		}
		return "updated", c.call(ctx, http.MethodPut, fmt.Sprintf("/zones/%s/dns_records/%s", zoneID, r.ID), rec, nil)
	}
	return "created", c.call(ctx, http.MethodPost, fmt.Sprintf("/zones/%s/dns_records", zoneID), rec, nil)
}
