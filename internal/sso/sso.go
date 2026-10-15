// Package sso connects the household's apps to Pocket ID (OpenID
// Connect): one OIDC client per app in Pocket ID, made through its API
// with the static API key, and the app's sign-in settings in an env file
// of its own (data/sso/<app>.env) that its compose service reads when it
// exists. Apps configured only in their own pages get a client and the
// steps to paste it.
package sso

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// Provider is how the apps name Pocket ID on their sign-in pages.
const Provider = "Pocket ID"

// Client is one app's OIDC client in Pocket ID.
type Client struct {
	ID, Secret string
	Issuer     string // https://id.<domain>
	Address    string // the app's own https address, no trailing slash
}

// WellKnown is the issuer's discovery document.
func (c Client) WellKnown() string { return c.Issuer + "/.well-known/openid-configuration" }

// App is an app that can sign in with Pocket ID.
type App struct {
	ID        string
	Callbacks []string // paths on the app's address (or full URLs) Pocket ID may send people back to
	// Env is the app's sign-in settings, written to data/sso/<id>.env; nil
	// when the app is set up in its own pages (Steps says how).
	Env   func(c Client) map[string]string
	Steps string
}

// Apps are the apps homelab sso setup connects.
var Apps = []App{
	{
		ID:        "karakeep",
		Callbacks: []string{"/api/auth/callback/custom"},
		Env: func(c Client) map[string]string {
			return map[string]string{
				"OAUTH_WELLKNOWN_URL":                         c.WellKnown(),
				"OAUTH_CLIENT_ID":                             c.ID,
				"OAUTH_CLIENT_SECRET":                         c.Secret,
				"OAUTH_PROVIDER_NAME":                         Provider,
				"OAUTH_ALLOW_DANGEROUS_EMAIL_ACCOUNT_LINKING": "true",
			}
		},
	},
	{
		ID:        "open-webui",
		Callbacks: []string{"/oauth/oidc/callback", "/oauth/oidc/login/callback"},
		Env: func(c Client) map[string]string {
			return map[string]string{
				"ENABLE_OAUTH_SIGNUP":           "true",
				"OAUTH_MERGE_ACCOUNTS_BY_EMAIL": "true",
				"OAUTH_CLIENT_ID":               c.ID,
				"OAUTH_CLIENT_SECRET":           c.Secret,
				"OPENID_PROVIDER_URL":           c.WellKnown(),
				"OPENID_REDIRECT_URI":           c.Address + "/oauth/oidc/callback",
				"OAUTH_PROVIDER_NAME":           Provider,
			}
		},
	},
	{
		ID:        "paperless",
		Callbacks: []string{"/accounts/oidc/pocket-id/login/callback/"},
		Env: func(c Client) map[string]string {
			providers, _ := json.Marshal(map[string]any{"openid_connect": map[string]any{"APPS": []map[string]any{{
				"provider_id": "pocket-id", "name": Provider, "client_id": c.ID, "secret": c.Secret,
				"settings": map[string]string{"server_url": c.Issuer},
			}}}})
			return map[string]string{
				"PAPERLESS_APPS":                    "allauth.socialaccount.providers.openid_connect",
				"PAPERLESS_SOCIALACCOUNT_PROVIDERS": string(providers),
			}
		},
	},
	{
		ID:        "mealie",
		Callbacks: []string{"/login"},
		Env: func(c Client) map[string]string {
			return map[string]string{
				"OIDC_AUTH_ENABLED":      "true",
				"OIDC_SIGNUP_ENABLED":    "true",
				"OIDC_CONFIGURATION_URL": c.WellKnown(),
				"OIDC_CLIENT_ID":         c.ID,
				"OIDC_CLIENT_SECRET":     c.Secret,
				"OIDC_PROVIDER_NAME":     Provider,
			}
		},
	},
	{
		// Vikunja 1.0 and later build its providers from VIKUNJA_* variables;
		// the provider key (pocketid) is the last part of the callback.
		ID:        "vikunja",
		Callbacks: []string{"/auth/openid/pocketid"},
		Env: func(c Client) map[string]string {
			const p = "VIKUNJA_AUTH_OPENID_PROVIDERS_POCKETID_"
			return map[string]string{
				"VIKUNJA_AUTH_OPENID_ENABLED": "true",
				p + "NAME":                    Provider,
				p + "AUTHURL":                 c.Issuer,
				p + "CLIENTID":                c.ID,
				p + "CLIENTSECRET":            c.Secret,
				p + "EMAILFALLBACK":           "true",
			}
		},
	},
	{
		ID:        "immich-server",
		Callbacks: []string{"/auth/login", "/user-settings", "app.immich:///oauth-callback"},
		Steps:     "Immich › Administration › Settings › Authentication Settings › OAuth: turn it on; Issuer URL %s; Client ID and Client Secret from %s; Button text \"Sign in with Pocket ID\"; Save",
	},
}

