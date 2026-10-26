//go:build realdocker

package realdocker

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

// ntfyOld is the ntfy release the run starts on, so that its update has a
// newer one to move to and its rollback one to go back to. It shares its
// databases' schema with the newest release (17 and 9 in October 2026): a
// rollback swaps the image, not the data, so across a schema change the
// older ntfy refuses its newer database (ISSUE-0022). When a release
// changes the schema this run fails at the rollback, as a homelab would.
const ntfyOld = "v2.33.1"

// ntfy: the publisher's and reader's tokens notify setup made live in its
// user database; after the move both still work.
func seedNtfy(l *lab) error { return nil }

func checkNtfy(l *lab) error {
	if _, err := l.try("notify", "test"); err != nil {
		return fmt.Errorf("the publish token no longer works: %w", err)
	}
	return l.alerted("Homelab test")
}

// alerted looks for a message titled like title (any, when "") on the
// watchdog's topic in the last hour, read with the app's reader token.
func (l *lab) alerted(title string) error {
	since := time.Now().Add(-time.Hour).Unix()
	req, _ := http.NewRequest("GET", fmt.Sprintf("%s/tunnel-watchdog/json?poll=1&since=%d", l.url("ntfy"), since), nil)
	req.Header.Set("Authorization", "Bearer "+l.env("NTFY_READ_TOKEN"))
	resp, err := web.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	body := string(data)
	if resp.StatusCode != 200 {
		return fmt.Errorf("reading the alerts: %s %s", resp.Status, body)
	}
	if !strings.Contains(body, `"event":"message"`) || title != "" && !strings.Contains(body, title) {
		return fmt.Errorf("no alert %q among: %s", title, tail(body, 5))
	}
	return nil
}

// Vaultwarden: an account made through its API (the server stores a
// hash of what the client sends, so no client-side keys are needed) signs
// in after the move.
const vaultEmail = "nightly@example.com"

var vaultHash = base64.StdEncoding.EncodeToString([]byte("not a real master password hash"))

func seedVault(l *lab) error {
	// Sign-ups open while the account is made; the command closes them
	// again when it is interrupted.
	open := exec.Command(l.bin, "--root", l.root, "--no-color", "signups", "open", "--for", "5m", "--apply")
	open.Dir = l.root
	if err := open.Start(); err != nil {
		return err
	}
	defer func() {
		_ = open.Process.Signal(os.Interrupt)
		_ = open.Wait()
	}()
	// Vaultwarden's sign-up in two steps, as its web vault does: a
	// verification token (handed back at once while mail is not set
	// up), then the account.
	finish := func(token string) map[string]any {
		return map[string]any{
			"email": vaultEmail, "emailVerificationToken": token, "masterPasswordHash": vaultHash, "masterPasswordHint": "",
			"userSymmetricKey":   "2.AAAAAAAAAAAAAAAAAAAAAA==|AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=|AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
			"userAsymmetricKeys": map[string]string{"publicKey": "AAAA", "encryptedPrivateKey": "2.AAAA|AAAA|AAAA"},
			"kdf":                0, "kdfIterations": 600000,
		}
	}
	var last error
	deadline := time.Now().Add(3 * time.Minute)
	for time.Now().Before(deadline) {
		var token string
		// Until the container with sign-ups open answers.
		if last = requestText("POST", l.url("vaultwarden")+"/identity/accounts/register/send-verification-email", map[string]any{"email": vaultEmail, "name": "Nightly", "receiveMarketingEmails": false}, &token); last == nil {
			if last = request("POST", l.url("vaultwarden")+"/identity/accounts/register/finish", finish(strings.Trim(token, `"`)), nil); last == nil {
				return nil
			}
		}
		time.Sleep(3 * time.Second)
	}
	return fmt.Errorf("registering: %w", last)
}

func checkVault(l *lab) error {
	form := url.Values{
		"grant_type": {"password"}, "username": {vaultEmail}, "password": {vaultHash},
		"scope": {"api offline_access"}, "client_id": {"web"}, "deviceType": {"10"},
		"deviceIdentifier": {"3f0e2c64-0000-4000-8000-000000000001"}, "deviceName": {"nightly"},
	}
	resp, err := web.PostForm(l.url("vaultwarden")+"/identity/connect/token", form)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("signing in as %s after the move: %s", vaultEmail, resp.Status)
	}
	return nil
}

// Paperless: an administrator made in its container, then a tag through
// the API.
const paperlessTag = "nightly-run"

func seedPaperless(l *lab) error {
	ctr := l.container("paperless")
	out, err := exec.Command("docker", "exec", "-e", "DJANGO_SUPERUSER_PASSWORD=nightly-password", ctr,
		"python3", "manage.py", "createsuperuser", "--noinput", "--username", "nightly", "--email", "nightly@example.com").CombinedOutput()
	if err != nil && !strings.Contains(string(out), "already taken") {
		return fmt.Errorf("making the administrator: %v %s", err, out)
	}
	return request("POST", l.url("paperless")+"/api/tags/", map[string]any{"name": paperlessTag}, nil, "Authorization", basic("nightly", "nightly-password"))
}

func checkPaperless(l *lab) error {
	var tags struct {
		Count int `json:"count"`
	}
	if err := request("GET", l.url("paperless")+"/api/tags/?name__iexact="+paperlessTag, nil, &tags, "Authorization", basic("nightly", "nightly-password")); err != nil {
		return err
	}
	if tags.Count != 1 {
		return fmt.Errorf("the tag %q is gone after the move", paperlessTag)
	}
	return nil
}

func basic(user, password string) string {
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(user+":"+password))
}

// Nginx Proxy Manager: a proxy host made with the homelab's own API
// account (NPM_API_EMAIL), read back after the move.
const proxyHost = "nightly.example.com"

func (l *lab) npmToken() (string, error) {
	var tok struct {
		Token string `json:"token"`
	}
	err := request("POST", l.url("nginx-proxy-manager")+"/api/tokens", map[string]string{"identity": l.env("NPM_API_EMAIL"), "secret": l.env("NPM_API_PASSWORD")}, &tok)
	return tok.Token, err
}

