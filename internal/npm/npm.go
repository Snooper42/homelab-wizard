// Package npm is a small client for the Nginx Proxy Manager API (2.16+).
//
// NPM validates request bodies strictly (additionalProperties: false), so the
// types here send exactly the fields its schemas allow.
package npm

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ErrUnauthorized means the credentials were rejected.
var ErrUnauthorized = errors.New("Nginx Proxy Manager rejected the credentials")

// ErrTwoFactor means the account has 2FA, which the API cannot complete.
var ErrTwoFactor = errors.New("this Nginx Proxy Manager account has two-factor authentication; the CLI needs an account without it (NPM_API_EMAIL)")

// Client talks to one NPM instance.
type Client struct {
	BaseURL string // e.g. http://127.0.0.1:8181
	HTTP    *http.Client
	token   string
}

// New returns a client.
func New(baseURL string) *Client {
	return &Client{BaseURL: strings.TrimRight(baseURL, "/"), HTTP: &http.Client{Timeout: 30 * time.Second}}
}

func (c *Client) do(ctx context.Context, method, path string, body, out any) error {
	var rd io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}
		rd = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+"/api"+path, rd)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return ErrUnauthorized
	}
	if resp.StatusCode >= 300 {
		var e struct {
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		msg := strings.TrimSpace(string(data))
		if json.Unmarshal(data, &e) == nil && e.Error.Message != "" {
			msg = e.Error.Message
		}
		return fmt.Errorf("NPM %s %s: %d %s", method, path, resp.StatusCode, msg)
	}
	if out != nil && len(data) > 0 {
		return json.Unmarshal(data, out)
	}
	return nil
}

// Health checks that the API answers.
func (c *Client) Health(ctx context.Context) error {
	var st struct {
		Status string `json:"status"`
	}
	if err := c.do(ctx, http.MethodGet, "/", nil, &st); err != nil {
		return err
	}
	if !strings.EqualFold(st.Status, "OK") {
		return fmt.Errorf("NPM status %q", st.Status)
	}
	return nil
}

// WaitHealthy polls Health until it succeeds or the context ends.
func (c *Client) WaitHealthy(ctx context.Context, every time.Duration) error {
	for {
		if err := c.Health(ctx); err == nil {
			return nil
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("Nginx Proxy Manager did not become ready at %s", c.BaseURL)
		case <-time.After(every):
		}
	}
}

// Login exchanges credentials for a token.
func (c *Client) Login(ctx context.Context, email, password string) error {
	var res struct {
		Token        string `json:"token"`
		RequiresTwoF bool   `json:"requires_2fa"`
	}
	if err := c.do(ctx, http.MethodPost, "/tokens", map[string]string{"identity": email, "secret": password}, &res); err != nil {
		return err
	}
	if res.RequiresTwoF {
		return ErrTwoFactor
	}
	if res.Token == "" {
		return ErrUnauthorized
	}
	c.token = res.Token
	return nil
}

// ProxyHost is the writable part of an NPM proxy host.
type ProxyHost struct {
	ID                    int            `json:"id,omitempty"`
	DomainNames           []string       `json:"domain_names"`
	ForwardScheme         string         `json:"forward_scheme"`
	ForwardHost           string         `json:"forward_host"`
	ForwardPort           int            `json:"forward_port"`
	CertificateID         int            `json:"certificate_id"`
	SSLForced             bool           `json:"ssl_forced"`
	HTTP2Support          bool           `json:"http2_support"`
	HSTSEnabled           bool           `json:"hsts_enabled"`
	HSTSSubdomains        bool           `json:"hsts_subdomains"`
	TrustForwardedProto   bool           `json:"trust_forwarded_proto"`
	BlockExploits         bool           `json:"block_exploits"`
	CachingEnabled        bool           `json:"caching_enabled"`
	AllowWebsocketUpgrade bool           `json:"allow_websocket_upgrade"`
	AccessListID          int            `json:"access_list_id"`
	AdvancedConfig        string         `json:"advanced_config"`
	Meta                  map[string]any `json:"meta"`
	Locations             []any          `json:"locations"`
}

// Same reports whether two hosts route identically (ignores id/locations/meta).
func (p ProxyHost) Same(o ProxyHost) bool {
	return strings.Join(p.DomainNames, ",") == strings.Join(o.DomainNames, ",") &&
		p.ForwardScheme == o.ForwardScheme && p.ForwardHost == o.ForwardHost && p.ForwardPort == o.ForwardPort &&
		p.CertificateID == o.CertificateID && p.SSLForced == o.SSLForced && p.HTTP2Support == o.HTTP2Support &&
		p.TrustForwardedProto == o.TrustForwardedProto &&
		p.BlockExploits == o.BlockExploits && p.AllowWebsocketUpgrade == o.AllowWebsocketUpgrade
}

// ProxyHosts lists proxy hosts.
func (c *Client) ProxyHosts(ctx context.Context) ([]ProxyHost, error) {
	var out []ProxyHost
	return out, c.do(ctx, http.MethodGet, "/nginx/proxy-hosts", nil, &out)
}

func writable(p ProxyHost) ProxyHost {
	p.ID = 0
	if p.Locations == nil {
		p.Locations = []any{}
	}
	if p.Meta == nil {
		p.Meta = map[string]any{}
	}
	return p
}

// CreateProxyHost creates a proxy host and returns its id.
func (c *Client) CreateProxyHost(ctx context.Context, p ProxyHost) (int, error) {
	var out ProxyHost
	err := c.do(ctx, http.MethodPost, "/nginx/proxy-hosts", writable(p), &out)
	return out.ID, err
}

// UpdateProxyHost replaces a proxy host's settings.
func (c *Client) UpdateProxyHost(ctx context.Context, id int, p ProxyHost) error {
	return c.do(ctx, http.MethodPut, fmt.Sprintf("/nginx/proxy-hosts/%d", id), writable(p), nil)
}

// Certificate is an NPM certificate.
type Certificate struct {
	ID          int      `json:"id"`
	Provider    string   `json:"provider"`
	NiceName    string   `json:"nice_name"`
	DomainNames []string `json:"domain_names"`
	ExpiresOn   string   `json:"expires_on"`
}

// Certificates lists certificates.
func (c *Client) Certificates(ctx context.Context) ([]Certificate, error) {
	var out []Certificate
	return out, c.do(ctx, http.MethodGet, "/nginx/certificates", nil, &out)
}

// CloudflareCertificate requests a Let's Encrypt certificate for domains
// using the Cloudflare DNS challenge. Let's Encrypt registers with the
// signed-in account's email. NPM answers once issuance finishes, which can
// take a few minutes.
func (c *Client) CloudflareCertificate(ctx context.Context, domains []string, cfToken string) (Certificate, error) {
	body := map[string]any{
		"provider":     "letsencrypt",
		"domain_names": domains,
		"meta": map[string]any{
			"dns_challenge":            true,
			"dns_provider":             "cloudflare",
			"dns_provider_credentials": "# Cloudflare API token\ndns_cloudflare_api_token = " + cfToken,
		},
	}
	slow := *c
	slow.HTTP = &http.Client{Timeout: 6 * time.Minute}
	var out Certificate
	err := slow.do(ctx, http.MethodPost, "/nginx/certificates", body, &out)
	return out, err
}