// Get finds an app by id.
func Get(id string) (App, bool) {
	for _, a := range Apps {
		if a.ID == id {
			return a, true
		}
	}
	return App{}, false
}

// CallbackURLs are an app's callbacks at its address.
func (a App) CallbackURLs(address string) []string {
	var out []string
	for _, c := range a.Callbacks {
		if strings.Contains(c, "://") {
			out = append(out, c)
		} else {
			out = append(out, strings.TrimRight(address, "/")+c)
		}
	}
	return out
}

// EnvPath is where an app's sign-in settings are kept.
func EnvPath(root, app string) string { return filepath.Join(root, "data", "sso", app+".env") }

// WriteEnv writes settings as a Compose env file only this user can read.
func WriteEnv(path string, kv map[string]string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	keys := make([]string, 0, len(kv))
	for k := range kv {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var b strings.Builder
	b.WriteString("# Sign-in with Pocket ID, written by homelab sso setup. Remove this file\n# and recreate the app to sign in without it.\n")
	for _, k := range keys {
		if strings.ContainsAny(kv[k], "\n\r") {
			return fmt.Errorf("%s: a value spans lines", k)
		}
		fmt.Fprintf(&b, "%s=%s\n", k, kv[k])
	}
	return os.WriteFile(path, []byte(b.String()), 0o600)
}

// ReadEnv reads back an env file WriteEnv wrote.
func ReadEnv(path string) (map[string]string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	out := map[string]string{}
	for _, line := range strings.Split(string(data), "\n") {
		if k, v, ok := strings.Cut(line, "="); ok && !strings.HasPrefix(line, "#") {
			out[k] = v
		}
	}
	return out, nil
}

// PocketID is a client for Pocket ID's admin API, signed in with its
// static API key (STATIC_API_KEY).
type PocketID struct {
	BaseURL, Key string
	HTTP         *http.Client
}

// NewPocketID returns a client for the API at baseURL.
func NewPocketID(baseURL, key string) *PocketID {
	return &PocketID{BaseURL: strings.TrimRight(baseURL, "/"), Key: key, HTTP: &http.Client{Timeout: 20 * time.Second}}
}

// ErrNotFound is a 404 from the API.
var ErrNotFound = errors.New("not found")

func (p *PocketID) call(ctx context.Context, method, path string, body, out any) error {
	var rd io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		rd = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, p.BaseURL+"/api"+path, rd)
	if err != nil {
		return err
	}
	req.Header.Set("X-API-Key", p.Key)
	req.Header.Set("Content-Type", "application/json")
	resp, err := p.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	switch {
	case resp.StatusCode == http.StatusNotFound:
		return ErrNotFound
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
		return errors.New("Pocket ID refused POCKET_ID_API_KEY (it is its STATIC_API_KEY: restart Pocket ID after setting it)")
	case resp.StatusCode >= 300:
		return fmt.Errorf("Pocket ID %s %s: %d %s", method, path, resp.StatusCode, strings.TrimSpace(string(data)))
	}
	if out != nil && len(data) > 0 {
		return json.Unmarshal(data, out)
	}
	return nil
}