func seedProxyHost(l *lab) error {
	var tok string
	var err error
	deadline := time.Now().Add(3 * time.Minute)
	for tok, err = l.npmToken(); err != nil && time.Now().Before(deadline); tok, err = l.npmToken() {
		time.Sleep(5 * time.Second) // its first start makes the API account
	}
	if err != nil {
		return fmt.Errorf("signing in to the API: %w", err)
	}
	host := map[string]any{
		"domain_names": []string{proxyHost}, "forward_scheme": "http", "forward_host": "ntfy", "forward_port": 80,
		"access_list_id": 0, "certificate_id": 0, "meta": map[string]any{}, "advanced_config": "", "locations": []any{},
		"block_exploits": false, "caching_enabled": false, "allow_websocket_upgrade": false, "http2_support": false, "hsts_enabled": false, "hsts_subdomains": false, "ssl_forced": false,
	}
	return request("POST", l.url("nginx-proxy-manager")+"/api/nginx/proxy-hosts", host, nil, "Authorization", "Bearer "+tok)
}

func checkProxyHost(l *lab) error {
	tok, err := l.npmToken()
	if err != nil {
		return err
	}
	var hosts []struct {
		DomainNames []string `json:"domain_names"`
	}
	if err := request("GET", l.url("nginx-proxy-manager")+"/api/nginx/proxy-hosts", nil, &hosts, "Authorization", "Bearer "+tok); err != nil {
		return err
	}
	for _, h := range hosts {
		if slices.Contains(h.DomainNames, proxyHost) {
			return nil
		}
	}
	return fmt.Errorf("the proxy host %s is gone after the move", proxyHost)
}

// watchdogCases breaks two apps the ways the watchdog is for: one hangs
// (its process stopped, so its health check fails), another's container
// is removed. Two watchdog runs in a row see each, the second brings it
// back, and the alert reaches ntfy.
func (l *lab) watchdogCases(t *testing.T, ids []string) {
	// A first run sees every app well, so a removed one counts as one
	// that ran this week.
	out, err := l.try("watchdog")
	for _, id := range ids {
		if !strings.Contains(out, "✓ "+id+"\n") {
			t.Fatalf("the watchdog's first run did not see %s well", id)
		}
	}
	if err != nil && len(ids) == len(apps) {
		t.Fatalf("the watchdog's first run found something down: %v", err)
	}
	hang := ""
	if slices.Contains(ids, "vaultwarden") {
		hang = "vaultwarden"
	}
	remove := ""
	for _, id := range []string{"paperless", "nginx-proxy-manager"} {
		if slices.Contains(ids, id) {
			remove = id
			break
		}
	}
	if hang == "" && remove == "" {
		t.Skip("no app in this run to break")
	}
	if hang != "" {
		docker(t, "kill", "--signal", "STOP", l.container(hang))
		waitFor(t, hang+" unhealthy", 6*time.Minute, func() error {
			if h := l.status()[hang].Health; h != "unhealthy" {
				return fmt.Errorf("health %q", h)
			}
			return nil
		})
	}
	if remove != "" {
		docker(t, "rm", "-f", l.container(remove))
	}
	healed := func() error {
		st := l.status()
		for _, id := range []string{hang, remove} {
			if id != "" && (st[id].State != "running" || st[id].Health == "unhealthy") {
				return fmt.Errorf("%s is %s %s", id, st[id].State, st[id].Health)
			}
		}
		return nil
	}
	for i := 0; i < 3 && healed() != nil; i++ {
		_, _ = l.try("watchdog")
	}
	if err := healed(); err != nil {
		t.Fatalf("after three watchdog runs: %v", err)
	}
	var back []realApp
	for _, a := range chosen() {
		if a.id == hang || a.id == remove {
			back = append(back, a)
		}
	}
	l.up(back)
	if slices.Contains(ids, "ntfy") {
		waitFor(t, "the watchdog's alert in ntfy", time.Minute, func() error { return l.alerted("restarted an app that hung") })
	}
}

// Actual Budget: the server's password, set through its API as the first
// page does, signs in after the move (it lives in account.sqlite).
const actualPassword = "nightly-password"

func seedActual(l *lab) error {
	var r struct {
		Status string `json:"status"`
	}
	if err := request("POST", l.url("actual-budget")+"/account/bootstrap", map[string]string{"password": actualPassword}, &r); err != nil {
		return err
	}
	if r.Status != "ok" {
		return fmt.Errorf("bootstrap: %s", r.Status)
	}
	return nil
}

func checkActual(l *lab) error {
	var r struct {
		Status string `json:"status"`
		Data   struct {
			Token string `json:"token"`
		} `json:"data"`
	}
	if err := request("POST", l.url("actual-budget")+"/account/login", map[string]string{"password": actualPassword}, &r); err != nil {
		return err
	}
	if r.Status != "ok" || r.Data.Token == "" {
		return fmt.Errorf("signing in after the move: %s", r.Status)
	}
	return nil
}

// Tandoor: an administrator and the household's space made in its
// container (as its first page does), then a recipe through the API,
// signed in with allauth's session token; the recipe is found after the
// move.
const tandoorRecipe = "Nightly soup"

func tandoorSession(l *lab) (string, error) {
	var r struct {
		Meta struct {
			SessionToken string `json:"session_token"`
		} `json:"meta"`
	}
	err := request("POST", l.url("tandoor")+"/_allauth/app/v1/auth/login", map[string]string{"username": "nightly", "password": "nightly-password"}, &r)
	return r.Meta.SessionToken, err
}

func seedTandoor(l *lab) error {
	ctr := l.container("tandoor")
	if out, err := exec.Command("docker", "exec", "-e", "DJANGO_SUPERUSER_PASSWORD=nightly-password", ctr, "sh", "-c",
		"cd /opt/recipes && . venv/bin/activate && python manage.py createsuperuser --noinput --username nightly --email nightly@example.com").CombinedOutput(); err != nil && !strings.Contains(string(out), "already taken") {
		return fmt.Errorf("making the administrator: %v %s", err, out)
	}
	space := `from django.contrib.auth.models import User, Group
from cookbook.models import Space, UserSpace
u = User.objects.get(username="nightly")
s, _ = Space.objects.get_or_create(name="Home", defaults={"created_by": u})
us, _ = UserSpace.objects.get_or_create(user=u, space=s, defaults={"active": True})
us.groups.add(Group.objects.get(name="admin"))`
	if out, err := exec.Command("docker", "exec", ctr, "sh", "-c", "cd /opt/recipes && . venv/bin/activate && python manage.py shell -c '"+space+"'").CombinedOutput(); err != nil {
		return fmt.Errorf("making the space: %v %s", err, out)
	}
	tok, err := tandoorSession(l)
	if err != nil {
		return err
	}
	return request("POST", l.url("tandoor")+"/api/recipe/", map[string]any{"name": tandoorRecipe, "steps": []any{}}, nil, "X-Session-Token", tok)
}

