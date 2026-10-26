//go:build realdocker

package realdocker

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"os/exec"
	"regexp"
	"slices"
	"strings"
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
// API, a link saved with the session's token, and found again after the
// move.
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
	var found struct {
		Response []struct {
			URL string `json:"url"`
		} `json:"response"`
	}
	if err := request("GET", l.url("linkwarden")+"/api/v1/links?sort=0", nil, &found, "Authorization", "Bearer "+tok); err != nil {
		return err
	}
	for _, link := range found.Response {
		if link.URL == linkwardenLink {
			return nil
		}
	}
	return fmt.Errorf("the link %s is gone after the move (%d links)", linkwardenLink, len(found.Response))
}

// Firefly III: the first account signed up through its own form (it has
// no API for that), Passport's personal client made with artisan (a fresh
// install has none, so Profile › OAuth cannot make a token), a token made
// the way that page does, then an asset account through the API, found
// again after the move.
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
	return request("POST", l.url("firefly-iii")+"/api/v1/accounts", map[string]string{"name": fireflyAccount, "type": "asset", "account_role": "defaultAsset"}, nil,
		"Authorization", "Bearer "+tok, "Accept", "application/vnd.api+json")
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
			return nil
		}
	}
	return fmt.Errorf("the account %q is gone after the move", fireflyAccount)
}
