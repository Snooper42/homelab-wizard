// Package domain puts apps behind a custom domain: Nginx Proxy Manager proxy
// hosts, an optional wildcard certificate, LAN DNS (AdGuard Home or
// /etc/hosts), and public hostnames through a Cloudflare Tunnel.
package domain

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"regexp"
	"runtime"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/npm"
)

var validDomain = regexp.MustCompile(`^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$`)

// Normalize lowercases and validates a domain like "Example.com".
func Normalize(d string) (string, error) {
	d = strings.TrimSuffix(strings.ToLower(strings.TrimSpace(d)), ".")
	d = strings.TrimPrefix(strings.TrimPrefix(d, "https://"), "http://")
	if !validDomain.MatchString(d) {
		return "", fmt.Errorf("%q is not a valid domain name", d)
	}
	return d, nil
}

// Route sends one hostname to one app.
type Route struct {
	App         *catalog.App
	Host        string
	ForwardHost string
	ForwardPort int
}

// Routes builds a route for every app with a web UI.
func Routes(apps []*catalog.App, domainName string, lookup compose.Lookup) []Route {
	var out []Route
	for _, a := range apps {
		if a.Internal() || a.Local() || !a.HasWeb() {
			continue
		}
		port := a.WebContainerPort(lookup)
		if port == 0 {
			continue
		}
		out = append(out, Route{App: a, Host: a.Subdomain() + "." + domainName, ForwardHost: a.ProxyTarget(), ForwardPort: port})
	}
	return out
}

// Result is the outcome of syncing one route.
type Result struct {
	Route  Route
	Action string // created, updated, unchanged
}

// Settings shared by every proxy host.
type Settings struct {
	CertificateID int
	ForceSSL      bool
}

// ProxyHostFor renders the NPM proxy host for a route. Forwarded-proto is
// trusted so requests the Cloudflare Tunnel delivers over plain HTTP (with
// X-Forwarded-Proto: https) are not redirected in a loop.
func ProxyHostFor(r Route, s Settings) npm.ProxyHost {
	return npm.ProxyHost{
		DomainNames:           []string{r.Host},
		ForwardScheme:         "http",
		ForwardHost:           r.ForwardHost,
		ForwardPort:           r.ForwardPort,
		CertificateID:         s.CertificateID,
		SSLForced:             s.ForceSSL && s.CertificateID > 0,
		HTTP2Support:          s.CertificateID > 0,
		TrustForwardedProto:   true,
		BlockExploits:         true,
		AllowWebsocketUpgrade: true,
	}
}

// Sync creates or updates one proxy host per route. Hosts are matched by
// domain name, so re-running is safe and only changes what differs. Without
// a certificate in s, an existing host keeps its own.
func Sync(ctx context.Context, c *npm.Client, routes []Route, s Settings) ([]Result, error) {
	existing, err := c.ProxyHosts(ctx)
	if err != nil {
		return nil, err
	}
	byHost := map[string]npm.ProxyHost{}
	for _, h := range existing {
		for _, d := range h.DomainNames {
			byHost[strings.ToLower(d)] = h
		}
	}
	var results []Result
	for _, r := range routes {
		want := ProxyHostFor(r, s)
		cur, ok := byHost[r.Host]
		if ok && s.CertificateID == 0 && cur.CertificateID > 0 {
			want.CertificateID, want.SSLForced, want.HTTP2Support = cur.CertificateID, cur.SSLForced, cur.HTTP2Support
		}
		switch {
		case !ok:
			if _, err := c.CreateProxyHost(ctx, want); err != nil {
				return results, fmt.Errorf("%s: %w", r.Host, err)
			}
			results = append(results, Result{r, "created"})
		case cur.Same(want):
			results = append(results, Result{r, "unchanged"})
		default:
			// Keep extra domain names and custom settings someone added by hand.
			want.DomainNames = mergeNames(cur.DomainNames, want.DomainNames)
			want.AdvancedConfig, want.AccessListID, want.Locations = cur.AdvancedConfig, cur.AccessListID, cur.Locations
			want.HSTSEnabled, want.HSTSSubdomains, want.CachingEnabled = cur.HSTSEnabled, cur.HSTSSubdomains, cur.CachingEnabled
			if cur.Same(want) {
				results = append(results, Result{r, "unchanged"})
				continue
			}
			if err := c.UpdateProxyHost(ctx, cur.ID, want); err != nil {
				return results, fmt.Errorf("%s: %w", r.Host, err)
			}
			results = append(results, Result{r, "updated"})
		}
	}
	return results, nil
}

