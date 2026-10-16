// Package tailnet is Home mode: without a domain, every app gets a private
// https address on your Tailscale network, https://homelab.<tailnet>.ts.net
// :<port>, with a certificate Tailscale provides. The Tailscale container
// serves them (Tailscale Serve) from a config file the CLI writes, so no
// domain, Cloudflare account, router change, or open port is needed.
package tailnet

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/ports"
)

// App is the Tailscale service.
const App = "tailscale"

// ConfigFile is the serve config, inside Tailscale's data folder (mounted
// at /var/lib/tailscale, where TS_SERVE_CONFIG points).
const ConfigFile = "data/appdata/tailscale/serve.json"

// Route is one app on the tailnet: its port there and where it answers.
type Route struct {
	App    *catalog.App
	Port   int    // the app's port on this machine, reused on the tailnet
	Target string // http://<service>:<container port>
}

// Routes are the apps with a web page, each on the port it has on this
// machine. Apps without a fixed port are left out.
func Routes(apps []*catalog.App, lookup compose.Lookup) []Route {
	var out []Route
	seen := map[int]bool{}
	for _, a := range apps {
		if !a.HasWeb() || a.Internal() {
			continue
		}
		port, target := 0, ""
		if n := a.Native(); n != nil {
			port, target = n.Port, fmt.Sprintf("http://host.docker.internal:%d", n.Port)
		} else {
			for _, b := range ports.AppBindings(a, lookup) {
				if b.Container == a.WebContainerPort(lookup) {
					port = b.HostPort
				}
			}
			target = fmt.Sprintf("http://%s:%d", a.ProxyTarget(), a.WebContainerPort(lookup))
		}
		if port <= 0 || seen[port] {
			continue
		}
		seen[port] = true
		out = append(out, Route{App: a, Port: port, Target: target})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Port < out[j].Port })
	return out
}

// ServeConfig is Tailscale Serve's configuration for the routes: HTTPS on
// each port, proxied to the app. ${TS_CERT_DOMAIN} is filled in by the
// container with the machine's tailnet name.
func ServeConfig(routes []Route) []byte {
	type handler struct {
		Proxy string `json:"Proxy"`
	}
	type web struct {
		Handlers map[string]handler `json:"Handlers"`
	}
	type tcp struct {
		HTTPS bool `json:"HTTPS"`
	}
	cfg := struct {
		TCP map[string]tcp `json:"TCP"`
		Web map[string]web `json:"Web"`
	}{TCP: map[string]tcp{}, Web: map[string]web{}}
	for _, r := range routes {
		p := strconv.Itoa(r.Port)
		cfg.TCP[p] = tcp{HTTPS: true}
		cfg.Web["${TS_CERT_DOMAIN}:"+p] = web{Handlers: map[string]handler{"/": {Proxy: r.Target}}}
	}
	data, _ := json.MarshalIndent(cfg, "", "  ")
	return append(data, '\n')
}

// Self is this machine on the tailnet, from `tailscale status --json`.
type Self struct {
	Running bool
	State   string // Running, NeedsLogin, ...
	Host    string // homelab.tail1234.ts.net
	IP      string // its IPv4 address on the tailnet, 100.x.y.z
	// HTTPS is whether the tailnet hands out certificates (DNS page of
	// the admin console: MagicDNS and HTTPS Certificates on).
	HTTPS bool
	// AuthURL is where to sign in while it waits for a login (no auth key).
	AuthURL string
}

// LoginLink finds the sign-in link Tailscale logs while it waits for a
// login, for when its status does not carry one yet.
var LoginLink = regexp.MustCompile(`https://login\.tailscale\.com/a/[A-Za-z0-9]+`)

// ParseStatus reads `tailscale status --json`.
func ParseStatus(data []byte) (Self, error) {
	var st struct {
		BackendState string
		AuthURL      string
		CertDomains  []string
		Self         struct {
			DNSName      string
			TailscaleIPs []string
		}
	}
	if err := json.Unmarshal(data, &st); err != nil {
		return Self{}, fmt.Errorf("Tailscale's status could not be read: %w", err)
	}
	s := Self{Running: st.BackendState == "Running", State: st.BackendState, Host: strings.TrimSuffix(st.Self.DNSName, "."), HTTPS: len(st.CertDomains) > 0, AuthURL: st.AuthURL}
	for _, ip := range st.Self.TailscaleIPs {
		if !strings.Contains(ip, ":") {
			s.IP = ip
			break
		}
	}
	return s, nil
}

// DNSApp forwards DNS on this machine's tailnet address to AdGuard Home,
// so the tailnet's DNS setting can point every device at it.
const DNSApp = "tailnet-dns"

// DNSAdmin is where the tailnet's nameservers are set.
const DNSAdmin = "https://login.tailscale.com/admin/dns"

// Address is an app's address on the tailnet, without the scheme.
func Address(host string, port int) string { return host + ":" + strconv.Itoa(port) }
