package domain

import (
	"context"
	"encoding/json"
	"net"
	"os"
	"path/filepath"
)

// Home is the address the apps' names lead to at home, as domain setup
// last wrote it: AdGuard's *.domain rewrite and, with a Cloudflare token,
// the DNS-only *.domain record (UpsertHome). The watchdog moves both when
// the router gives this machine another address on the same network.
type Home struct {
	Address string `json:"address"`
	Network string `json:"network"` // e.g. 192.168.1.0/24
	// AdGuard and Cloudflare are what domain setup pointed at Address:
	// AdGuard's rewrite, and the *.domain record in Cloudflare.
	AdGuard    bool `json:"adguard,omitempty"`
	Cloudflare bool `json:"cloudflare,omitempty"`
}

// HomePath is where Home is kept in the homelab folder.
func HomePath(root string) string { return filepath.Join(root, "data", "home-address.json") }

// LoadHome reads Home; nothing yet is a zero Home.
func LoadHome(path string) Home {
	var h Home
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &h)
	}
	return h
}

// Save writes Home.
func (h Home) Save(path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(h, "", "  ")
	return os.WriteFile(path, append(data, '\n'), 0o644)
}

// Follows reports whether the names should move to ip: this machine has a
// new address on the network they were written for. An address on
// another network is this machine away from home (a laptop at a café),
// or a new router, which Set up the domain takes care of; either way the
// names stay where they are.
func (h Home) Follows(ip string) bool {
	if h.Address == "" || ip == "" || ip == h.Address {
		return false
	}
	_, n, err := net.ParseCIDR(h.Network)
	return err == nil && n.Contains(net.ParseIP(ip))
}

// HomeRecord points *.dom in Cloudflare at ip (UpsertHome), finding the
// zone first.
func HomeRecord(ctx context.Context, cf *Cloudflare, dom, ip string) (string, error) {
	zoneID, err := cf.ZoneID(ctx, dom)
	if err != nil {
		return "", err
	}
	return cf.UpsertHome(ctx, zoneID, "*."+dom, ip)
}

// NetworkOf is the home network ip is on (192.168.1.0/24 for
// 192.168.1.23): its interface's, or a /24 where no interface has it.
func NetworkOf(ip string) string {
	cands, _ := interfaceAddrs()
	for _, c := range cands {
		if c.IP.String() == ip {
			return network(c)
		}
	}
	if p := net.ParseIP(ip).To4(); p != nil {
		return network(LANCandidate{IP: p})
	}
	return ""
}