// HasClient reports whether Pocket ID has a client with this id.
func (p *PocketID) HasClient(ctx context.Context, id string) (bool, error) {
	err := p.call(ctx, http.MethodGet, "/oidc/clients/"+id, nil, nil)
	if errors.Is(err, ErrNotFound) {
		return false, nil
	}
	return err == nil, err
}

// CreateClient makes a confidential client with these callbacks and
// returns the secret Pocket ID made with it, if it did.
func (p *PocketID) CreateClient(ctx context.Context, id, name string, callbacks []string) (string, error) {
	var out struct {
		CreatedSecret *struct {
			Secret string `json:"secret"`
		} `json:"createdSecret"`
	}
	err := p.call(ctx, http.MethodPost, "/oidc/clients", map[string]any{
		"id": id, "name": name, "callbackURLs": callbacks, "isPublic": false, "pkceEnabled": false,
	}, &out)
	if err != nil || out.CreatedSecret == nil {
		return "", err
	}
	return out.CreatedSecret.Secret, nil
}

// NewSecret makes a new secret for a client (POST …/secrets, or …/secret
// on versions of Pocket ID with one secret per client).
func (p *PocketID) NewSecret(ctx context.Context, id string) (string, error) {
	var out struct {
		Secret string `json:"secret"`
	}
	err := p.call(ctx, http.MethodPost, "/oidc/clients/"+id+"/secrets", map[string]any{}, &out)
	if errors.Is(err, ErrNotFound) {
		err = p.call(ctx, http.MethodPost, "/oidc/clients/"+id+"/secret", nil, &out)
	}
	if err == nil && out.Secret == "" {
		err = errors.New("Pocket ID made no client secret")
	}
	return out.Secret, err
}

// User is a person in Pocket ID.
type User struct {
	ID          string  `json:"id,omitempty"`
	Username    string  `json:"username"`
	Email       *string `json:"email,omitempty"`
	FirstName   string  `json:"firstName"`
	LastName    string  `json:"lastName"`
	DisplayName string  `json:"displayName"`
	IsAdmin     bool    `json:"isAdmin"`
	Disabled    bool    `json:"disabled"`
	// The rest as Pocket ID sends it, so an update keeps it.
	Locale        *string `json:"locale,omitempty"`
	EmailVerified bool    `json:"emailVerified"`
}

// CreateUser adds a person and returns them with their id.
func (p *PocketID) CreateUser(ctx context.Context, u User) (User, error) {
	var out User
	err := p.call(ctx, http.MethodPost, "/users", u, &out)
	return out, err
}

// SetDisabled turns a person's sign-in off (their data stays in every
// app) or back on.
func (p *PocketID) SetDisabled(ctx context.Context, id string, disabled bool) error {
	var u User
	if err := p.call(ctx, http.MethodGet, "/users/"+id, nil, &u); err != nil {
		return err
	}
	u.Disabled = disabled
	return p.call(ctx, http.MethodPut, "/users/"+id, u, nil)
}

// SignInLink makes a one-time link that signs a person in to Pocket ID
// for the first time, so they can add their passkey (issuer/lc/<token>).
func (p *PocketID) SignInLink(ctx context.Context, issuer, id string, ttl time.Duration) (string, error) {
	var out struct {
		Token string `json:"token"`
	}
	if err := p.call(ctx, http.MethodPost, "/users/"+id+"/one-time-access-token", map[string]any{"ttl": int(ttl.Seconds())}, &out); err != nil {
		return "", err
	}
	if out.Token == "" {
		return "", errors.New("Pocket ID made no sign-in link")
	}
	return strings.TrimRight(issuer, "/") + "/lc/" + out.Token, nil
}
