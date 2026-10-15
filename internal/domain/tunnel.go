package domain

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
)

// Tunnel identifies a remotely managed Cloudflare Tunnel.
type Tunnel struct {
	AccountID string
	ID        string
}

// ParseTunnelToken reads the account and tunnel ids from a cloudflared token
// (base64 JSON {"a": account, "t": tunnel, "s": secret}).
func ParseTunnelToken(token string) (Tunnel, error) {
	token = strings.TrimSpace(token)
	var data []byte
	var err error
	for _, enc := range []*base64.Encoding{base64.StdEncoding, base64.RawStdEncoding, base64.URLEncoding, base64.RawURLEncoding} {
		if data, err = enc.DecodeString(token); err == nil {
			break
		}
	}
	if err != nil {
		return Tunnel{}, fmt.Errorf("TUNNEL_TOKEN is not a cloudflared tunnel token")
	}
	var t struct {
		A string `json:"a"`
		T string `json:"t"`
	}
	if err := json.Unmarshal(data, &t); err != nil || t.A == "" || t.T == "" {
		return Tunnel{}, fmt.Errorf("TUNNEL_TOKEN is not a cloudflared tunnel token")
	}
	return Tunnel{AccountID: t.A, ID: t.T}, nil
}

// Target is the DNS name public hostnames point at.
func (t Tunnel) Target() string { return t.ID + ".cfargotunnel.com" }

// MergeIngress puts each host in front of service, keeps rules someone added
// by hand (and their extra settings), and ends with a catch-all. It returns
// the new rules and whether anything changed.
func MergeIngress(existing []map[string]any, hosts []string, service string) ([]map[string]any, bool) {
	ours := map[string]bool{}
	for _, h := range hosts {
		ours[strings.ToLower(h)] = true
	}
	byHost := map[string]map[string]any{}
	var others []map[string]any
	var catchAll map[string]any
	for _, r := range existing {
		h, _ := r["hostname"].(string)
		switch {
		case h == "":
			catchAll = r
		case ours[strings.ToLower(h)]:
			byHost[strings.ToLower(h)] = r
		default:
			others = append(others, r)
		}
	}
	sorted := append([]string(nil), hosts...)
	sort.Strings(sorted)
	var out []map[string]any
	for _, h := range sorted {
		rule := map[string]any{}
		for k, v := range byHost[strings.ToLower(h)] {
			rule[k] = v
		}
		rule["hostname"] = h
		rule["service"] = service
		out = append(out, rule)
	}
	out = append(out, others...)
	if catchAll == nil {
		catchAll = map[string]any{"service": "http_status:404"}
	}
	out = append(out, catchAll)
	a, _ := json.Marshal(existing)
	b, _ := json.Marshal(out)
	return out, string(a) != string(b)
}

// TunnelIngress reads the tunnel's configuration. The full config is
// returned so a later update keeps settings other than ingress.
func (c *Cloudflare) TunnelIngress(ctx context.Context, t Tunnel) (map[string]json.RawMessage, []map[string]any, error) {
	var res struct {
		Config map[string]json.RawMessage `json:"config"`
	}
	path := fmt.Sprintf("/accounts/%s/cfd_tunnel/%s/configurations", t.AccountID, t.ID)
	if err := c.call(ctx, http.MethodGet, path, nil, &res); err != nil {
		return nil, nil, err
	}
	if res.Config == nil {
		res.Config = map[string]json.RawMessage{}
	}
	var rules []map[string]any
	if raw, ok := res.Config["ingress"]; ok {
		if err := json.Unmarshal(raw, &rules); err != nil {
			return nil, nil, fmt.Errorf("tunnel ingress: %w", err)
		}
	}
	return res.Config, rules, nil
}

// SetTunnelIngress replaces the ingress rules, keeping the rest of config.
func (c *Cloudflare) SetTunnelIngress(ctx context.Context, t Tunnel, config map[string]json.RawMessage, rules []map[string]any) error {
	raw, err := json.Marshal(rules)
	if err != nil {
		return err
	}
	next := map[string]json.RawMessage{}
	for k, v := range config {
		next[k] = v
	}
	next["ingress"] = raw
	path := fmt.Sprintf("/accounts/%s/cfd_tunnel/%s/configurations", t.AccountID, t.ID)
	return c.call(ctx, http.MethodPut, path, map[string]any{"config": next}, nil)
}

// Publication is what Publish did.
type Publication struct {
	IngressChanged bool
	DNS            map[string]string // hostname -> created/updated/unchanged
}

// Publish routes hosts through the tunnel to service and points their DNS
// records at the tunnel.
func Publish(ctx context.Context, cf *Cloudflare, t Tunnel, zone string, hosts []string, service string) (Publication, error) {
	pub := Publication{DNS: map[string]string{}}
	config, rules, err := cf.TunnelIngress(ctx, t)
	if err != nil {
		return pub, err
	}
	next, changed := MergeIngress(rules, hosts, service)
	if changed {
		if err := cf.SetTunnelIngress(ctx, t, config, next); err != nil {
			return pub, err
		}
	}
	pub.IngressChanged = changed
	zoneID, err := cf.ZoneID(ctx, zone)
	if err != nil {
		return pub, err
	}
	for _, h := range hosts {
		action, err := cf.UpsertCNAME(ctx, zoneID, h, t.Target())
		if err != nil {
			return pub, err
		}
		pub.DNS[h] = action
	}
	return pub, nil
}
