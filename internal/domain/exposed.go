package domain

import (
	"context"
	"errors"
	"net"
	"net/netip"
	"time"
)

// Lookup resolves a name to its addresses, as one resolver sees it.
type Lookup func(ctx context.Context, host string) ([]string, error)

// PublicLookup asks Cloudflare's public resolver (1.1.1.1), so the name is
// seen as the internet sees it: not through AdGuard Home's rewrite, the
// hosts file, or this machine's own resolver file, which all give the home
// address.
func PublicLookup(ctx context.Context, host string) ([]string, error) {
	r := &net.Resolver{PreferGo: true, Dial: func(ctx context.Context, network, _ string) (net.Conn, error) {
		return (&net.Dialer{Timeout: 5 * time.Second}).DialContext(ctx, network, "1.1.1.1:53")
	}}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	return r.LookupHost(ctx, host)
}

// Reachable is the public addresses the internet's DNS gives host: those
// that lead somewhere from outside the home (through Cloudflare's tunnel,
// say). None when the name gives only home addresses (Set up the domain's
// home record, *.example.com → 10.0.0.16, leads nowhere outside) or no
// answer at all.
//
// This is how a home-only app is checked to be home only without asking
// Cloudflare, which needs its API token: on Nov 28, 2026, Vaultwarden and
// Paperless-ngx were found still reachable from the internet through
// tunnel hostnames made before they were kept home only, while every
// screen said "home only". A name that does not exist is not reachable;
// any other failure (no network now) is an error, not a verdict.
func Reachable(ctx context.Context, lookup Lookup, host string) ([]string, error) {
	addrs, err := lookup(ctx, host)
	var dnsErr *net.DNSError
	if errors.As(err, &dnsErr) && dnsErr.IsNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var public []string
	for _, a := range addrs {
		if !homeAddress(a) {
			public = append(public, a)
		}
	}
	return public, nil
}

// cgnat is 100.64.0.0/10: Tailscale's addresses, reachable only on the tailnet.
var cgnat = netip.MustParsePrefix("100.64.0.0/10")

// homeAddress reports whether an address leads nowhere from the internet:
// private, loopback, link-local, Tailscale's, or unspecified. Anything
// unreadable counts as public, so a strange answer is looked at.
func homeAddress(a string) bool {
	ip, err := netip.ParseAddr(a)
	if err != nil {
		return false
	}
	ip = ip.Unmap()
	return ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsUnspecified() || cgnat.Contains(ip)
}