// Withdraw removes the proxy hosts of apps kept to this computer (local),
// which an earlier setup made, and returns their names. A host that also
// carries a name someone added by hand stays.
func Withdraw(ctx context.Context, c *npm.Client, apps []*catalog.App, domainName string) ([]string, error) {
	local := map[string]bool{}
	for _, a := range apps {
		if a.Local() && a.HasWeb() {
			local[a.Subdomain()+"."+domainName] = true
		}
	}
	if len(local) == 0 {
		return nil, nil
	}
	existing, err := c.ProxyHosts(ctx)
	if err != nil {
		return nil, err
	}
	var removed []string
	for _, h := range existing {
		if len(h.DomainNames) != 1 || !local[strings.ToLower(h.DomainNames[0])] {
			continue
		}
		if err := c.DeleteProxyHost(ctx, h.ID); err != nil {
			return removed, fmt.Errorf("%s: %w", h.DomainNames[0], err)
		}
		removed = append(removed, h.DomainNames[0])
	}
	return removed, nil
}

func mergeNames(a, b []string) []string {
	out := append([]string(nil), a...)
	for _, n := range b {
		found := false
		for _, x := range out {
			if strings.EqualFold(x, n) {
				found = true
			}
		}
		if !found {
			out = append(out, n)
		}
	}
	return out
}

// FindWildcard returns the certificate covering *.domain, if NPM has one.
func FindWildcard(ctx context.Context, c *npm.Client, domainName string) (npm.Certificate, bool, error) {
	certs, err := c.Certificates(ctx)
	if err != nil {
		return npm.Certificate{}, false, err
	}
	for _, cert := range certs {
		for _, d := range cert.DomainNames {
			if strings.EqualFold(d, "*."+domainName) {
				return cert, true, nil
			}
		}
	}
	return npm.Certificate{}, false, nil
}

// WildcardCertificate returns an existing certificate covering *.domain or
// requests one through the Cloudflare DNS challenge.
func WildcardCertificate(ctx context.Context, c *npm.Client, domainName, cfToken string) (npm.Certificate, bool, error) {
	if cert, found, err := FindWildcard(ctx, c, domainName); err != nil || found {
		return cert, false, err
	}
	wild := "*." + domainName
	if cfToken == "" {
		return npm.Certificate{}, false, fmt.Errorf("a Let's Encrypt certificate needs a Cloudflare API token (CLOUDFLARE_API_TOKEN with Zone.DNS:Edit)")
	}
	cert, err := c.CloudflareCertificate(ctx, []string{wild, domainName}, cfToken)
	return cert, true, err
}

// LANAddress returns this machine's address on the home network: the
// address the system routes through when that is a Wi-Fi or Ethernet
// interface, otherwise the first such interface, so a VPN's tunnel or a
// container bridge is never chosen. No packets are sent.
func LANAddress() (string, error) {
	cands, dialed := interfaceAddrs()
	if ip := pickLAN(cands, dialed); ip != "" {
		return ip, nil
	}
	return "", errors.New("no Wi-Fi or Ethernet address on a home network was found")
}

// LANNetwork is the home network LANAddress is on, as a Tailscale subnet
// route: 10.0.0.0/24 for 10.0.0.195.
func LANNetwork() (string, error) {
	cands, dialed := interfaceAddrs()
	ip := pickLAN(cands, dialed)
	for _, c := range cands {
		if ip != "" && c.IP.String() == ip {
			return network(c), nil
		}
	}
	return "", errors.New("no Wi-Fi or Ethernet address on a home network was found")
}

// network is the candidate's network; a /24 where its mask is unknown or
// unlikely for a home (wider than /16, narrower than /30).
func network(c LANCandidate) string {
	ones, bits := c.Mask.Size()
	if bits != 32 || ones < 16 || ones > 30 {
		ones = 24
	}
	mask := net.CIDRMask(ones, 32)
	return (&net.IPNet{IP: c.IP.Mask(mask), Mask: mask}).String()
}