func checkTandoor(l *lab) error {
	tok, err := tandoorSession(l)
	if err != nil {
		return err
	}
	var found struct {
		Count int `json:"count"`
	}
	if err := request("GET", l.url("tandoor")+"/api/recipe/?query="+url.QueryEscape(tandoorRecipe), nil, &found, "X-Session-Token", tok); err != nil {
		return err
	}
	if found.Count != 1 {
		return fmt.Errorf("the recipe %q is gone after the move", tandoorRecipe)
	}
	return nil
}

// Linkwarden: the first account (the administrator) signed up through its
// API, a link saved with the session's token, and the copy Linkwarden
// keeps of the page (a screenshot, a PDF, or its text) served before and
// after the move.
const linkwardenLink = "https://example.com/nightly-run"

func linkwardenToken(l *lab) (string, error) {
	var r struct {
		Response struct {
			Token string `json:"token"`
		} `json:"response"`
	}
	if err := request("POST", l.url("linkwarden")+"/api/v1/session", map[string]string{"username": "nightly", "password": "nightly-password", "sessionName": "nightly run"}, &r); err != nil {
		return "", err
	}
	if r.Response.Token == "" {
		return "", fmt.Errorf("signing in gave no token")
	}
	return r.Response.Token, nil
}

func seedLinkwarden(l *lab) error {
	if err := request("POST", l.url("linkwarden")+"/api/v1/users", map[string]string{"name": "Nightly", "username": "nightly", "password": "nightly-password"}, nil); err != nil {
		return fmt.Errorf("signing up: %w", err)
	}
	tok, err := linkwardenToken(l)
	if err != nil {
		return err
	}
	return request("POST", l.url("linkwarden")+"/api/v1/links", map[string]string{"url": linkwardenLink, "name": "Nightly run"}, nil, "Authorization", "Bearer "+tok)
}

func checkLinkwarden(l *lab) error {
	tok, err := linkwardenToken(l)
	if err != nil {
		return err
	}
	// Linkwarden keeps a copy of the page (a screenshot, a PDF, its text)
	// a little after the link is saved; each is a path once it is there.
	var kept []string
	for range 60 {
		var found struct {
			Response []linkwardenSaved `json:"response"`
		}
		if err := request("GET", l.url("linkwarden")+"/api/v1/links?sort=0", nil, &found, "Authorization", "Bearer "+tok); err != nil {
			return err
		}
		i := slices.IndexFunc(found.Response, func(link linkwardenSaved) bool { return link.URL == linkwardenLink })
		if i < 0 {
			return fmt.Errorf("the link %s is gone (%d links)", linkwardenLink, len(found.Response))
		}
		link := found.Response[i]
		kept = kept[:0]
		// The screenshot is a PNG (format 0) or a JPEG (1).
		for _, c := range []struct {
			path    string
			formats []int
		}{{link.Image, []int{0, 1}}, {link.PDF, []int{2}}, {link.Readable, []int{3}}} {
			if c.path != "" && c.path != "unavailable" {
				for _, f := range c.formats {
					kept = append(kept, strconv.Itoa(f))
				}
			}
		}
		for _, format := range kept {
			resp, err := linkwardenArchive(l, tok, link.ID, format)
			if err == nil && resp.StatusCode == http.StatusOK && resp.ContentLength != 0 {
				resp.Body.Close()
				return nil
			}
			if err == nil {
				resp.Body.Close()
			}
		}
		time.Sleep(3 * time.Second)
	}
	return fmt.Errorf("no copy of %s kept after 3 minutes (copies listed: %q)", linkwardenLink, kept)
}

// linkwardenSaved is a saved link and where its kept copies are.
type linkwardenSaved struct {
	ID       int    `json:"id"`
	URL      string `json:"url"`
	Image    string `json:"image"`
	PDF      string `json:"pdf"`
	Readable string `json:"readable"`
}

// linkwardenArchive fetches a kept copy of a link (formats 0 and 1 the
// screenshot, 2 the PDF, 3 the page's text).
func linkwardenArchive(l *lab, tok string, id int, format string) (*http.Response, error) {
	req, err := http.NewRequest("GET", fmt.Sprintf("%s/api/v1/archives/%d?format=%s", l.url("linkwarden"), id, format), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+tok)
	return (&http.Client{Timeout: 30 * time.Second}).Do(req)
}

// Firefly III: the first account signed up through its own form (it has
// no API for that), Passport's personal client made with artisan (a fresh
// install has none, so Profile › OAuth cannot make a token), a token made
// the way that page does, then an asset account through the API. The
// importer is set up as its note says (the token in .env, then installed)
// and a bank's CSV goes through it into that account; after the move the
// account and the imported transactions are back.
const (
	fireflyEmail    = "nightly@example.com"
	fireflyPassword = "nightly-password-long-1"
	fireflyAccount  = "Nightly checking"
)

var (
	formToken = regexp.MustCompile(`name="_token" value="([^"]+)"`)
	metaToken = regexp.MustCompile(`name="csrf-token" content="([^"]+)"`)
)

// fireflyForm fetches page, then posts its form with values and the
// page's CSRF token, as a browser would.
func fireflyForm(c *http.Client, base, page string, values url.Values) error {
	resp, err := c.Get(base + page)
	if err != nil {
		return err
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	m := formToken.FindSubmatch(body)
	if m == nil {
		return fmt.Errorf("%s has no form token", page)
	}
	values.Set("_token", string(m[1]))
	resp, err = c.PostForm(base+page, values)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("POST %s: %s", page, resp.Status)
	}
	return nil
}

