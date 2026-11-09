package domain

// Lock 1 of the iPhone app away from home (docs/Decisions.md, ADR-0023):
// Cloudflare Access in front of the phone companion's own hostname, letting
// through only the household's service token, which the Homelab app sends
// itself. Made with the household's CLOUDFLARE_API_TOKEN, which needs Access:
// Apps and Policies and Access: Service Tokens (Edit) for it.

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
)

// AccessPermissions is what the Cloudflare token needs for this, said when
// Cloudflare refuses it.
const AccessPermissions = "Account › Access: Apps and Policies › Edit, and Account › Access: Service Tokens › Edit"

// AwayName names what the homelab makes in Cloudflare Access, so it finds
// them again.
const AwayName = "Homelab phone companion"

// AccessTeam is the account's Zero Trust team name: <team>.cloudflareaccess.com.
func (c *Cloudflare) AccessTeam(ctx context.Context, account string) (string, error) {
	var org struct {
		AuthDomain string `json:"auth_domain"`
	}
	if err := c.call(ctx, http.MethodGet, "/accounts/"+account+"/access/organizations", nil, &org); err != nil {
		return "", err
	}
	team, ok := strings.CutSuffix(strings.ToLower(org.AuthDomain), ".cloudflareaccess.com")
	if !ok || team == "" || strings.Contains(team, ".") {
		return "", errors.New("Cloudflare Zero Trust isn't set up for this account yet: open one.dash.cloudflare.com once and pick a team name, then try again")
	}
	return team, nil
}

// ServiceToken is an Access service token; Secret only when just made.
type ServiceToken struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	ClientID string `json:"client_id"`
	Secret   string `json:"client_secret,omitempty"`
}

// ServiceTokens lists the account's service tokens.
func (c *Cloudflare) ServiceTokens(ctx context.Context, account string) ([]ServiceToken, error) {
	var out []ServiceToken
	err := c.call(ctx, http.MethodGet, "/accounts/"+account+"/access/service_tokens", nil, &out)
	return out, err
}

// NewServiceToken makes a service token. Cloudflare shows its secret this
// once.
func (c *Cloudflare) NewServiceToken(ctx context.Context, account, name string) (ServiceToken, error) {
	var out ServiceToken
	err := c.call(ctx, http.MethodPost, "/accounts/"+account+"/access/service_tokens", map[string]any{"name": name, "duration": "forever"}, &out)
	if err == nil && (out.ID == "" || out.ClientID == "" || out.Secret == "") {
		err = errors.New("Cloudflare made the service token but gave no secret for it")
	}
	return out, err
}

// AccessApp is an Access application.
type AccessApp struct {
	ID     string `json:"id"`
	AUD    string `json:"aud"`
	Domain string `json:"domain"`
	Name   string `json:"name"`
}

// AccessApps lists the account's Access applications.
func (c *Cloudflare) AccessApps(ctx context.Context, account string) ([]AccessApp, error) {
	var out []AccessApp
	err := c.call(ctx, http.MethodGet, "/accounts/"+account+"/access/apps", nil, &out)
	return out, err
}

// NewAccessApp makes a self-hosted Access application for host.
func (c *Cloudflare) NewAccessApp(ctx context.Context, account, host string) (AccessApp, error) {
	var out AccessApp
	err := c.call(ctx, http.MethodPost, "/accounts/"+account+"/access/apps", map[string]any{
		"name": AwayName, "domain": host, "type": "self_hosted", "session_duration": "24h",
		"app_launcher_visible": false, "auto_redirect_to_identity": false,
	}, &out)
	if err == nil && (out.ID == "" || out.AUD == "") {
		err = errors.New("Cloudflare made the Access application but gave no AUD tag for it")
	}
	return out, err
}

// accessPolicy is an application's policy, as far as the homelab reads it.
type accessPolicy struct {
	ID       string           `json:"id"`
	Decision string           `json:"decision"`
	Include  []map[string]any `json:"include"`
}