// HostIdentity is envfile.HostIdentity with the home network (Tailscale's
// subnet route) and where AdGuard Home's DNS listens: this machine's
// address when systemd-resolved's stub holds 127.0.0.53:53, or on Windows
// when something holds port 53 already (Internet Connection Sharing, which
// Docker Desktop and WSL use), both of which a 0.0.0.0 bind collides with.
func HostIdentity() envfile.Identity {
	id := envfile.HostIdentity()
	if ResolvedStub() || runtime.GOOS == "windows" && DNSPortTaken() {
		if ip, err := LANAddress(); err == nil {
			id.DNSBind = ip
		}
	}
	if n, err := LANNetwork(); err == nil {
		id.Routes = n
	}
	// With Docker run as you, host-gateway is Docker's own namespace, not
	// this machine; its address reaches the native apps instead.
	if id.Rootless {
		if ip, err := LANAddress(); err == nil {
			id.HostGateway = ip
		}
	}
	return id
}

// ResolvedStub reports whether systemd-resolved's stub listener holds
// 127.0.0.53:53 (Ubuntu, Fedora, and others by default). Tests replace it.
var ResolvedStub = func() bool {
	data, err := os.ReadFile("/proc/net/udp")
	return err == nil && strings.Contains(string(data), " 3500007F:0035 ")
}

// DNSPortTaken reports whether UDP port 53 cannot be bound on every
// address. Tests replace it.
var DNSPortTaken = func() bool {
	c, err := net.ListenPacket("udp4", "0.0.0.0:53")
	if err != nil {
		return true
	}
	c.Close()
	return false
}

// DefaultVPN names the tunnel interface that carries this machine's
// traffic, when a VPN routes everything.
func DefaultVPN() (string, bool) {
	cands, dialed := interfaceAddrs()
	for _, c := range cands {
		if c.IP.Equal(dialed) && isTunnel(c) {
			return c.Name, true
		}
	}
	return "", false
}

// LANCandidate is one IPv4 address of a network interface.
type LANCandidate struct {
	IP    net.IP
	Mask  net.IPMask
	Flags net.Flags
	Name  string
}

func interfaceAddrs() ([]LANCandidate, net.IP) {
	var dialed net.IP
	if conn, err := net.Dial("udp", "192.0.2.1:9"); err == nil {
		dialed = conn.LocalAddr().(*net.UDPAddr).IP
		conn.Close()
	}
	var out []LANCandidate
	ifaces, _ := net.Interfaces()
	for _, ifc := range ifaces {
		addrs, _ := ifc.Addrs()
		for _, a := range addrs {
			if ipn, ok := a.(*net.IPNet); ok && ipn.IP.To4() != nil {
				out = append(out, LANCandidate{IP: ipn.IP.To4(), Mask: ipn.Mask, Flags: ifc.Flags, Name: ifc.Name})
			}
		}
	}
	return out, dialed
}

var virtualPrefixes = []string{"utun", "tun", "tap", "wg", "ppp", "ipsec", "docker", "br-", "veth", "bridge", "virbr", "vmnet", "vboxnet", "lo"}

func isTunnel(c LANCandidate) bool {
	if c.Flags&net.FlagPointToPoint != 0 {
		return true
	}
	for _, p := range []string{"utun", "tun", "wg", "ppp", "ipsec"} {
		if strings.HasPrefix(c.Name, p) {
			return true
		}
	}
	return false
}

// pickLAN chooses the home-network address among cands (see LANAddress).
func pickLAN(cands []LANCandidate, dialed net.IP) string {
	lan := func(c LANCandidate) bool {
		if c.Flags&net.FlagUp == 0 || c.Flags&net.FlagLoopback != 0 || c.Flags&net.FlagBroadcast == 0 || isTunnel(c) || !c.IP.IsPrivate() {
			return false
		}
		for _, p := range virtualPrefixes {
			if strings.HasPrefix(c.Name, p) {
				return false
			}
		}
		return true
	}
	for _, c := range cands {
		if lan(c) && c.IP.Equal(dialed) {
			return c.IP.String()
		}
	}
	for _, c := range cands {
		if lan(c) {
			return c.IP.String()
		}
	}
	return ""
}