// fireflyToken signs in (or signs up first) and makes a personal access token.
func fireflyToken(l *lab, signUp bool) (string, error) {
	jar, _ := cookiejar.New(nil)
	c := &http.Client{Jar: jar, Timeout: 30 * time.Second}
	base := l.url("firefly-iii")
	form := url.Values{"email": {fireflyEmail}, "password": {fireflyPassword}}
	page := "/login"
	if signUp {
		page = "/register"
		form.Set("password_confirmation", fireflyPassword)
	}
	if err := fireflyForm(c, base, page, form); err != nil {
		return "", err
	}
	resp, err := c.Get(base + "/profile")
	if err != nil {
		return "", err
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	m := metaToken.FindSubmatch(body)
	if m == nil {
		return "", fmt.Errorf("not signed in: the profile page has no CSRF token")
	}
	req, _ := http.NewRequest("POST", base+"/oauth/personal-access-tokens", strings.NewReader(`{"name":"nightly run","scopes":[]}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-CSRF-TOKEN", string(m[1]))
	resp, err = c.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var tok struct {
		AccessToken string `json:"accessToken"`
	}
	data, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(data, &tok); err != nil || tok.AccessToken == "" {
		return "", fmt.Errorf("making a token: %s %s", resp.Status, tail(string(data), 3))
	}
	return tok.AccessToken, nil
}

func seedFirefly(l *lab) error {
	if out, err := exec.Command("docker", "exec", l.container("firefly-iii"), "php", "artisan", "passport:client", "--personal",
		"--name=Firefly III Personal Access Client", "--provider=users", "--no-interaction").CombinedOutput(); err != nil {
		return fmt.Errorf("making Passport's personal client: %v %s", err, out)
	}
	tok, err := fireflyToken(l, true)
	if err != nil {
		return err
	}
	var account struct {
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := request("POST", l.url("firefly-iii")+"/api/v1/accounts", map[string]string{"name": fireflyAccount, "type": "asset", "account_role": "defaultAsset"}, &account,
		"Authorization", "Bearer "+tok, "Accept", "application/vnd.api+json"); err != nil {
		return err
	}
	return fireflyImport(l, tok, account.Data.ID)
}

// fireflyBank is a bank's CSV file, as the importer's own example has it.
const fireflyBank = "date,description,amount\n2026-01-05,Nightly groceries,-42.10\n2026-01-06,Nightly salary,1500.00\n"

// fireflyImport sets up the importer as its note says (the token in .env,
// then installed) and brings fireflyBank into the account through it: the
// importer's own command, with the file in a folder it is allowed to read.
func fireflyImport(l *lab, tok, account string) error {
	l.setEnv("FIREFLY_IMPORTER_TOKEN", tok)
	l.run("install", "firefly-iii-importer", "--apply")
	id, err := strconv.Atoi(account)
	if err != nil {
		return fmt.Errorf("the account's id %q: %w", account, err)
	}
	config, _ := json.Marshal(map[string]any{
		"version": 3, "flow": "file", "content_type": "csv", "date": "Y-m-d", "default_account": id,
		"delimiter": "comma", "headers": true, "roles": []string{"date_transaction", "description", "amount"},
		"do_mapping": []bool{false, false, false}, "mapping": []any{}, "duplicate_detection_method": "none",
		"ignore_duplicate_lines": false, "ignore_duplicate_transactions": false, "unique_column_index": 0, "unique_column_type": "internal_reference",
		"skip_form": true, "rules": false, "add_import_tag": true, "conversion": false,
	})
	ctr := l.container("firefly-iii-importer")
	put := func(name, body string) error {
		c := exec.Command("docker", "exec", "-i", ctr, "sh", "-c", "mkdir -p /tmp/nightly && cat > /tmp/nightly/"+name)
		c.Stdin = strings.NewReader(body)
		if out, err := c.CombinedOutput(); err != nil {
			return fmt.Errorf("putting %s in the importer: %v %s", name, err, out)
		}
		return nil
	}
	if err := put("config.json", string(config)); err != nil {
		return err
	}
	if err := put("bank.csv", fireflyBank); err != nil {
		return err
	}
	// The importer reads its settings once, at its start; the folder it
	// may import from is given to this command alone.
	var out []byte
	for range 20 {
		if out, err = exec.Command("docker", "exec", "-e", "IMPORT_DIR_ALLOWLIST=/tmp/nightly", ctr, "sh", "-c",
			"php artisan config:clear >/dev/null && php artisan importer:import /tmp/nightly/config.json /tmp/nightly/bank.csv").CombinedOutput(); err == nil {
			break
		}
		time.Sleep(3 * time.Second) // the importer may still be starting
	}
	if err != nil {
		return fmt.Errorf("the importer: %v %s", err, tail(string(out), 15))
	}
	return fireflyImported(l, tok)
}

// fireflyImported finds the CSV's two transactions through Firefly's API.
func fireflyImported(l *lab, tok string) error {
	var found struct {
		Data []struct {
			Attributes struct {
				Transactions []struct {
					Description string `json:"description"`
				} `json:"transactions"`
			} `json:"attributes"`
		} `json:"data"`
	}
	var seen []string
	for range 20 {
		if err := request("GET", l.url("firefly-iii")+"/api/v1/transactions?limit=50", nil, &found, "Authorization", "Bearer "+tok, "Accept", "application/vnd.api+json"); err != nil {
			return err
		}
		seen = seen[:0]
		for _, g := range found.Data {
			for _, t := range g.Attributes.Transactions {
				seen = append(seen, t.Description)
			}
		}
		if slices.Contains(seen, "Nightly groceries") && slices.Contains(seen, "Nightly salary") {
			return nil
		}
		time.Sleep(3 * time.Second)
	}
	return fmt.Errorf("the imported transactions are not in Firefly III (it has %q)", seen)
}

func checkFirefly(l *lab) error {
	tok, err := fireflyToken(l, false)
	if err != nil {
		return err
	}
	var found struct {
		Data []struct {
			Attributes struct {
				Name string `json:"name"`
			} `json:"attributes"`
		} `json:"data"`
	}
	if err := request("GET", l.url("firefly-iii")+"/api/v1/accounts?type=asset", nil, &found, "Authorization", "Bearer "+tok, "Accept", "application/vnd.api+json"); err != nil {
		return err
	}
	for _, a := range found.Data {
		if a.Attributes.Name == fireflyAccount {
			return fireflyImported(l, tok)
		}
	}
	return fmt.Errorf("the account %q is gone after the move", fireflyAccount)
}

// Kiwix: a small ZIM file (openzim's test file) put in the media drive's
// kiwix folder, Kiwix restarted to add it to its library, the library
// listing it, and its main page opening; after the move the file is back
// (its folder moves with the media), listed, and read again.
const kiwixZIM = "https://github.com/openzim/zim-testing-suite/raw/main/data/withns/small.zim"

func kiwixFolder(l *lab) string {
	if dir := l.env("KIWIX_ZIM_ROOT"); dir != "" {
		return dir
	}
	return filepath.Join(l.env("MEDIA_ROOT"), "kiwix")
}

func seedKiwix(l *lab) error {
	dir := kiwixFolder(l)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	// GitHub answers the raw link with a redirect, which web refuses to follow.
	resp, err := (&http.Client{Timeout: time.Minute}).Get(kiwixZIM)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("downloading the test ZIM: %s", resp.Status)
	}
	f, err := os.Create(filepath.Join(dir, "small.zim"))
	if err != nil {
		return err
	}
	if _, err := io.Copy(f, resp.Body); err != nil {
		f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	l.run("restart", "kiwix")
	return checkKiwix(l)
}

func checkKiwix(l *lab) error {
	var last string
	for range 30 {
		if resp, err := web.Get(l.url("kiwix") + "/catalog/v2/entries"); err == nil {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			if last = string(body); resp.StatusCode == http.StatusOK && strings.Contains(last, "<entry>") {
				return kiwixPage(l, last)
			}
		}
		time.Sleep(2 * time.Second)
	}
	return fmt.Errorf("the library lists no book: %s", tail(last, 5))
}

// kiwixContent is a book's address in the library's listing.
var kiwixContent = regexp.MustCompile(`<link[^>]*href="([^"]*/content/[^"]+)"`)

// kiwixPage opens the book the library lists, as a reader's click does:
// its main page, served from the ZIM file.
func kiwixPage(l *lab, entries string) error {
	m := kiwixContent.FindStringSubmatch(entries)
	if m == nil {
		return fmt.Errorf("the library's book has no page: %s", tail(entries, 5))
	}
	// The book's address answers with a redirect to its main page.
	resp, err := (&http.Client{Timeout: 30 * time.Second}).Get(l.url("kiwix") + strings.TrimPrefix(m[1], strings.TrimSuffix(urlPath(l.url("kiwix")), "/")))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK || !strings.Contains(strings.ToLower(string(body)), "<html") {
		return fmt.Errorf("the book's page %s: %s %s", m[1], resp.Status, tail(string(body), 3))
	}
	return nil
}

// urlPath is the path part of an address ("" for none).
func urlPath(address string) string {
	u, err := url.Parse(address)
	if err != nil {
		return ""
	}
	return u.Path
}

// Beszel: its first account comes from .env; the hub's key, read through
// its API, goes to the agent (installed then, as Setup says), this machine
// is added as a system, it is up, and the hub keeps its containers'
// history, before and after the move.
func beszelToken(l *lab) (string, string, error) {
	var r struct {
		Token  string `json:"token"`
		Record struct {
			ID string `json:"id"`
		} `json:"record"`
	}
	err := request("POST", l.url("beszel")+"/api/collections/users/auth-with-password", map[string]string{"identity": l.env("BESZEL_EMAIL"), "password": l.env("BESZEL_PASSWORD")}, &r)
	return r.Token, r.Record.ID, err
}

func seedBeszel(l *lab) error {
	tok, user, err := beszelToken(l)
	if err != nil {
		return fmt.Errorf("signing in with BESZEL_EMAIL and BESZEL_PASSWORD: %w", err)
	}
	var key struct {
		Key string `json:"key"`
	}
	if err := request("GET", l.url("beszel")+"/api/beszel/getkey", nil, &key, "Authorization", tok); err != nil {
		return err
	}
	l.setEnv("BESZEL_AGENT_KEY", key.Key)
	l.run("install", "beszel-agent", "--apply")
	port := l.env("BESZEL_AGENT_PORT")
	if port == "" {
		port = "45876"
	}
	if err := request("POST", l.url("beszel")+"/api/collections/systems/records", map[string]any{"name": "This machine", "host": "host.docker.internal", "port": port, "users": []string{user}}, nil, "Authorization", tok); err != nil {
		return err
	}
	return checkBeszel(l)
}

func checkBeszel(l *lab) error {
	var status string
	for range 45 {
		if tok, _, err := beszelToken(l); err == nil {
			var r struct {
				Items []struct {
					Status string `json:"status"`
				} `json:"items"`
			}
			if err := request("GET", l.url("beszel")+"/api/collections/systems/records", nil, &r, "Authorization", tok); err == nil && len(r.Items) > 0 {
				if status = r.Items[0].Status; status == "up" {
					return beszelContainers(l, tok)
				}
			}
		}
		time.Sleep(2 * time.Second)
	}
	return fmt.Errorf("this machine is %q in Beszel, not up", status)
}

// beszelContainers waits for the hub's history of this machine's
// containers: the agent sends each container's use every minute.
func beszelContainers(l *lab, tok string) error {
	var names []string
	for range 60 {
		var r struct {
			Items []struct {
				Stats []struct {
					Name string `json:"n"`
				} `json:"stats"`
			} `json:"items"`
		}
		if err := request("GET", l.url("beszel")+"/api/collections/container_stats/records?perPage=1&sort=-created", nil, &r, "Authorization", tok); err == nil && len(r.Items) > 0 {
			names = names[:0]
			for _, s := range r.Items[0].Stats {
				names = append(names, s.Name)
			}
			if slices.ContainsFunc(names, func(n string) bool { return strings.Contains(n, "beszel") }) {
				return nil
			}
		}
		time.Sleep(3 * time.Second)
	}
	return fmt.Errorf("the hub has no history of this machine's containers after 3 minutes (last: %q)", names)
}

// Paperless-AI: a text document put in Paperless, Paperless's token in
// .env and Paperless-AI installed with it, set up through its own /setup
// with an OpenAI-compatible model that this test plays (the runner has no
// AI model), a scan started with its API key, and Paperless showing the
// title the model gave; after the move its history still lists the
// document.
const paperlessAITitle = "Nightly water bill"

// fakeModel answers chat completions as a model would for Paperless-AI's
// prompt, on a port the containers reach as host.docker.internal. It runs
// for the whole run, as Ollama would: Paperless-AI checks its model at
// each start, the one after the move included.
var fakeModel = sync.OnceValues(func() (string, error) {
	ln, err := net.Listen("tcp", "0.0.0.0:0")
	if err != nil {
		return "", err
	}
	answer, _ := json.Marshal(map[string]any{"title": paperlessAITitle, "correspondent": "Nightly Water", "tags": []string{"nightly-ai"}, "document_date": "2026-01-01", "language": "en"})
	srv := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"id": "nightly", "object": "chat.completion", "created": 0, "model": "nightly",
			"choices": []map[string]any{{"index": 0, "finish_reason": "stop", "message": map[string]string{"role": "assistant", "content": string(answer)}}},
			"usage":   map[string]int{"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
		})
	}))
	srv.Listener.Close()
	srv.Listener = ln
	srv.Start()
	return fmt.Sprintf("http://host.docker.internal:%d/v1", ln.Addr().(*net.TCPAddr).Port), nil
})

func seedPaperlessAI(l *lab) error {
	paperless := l.url("paperless")
	auth := basic("nightly", "nightly-password")
	var tok struct {
		Token string `json:"token"`
	}
	if err := request("POST", paperless+"/api/token/", map[string]string{"username": "nightly", "password": "nightly-password"}, &tok); err != nil {
		return fmt.Errorf("Paperless's token: %w", err)
	}
	if err := paperlessUpload(paperless, auth); err != nil {
		return err
	}
	l.setEnv("PAPERLESS_AI_PAPERLESS_TOKEN", tok.Token)
	l.run("install", "paperless-ai", "--apply")
	l.up([]realApp{{id: "paperless-ai", page: "/health"}})
	base, err := fakeModel()
	if err != nil {
		return err
	}
	ai := l.url("paperless-ai")
	slow := &http.Client{Timeout: 3 * time.Minute}
	setup, _ := json.Marshal(map[string]any{
		// What its setup page fills in from the homelab's settings.
		"paperlessUrl": "http://paperless:8000", "paperlessToken": tok.Token, "paperlessUsername": "nightly",
		"aiProvider": "custom", "customBaseUrl": base, "customApiKey": "nightly", "customModel": "nightly",
		"activateTagging": true, "activateCorrespondents": true, "activateTitle": true,
		"username": "nightly", "password": "nightly-password",
	})
	resp, err := slow.Post(ai+"/setup", "application/json", bytes.NewReader(setup))
	if err != nil {
		return err
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Paperless-AI's setup: %s %s", resp.Status, tail(string(body), 5))
	}
	// It restarts itself 5 seconds after saving the settings.
	time.Sleep(10 * time.Second)
	var last string
	for range 30 {
		req, _ := http.NewRequest("POST", ai+"/api/scan/now", nil)
		req.Header.Set("x-api-key", l.env("PAPERLESS_AI_API_KEY"))
		if resp, err := slow.Do(req); err != nil {
			last = err.Error()
		} else {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			last = resp.Status + " " + tail(string(body), 3)
		}
		var docs struct {
			Results []struct {
				Title string `json:"title"`
			} `json:"results"`
		}
		if err := request("GET", paperless+"/api/documents/?title__iexact="+url.QueryEscape(paperlessAITitle), nil, &docs, "Authorization", auth); err == nil && len(docs.Results) == 1 {
			return checkPaperlessAI(l)
		}
		time.Sleep(5 * time.Second)
	}
	return fmt.Errorf("Paperless shows no document titled %q (the last scan: %s)", paperlessAITitle, last)
}

// paperlessUpload puts a short text document in Paperless and waits for
// it to be read.
func paperlessUpload(paperless, auth string) error {
	var form bytes.Buffer
	mw := multipart.NewWriter(&form)
	part, _ := mw.CreateFormFile("document", "water-bill.txt")
	io.WriteString(part, "City Water. Invoice for January 2026. Amount due: 42.00. Pay by 31 January.\n")
	mw.Close()
	req, _ := http.NewRequest("POST", paperless+"/api/documents/post_document/", &form)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", auth)
	resp, err := web.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("uploading to Paperless: %s", resp.Status)
	}
	for range 60 {
		var docs struct {
			Count int `json:"count"`
		}
		if err := request("GET", paperless+"/api/documents/", nil, &docs, "Authorization", auth); err == nil && docs.Count > 0 {
			return nil
		}
		time.Sleep(2 * time.Second)
	}
	return fmt.Errorf("Paperless did not take in the uploaded document")
}

func checkPaperlessAI(l *lab) error {
	var history struct {
		Data []struct {
			Title string `json:"title"`
		} `json:"data"`
	}
	var err error
	for range 30 {
		if err = request("GET", l.url("paperless-ai")+"/api/history?draw=1", nil, &history, "x-api-key", l.env("PAPERLESS_AI_API_KEY")); err == nil {
			for _, d := range history.Data {
				if d.Title == paperlessAITitle {
					return nil
				}
			}
			err = fmt.Errorf("its history does not list %q (%d documents)", paperlessAITitle, len(history.Data))
		}
		time.Sleep(2 * time.Second)
	}
	return err
}

// Tdarr: its first account through its own sign-up (closed after that),
// its node seen by the server, and a library on the movies folder, read
// back after the move with the node there again.
const (
	tdarrUser     = "nightly"
	tdarrPassword = "nightly-password-1"
	tdarrLibrary  = "Nightly films"
)

func tdarrToken(l *lab, path string) (string, error) {
	var r struct {
		Token string `json:"token"`
	}
	err := request("POST", l.url("tdarr")+path, map[string]string{"username": tdarrUser, "password": tdarrPassword}, &r)
	return "Bearer " + r.Token, err
}

func seedTdarr(l *lab) error {
	tok, err := tdarrToken(l, "/api/v2/public/auth/register")
	if err != nil {
		return fmt.Errorf("its first account: %w", err)
	}
	library := map[string]any{"_id": "nightly", "priority": 0, "name": tdarrLibrary, "folder": "/media/movies", "cache": "/temp", "container": ".mkv"}
	if err := request("POST", l.url("tdarr")+"/api/v2/cruddb", map[string]any{"data": map[string]any{"collection": "LibrarySettingsJSONDB", "mode": "insert", "docID": "nightly", "obj": library}}, nil, "Authorization", tok); err != nil {
		return fmt.Errorf("adding a library: %w", err)
	}
	return checkTdarr(l)
}

func checkTdarr(l *lab) error {
	tok, err := tdarrToken(l, "/api/v2/public/auth/login")
	if err != nil {
		return fmt.Errorf("signing in: %w", err)
	}
	var lib struct {
		Name   string `json:"name"`
		Folder string `json:"folder"`
	}
	if err := request("POST", l.url("tdarr")+"/api/v2/cruddb", map[string]any{"data": map[string]any{"collection": "LibrarySettingsJSONDB", "mode": "getById", "docID": "nightly"}}, &lib, "Authorization", tok); err != nil {
		return err
	}
	if lib.Name != tdarrLibrary {
		return fmt.Errorf("the library %q is gone (found %q)", tdarrLibrary, lib.Name)
	}
	// Its own node connects to the server a little after it starts.
	var nodes map[string]struct {
		NodeName string `json:"nodeName"`
	}
	for range 30 {
		if err = request("GET", l.url("tdarr")+"/api/v2/get-nodes", nil, &nodes, "Authorization", tok); err == nil {
			for _, n := range nodes {
				if n.NodeName == "homelab" {
					return nil
				}
			}
			err = fmt.Errorf("its node is not connected (%d nodes)", len(nodes))
		}
		time.Sleep(2 * time.Second)
	}
	return err
}

// Frigate: a camera that is FFmpeg's test pattern (the runner has no
// camera), saved through Frigate's own API, then frames arriving from it
// and Frigate online on its broker, signed in as frigate; after the move,
// the camera is back and running.
const frigateCamera = `mqtt:
  host: frigate-mqtt
  user: frigate
  password: "{FRIGATE_MQTT_PASSWORD}"
detectors:
  cpu:
    type: cpu
cameras:
  nightly:
    ffmpeg:
      inputs:
        - path: testsrc=size=640x360:rate=5
          input_args: -re -f lavfi
          roles:
            - detect
    detect:
      width: 640
      height: 360
      fps: 5
`

// frigateAPI calls Frigate's API on its port inside Docker (5000, no
// sign-in), as Home Assistant does.
func frigateAPI(l *lab, body, method, path string) (string, error) {
	args := []string{"exec", "-i", l.container("frigate"), "curl", "-sS", "--fail-with-body", "-X", method, "http://127.0.0.1:5000" + path}
	if body != "" {
		args = append(args, "-H", "Content-Type: text/plain", "--data-binary", "@-")
	}
	cmd := exec.Command("docker", args...)
	cmd.Stdin = strings.NewReader(body)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("%s %s: %v %s", method, path, err, tail(string(out), 5))
	}
	return string(out), nil
}

func seedFrigate(l *lab) error {
	if _, err := frigateAPI(l, frigateCamera, "POST", "/api/config/save?save_option=restart"); err != nil {
		return err
	}
	return checkFrigate(l)
}

func checkFrigate(l *lab) error {
	if err := frigateFrames(l); err != nil {
		return err
	}
	// Frigate says it is online on its broker, which lets only frigate in.
	sub := exec.Command("docker", "exec", l.container("frigate-mqtt"), "mosquitto_sub", "-u", "frigate", "-P", l.env("FRIGATE_MQTT_PASSWORD"), "-t", "frigate/available", "-C", "1", "-W", "30")
	msg, err := sub.CombinedOutput()
	if err != nil || strings.TrimSpace(string(msg)) != "online" {
		return fmt.Errorf("Frigate is not online on its broker: %v %s", err, msg)
	}
	return nil
}

// frigateFrames waits for frames from the test camera.
func frigateFrames(l *lab) error {
	var last string
	for range 60 {
		out, err := frigateAPI(l, "", "GET", "/api/stats")
		var stats struct {
			Cameras map[string]struct {
				CameraFPS float64 `json:"camera_fps"`
			} `json:"cameras"`
		}
		switch {
		case err != nil:
			last = err.Error()
		case json.Unmarshal([]byte(out), &stats) != nil:
			last = tail(out, 3)
		case stats.Cameras["nightly"].CameraFPS > 0:
			return nil
		default:
			last = tail(out, 3)
		}
		time.Sleep(3 * time.Second)
	}
	return fmt.Errorf("the camera sends no frames: %s", last)
}

// Nextcloud: installed by itself on the first start with the
// administrator from .env, then a file uploaded over WebDAV as that
// account, the way the phone and desktop apps sync, and read back after
// the move.
const nextcloudFile = "Nightly/notes.txt"

var nextcloudText = "the nightly run's file\n"

func nextcloudDAV(l *lab, method, path string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest(method, l.url("nextcloud")+"/remote.php/dav/files/"+l.env("NEXTCLOUD_ADMIN_USER")+"/"+path, body)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(l.env("NEXTCLOUD_ADMIN_USER"), l.env("NEXTCLOUD_ADMIN_PASSWORD"))
	return (&http.Client{Timeout: time.Minute}).Do(req)
}

func seedNextcloud(l *lab) error {
	// Installing itself takes a while after the page first answers.
	var status struct {
		Installed bool `json:"installed"`
	}
	for range 60 {
		if request("GET", l.url("nextcloud")+"/status.php", nil, &status) == nil && status.Installed {
			break
		}
		time.Sleep(5 * time.Second)
	}
	if !status.Installed {
		return errors.New("it never finished installing (status.php)")
	}
	for _, step := range []struct {
		method, path string
		body         io.Reader
	}{
		{"MKCOL", "Nightly", nil},
		{"PUT", nextcloudFile, strings.NewReader(nextcloudText)},
	} {
		resp, err := nextcloudDAV(l, step.method, step.path, step.body)
		if err != nil {
			return err
		}
		resp.Body.Close()
		if resp.StatusCode != http.StatusCreated {
			return fmt.Errorf("%s %s over WebDAV: %s", step.method, step.path, resp.Status)
		}
	}
	return checkNextcloud(l)
}

func checkNextcloud(l *lab) error {
	resp, err := nextcloudDAV(l, "GET", nextcloudFile, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK || string(body) != nextcloudText {
		return fmt.Errorf("the file %s is gone: %s %q", nextcloudFile, resp.Status, tail(string(body), 3))
	}
	return nil
}

// Duplicati: Setup's two backup steps (a destination outside the homelab
// folder, then the jobs, whose AppData job runs once at once), then the
// restore test the monthly reminder asks for: a sample of settled files
// restored by Duplicati and compared with the live ones (ADR-0019: the
// nightly run tests a restore from both engines).
const duplicatiFolder = "duplicati-nightly"

func seedDuplicati(l *lab) error {
	// Settled, as the restore test samples only files a day old.
	dir := filepath.Join(l.root, "data", "appdata", duplicatiFolder)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	old := time.Now().Add(-72 * time.Hour)
	for name, text := range map[string]string{"first.txt": "Duplicati's first settled file\n", "second.txt": "Duplicati's second settled file\n"} {
		p := filepath.Join(dir, name)
		if err := os.WriteFile(p, []byte(text), 0o644); err != nil {
			return err
		}
		if err := os.Chtimes(p, old, old); err != nil {
			return err
		}
	}
	// Beside the homelab folder, as a backup drive would be: it outlives
	// the wipe below. Duplicati writes there as PUID, not as this run.
	dest := filepath.Join(filepath.Dir(l.root), "Homelab Backups")
	if err := os.MkdirAll(dest, 0o777); err != nil {
		return err
	}
	if err := os.Chmod(dest, 0o777); err != nil {
		return err
	}
	for _, args := range [][]string{{"duplicati", "destination", dest, "--apply"}, {"duplicati", "setup", "--apply"}} {
		if out, err := l.try(args...); err != nil {
			return fmt.Errorf("homelab %s: %w\n%s", strings.Join(args, " "), err, tail(out, 12))
		}
	}
	var last string
	ran := false
	for start := time.Now(); time.Since(start) < 10*time.Minute && !ran; time.Sleep(5 * time.Second) {
		out, err := l.try("--json", "duplicati", "jobs")
		if err != nil {
			last = err.Error()
			continue
		}
		var r struct {
			Data []struct {
				Name         string    `json:"name"`
				LastFinished time.Time `json:"lastFinished"`
				ErrorMessage string    `json:"errorMessage"`
			} `json:"data"`
		}
		if err := json.Unmarshal([]byte(lastLine(out)), &r); err != nil {
			last = err.Error()
			continue
		}
		for _, j := range r.Data {
			if j.Name == "Homelab AppData" {
				ran, last = !j.LastFinished.IsZero(), j.ErrorMessage
			}
		}
	}
	if !ran {
		return fmt.Errorf("Homelab AppData's first run did not finish in 10 minutes: %s", last)
	}
	if out, err := l.try("restore-test", "--auto"); err != nil {
		return fmt.Errorf("homelab restore-test --auto: %w\n%s", err, tail(out, 12))
	}
	var log struct {
		LastTest time.Time `json:"lastTest"`
		History  []struct {
			Passed bool   `json:"passed"`
			Job    string `json:"job"`
		} `json:"history"`
	}
	data, err := os.ReadFile(filepath.Join(l.root, "scripts", "logs", "restore-test.json"))
	if err == nil {
		err = json.Unmarshal(data, &log)
	}
	if err != nil || log.LastTest.IsZero() || len(log.History) == 0 || !log.History[len(log.History)-1].Passed || log.History[len(log.History)-1].Job != "Homelab AppData" {
		return fmt.Errorf("Duplicati's restore test is not on record as passed: %v %s", err, data)
	}
	return nil
}

// lastLine is the last line of a command's output: a --json command's
// answer, after anything it logged.
func lastLine(s string) string {
	lines := strings.Split(strings.TrimSpace(s), "\n")
	return lines[len(lines)-1]
}

// Kopia: a file in the apps' data folder, a snapshot of that folder made
// now through Kopia's API, and the file's folder restored from it into
// recovery-staging and read back; after the move, Kopia connects to the
// same repository again, and the file is read out of its latest snapshot.
const kopiaFolder, kopiaFile = "kopia-nightly", "note.txt"

var kopiaText = "the nightly run's file for Kopia\n"

func kopiaAPI(l *lab, method, path string, body, out any) error {
	auth := "Basic " + base64.StdEncoding.EncodeToString([]byte("admin:"+l.env("KOPIA_SERVER_PASSWORD")))
	return request(method, l.url("kopia")+"/api/v1/"+path, body, out, "Authorization", auth)
}

// kopiaEntry is one entry of a directory in a snapshot.
type kopiaEntry struct {
	Name string `json:"name"`
	Obj  string `json:"obj"`
}

// kopiaLatest is the object of the newest snapshot of /source/appdata.
func kopiaLatest(l *lab) (string, error) {
	var r struct {
		Snapshots []struct {
			RootID string `json:"rootID"`
		} `json:"snapshots"`
	}
	if err := kopiaAPI(l, "GET", "snapshots?userName=homelab&host=homelab&path=/source/appdata", nil, &r); err != nil {
		return "", err
	}
	if len(r.Snapshots) == 0 {
		return "", errors.New("no snapshot of /source/appdata")
	}
	return r.Snapshots[len(r.Snapshots)-1].RootID, nil
}

// kopiaFind is the object of name in the snapshot directory dir.
func kopiaFind(l *lab, dir, name string) (string, error) {
	var d struct {
		Entries []kopiaEntry `json:"entries"`
	}
	if err := kopiaAPI(l, "GET", "objects/"+dir, nil, &d); err != nil {
		return "", err
	}
	var names []string
	for _, e := range d.Entries {
		if e.Name == name {
			return e.Obj, nil
		}
		names = append(names, e.Name)
	}
	return "", fmt.Errorf("%s is not in the snapshot (it has %q)", name, names)
}

func seedKopia(l *lab) error {
	dir := filepath.Join(l.root, "data", "appdata", kopiaFolder)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(dir, kopiaFile), []byte(kopiaText), 0o644); err != nil {
		return err
	}
	if err := kopiaAPI(l, "POST", "sources/upload?userName=homelab&host=homelab&path=/source/appdata", map[string]any{}, nil); err != nil {
		return fmt.Errorf("snapshot now: %w", err)
	}
	var folder string
	var err error
	for range 60 {
		var root string
		if root, err = kopiaLatest(l); err == nil {
			if folder, err = kopiaFind(l, root, kopiaFolder); err == nil {
				break
			}
		}
		time.Sleep(3 * time.Second)
	}
	if err != nil {
		return fmt.Errorf("no snapshot holds %s after 3 minutes: %w", kopiaFolder, err)
	}
	// A restore of that folder alone, as a person would bring one app back.
	var task struct {
		ID string `json:"id"`
	}
	target := "/staging/restore-test/" + kopiaFolder
	if err := kopiaAPI(l, "POST", "restore", map[string]any{"root": folder, "fsOutput": map[string]any{"targetPath": target, "overwriteFiles": true, "overwriteDirectories": true, "skipOwners": true}, "options": map[string]any{"restoreDirEntryAtDepth": 1<<31 - 1}}, &task); err != nil {
		return fmt.Errorf("restore: %w", err)
	}
	var status struct {
		Status       string `json:"status"`
		ErrorMessage string `json:"errorMessage"`
	}
	for range 60 {
		if err := kopiaAPI(l, "GET", "tasks/"+task.ID, nil, &status); err == nil && status.Status != "RUNNING" {
			break
		}
		time.Sleep(time.Second)
	}
	if status.Status != "SUCCESS" {
		return fmt.Errorf("the restore ended %s: %s", status.Status, status.ErrorMessage)
	}
	got, err := os.ReadFile(filepath.Join(l.root, "recovery-staging", "restore-test", kopiaFolder, kopiaFile))
	if err != nil {
		return fmt.Errorf("the restored file: %w", err)
	}
	if string(got) != kopiaText {
		return fmt.Errorf("the restored file says %q", got)
	}
	return nil
}

// kopiaRead is a file's contents, straight out of the repository.
func kopiaRead(l *lab, obj string) (string, error) {
	req, err := http.NewRequest("GET", l.url("kopia")+"/api/v1/objects/"+obj, nil)
	if err != nil {
		return "", err
	}
	req.SetBasicAuth("admin", l.env("KOPIA_SERVER_PASSWORD"))
	resp, err := web.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("reading %s: %s", obj, resp.Status)
	}
	return string(data), nil
}

func checkKopia(l *lab) error {
	var last error
	for range 40 {
		var text string
		root, err := kopiaLatest(l)
		if err == nil {
			var folder, file string
			if folder, err = kopiaFind(l, root, kopiaFolder); err == nil {
				if file, err = kopiaFind(l, folder, kopiaFile); err == nil {
					if text, err = kopiaRead(l, file); err == nil && text == kopiaText {
						return nil
					}
				}
			}
		}
		last = err
		time.Sleep(3 * time.Second)
	}
	return fmt.Errorf("the file is not in Kopia's snapshots after the move: %v", last)
}