// lets is whether p lets the service token in, and nothing else.
func (p accessPolicy) lets(tokenID string) bool {
	if p.Decision != "non_identity" || len(p.Include) != 1 {
		return false
	}
	st, _ := p.Include[0]["service_token"].(map[string]any)
	id, _ := st["token_id"].(string)
	return id == tokenID
}

// AllowOnly makes sure app's only way in is the service token: a policy
// letting it in (made if missing), and no other policy. It says what it did.
func (c *Cloudflare) AllowOnly(ctx context.Context, account, appID, tokenID string) (string, error) {
	path := "/accounts/" + account + "/access/apps/" + appID + "/policies"
	var policies []accessPolicy
	if err := c.call(ctx, http.MethodGet, path, nil, &policies); err != nil {
		return "", err
	}
	found := false
	for _, p := range policies {
		if p.lets(tokenID) && !found {
			found = true
			continue
		}
		// Anything else would let someone else in: the homelab's
		// application has one way in.
		if err := c.call(ctx, http.MethodDelete, path+"/"+p.ID, nil, nil); err != nil {
			return "", err
		}
	}
	if found {
		return "unchanged", nil
	}
	err := c.call(ctx, http.MethodPost, path, map[string]any{
		"name": "The household's phones", "decision": "non_identity", "precedence": 1,
		"include": []map[string]any{{"service_token": map[string]string{"token_id": tokenID}}},
	}, nil)
	return "created", err
}

// Away is the companion's Access, as .env keeps it.
type Away struct {
	Team, AUD, ClientID, Secret string
	// Made is what was made or changed in Cloudflare, to say.
	Made []string
}

// SetUpAway puts Cloudflare Access in front of host for the household's
// phones: the service token (kept when have's client ID is still one of the
// account's and its secret is kept; else a new one), the application, and
// its one policy. Run again, it changes nothing that is right.
func SetUpAway(ctx context.Context, c *Cloudflare, account, host string, have Away) (Away, error) {
	out := Away{}
	team, err := c.AccessTeam(ctx, account)
	if err != nil {
		return out, err
	}
	out.Team = team
	tokens, err := c.ServiceTokens(ctx, account)
	if err != nil {
		return out, err
	}
	var token ServiceToken
	for _, t := range tokens {
		if have.ClientID != "" && have.Secret != "" && t.ClientID == have.ClientID {
			token = t
			token.Secret = have.Secret
		}
	}
	if token.ID == "" {
		if token, err = c.NewServiceToken(ctx, account, AwayName); err != nil {
			return out, err
		}
		out.Made = append(out.Made, "a service token for the household's phones")
	}
	out.ClientID, out.Secret = token.ClientID, token.Secret
	apps, err := c.AccessApps(ctx, account)
	if err != nil {
		return out, err
	}
	var app AccessApp
	for _, a := range apps {
		if strings.EqualFold(a.Domain, host) {
			app = a
		}
	}
	if app.ID == "" {
		if app, err = c.NewAccessApp(ctx, account, host); err != nil {
			return out, err
		}
		out.Made = append(out.Made, "an Access application for "+host)
	}
	out.AUD = app.AUD
	action, err := c.AllowOnly(ctx, account, app.ID, token.ID)
	if err != nil {
		return out, err
	}
	if action != "unchanged" {
		out.Made = append(out.Made, "its policy: only the household's phones")
	}
	return out, nil
}

// AccessRefused says what to do when Cloudflare refused the token.
func AccessRefused(err error) error {
	if err != nil && (strings.Contains(err.Error(), "Authentication error") || strings.Contains(err.Error(), "403") || strings.Contains(strings.ToLower(err.Error()), "permission")) {
		return fmt.Errorf("Cloudflare refused CLOUDFLARE_API_TOKEN for Access: add %s to it in the Cloudflare dashboard (My Profile › API Tokens › Edit), then try again (%w)", AccessPermissions, err)
	}
	return err
}
