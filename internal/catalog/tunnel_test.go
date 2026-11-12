package catalog

import (
	"fmt"
	"net/netip"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"gopkg.in/yaml.v3"
)

// N21: the proxy takes a visitor's address from CF-Connecting-IP only when
// the request comes from cloudflared's fixed address on the tunnel's own
// network. So cloudflared is on that network alone (everything it sends
// leaves from that address, whatever name its ingress uses), at the
// address the proxy trusts, which Docker never hands to anything else; and
// the proxy is on the network to be reached.
func TestOnlyTheTunnelNamesAVisitorsAddress(t *testing.T) {
	c := load(t)
	tunnel, ok := c.Get("cloudflared")
	if !ok {
		t.Fatal("no cloudflared in the catalog")
	}
	if len(tunnel.Networks) != 1 || !joins(tunnel, docker.TunnelNetwork) {
		t.Errorf("cloudflared joins %v: it must be on %s alone, or its requests can leave from another address", tunnel.Networks, docker.TunnelNetwork)
	}
	text, err := os.ReadFile(tunnel.File.Path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(text), "ipv4_address: "+docker.TunnelAddress+"\n") {
		t.Errorf("%s does not put cloudflared at %s", tunnel.File.Path, docker.TunnelAddress)
	}
	npm, ok := c.Get("nginx-proxy-manager")
	if !ok || !joins(npm, docker.TunnelNetwork) || !joins(npm, "homelab") {
		t.Errorf("the proxy must be on %s, for the tunnel, and on homelab, for the apps", docker.TunnelNetwork)
	}
	for _, a := range c.Apps {
		if a.ID != tunnel.ID && a.ID != npm.ID && joins(a, docker.TunnelNetwork) {
			t.Errorf("%s is on the tunnel's network: only cloudflared and the proxy are", a.ID)
		}
	}

	subnet := netip.MustParsePrefix(docker.TunnelSubnet)
	dynamic := netip.MustParsePrefix(docker.TunnelRange)
	addr := netip.MustParseAddr(docker.TunnelAddress)
	if !subnet.Contains(addr) || dynamic.Contains(addr) || addr == subnet.Addr().Next() {
		t.Errorf("%s must be in %s, outside the range Docker hands out (%s), and not the gateway", addr, subnet, dynamic)
	}
	if !subnet.Contains(dynamic.Addr()) || dynamic.Bits() < subnet.Bits() {
		t.Errorf("Docker's range %s is not inside %s", dynamic, subnet)
	}

	init, err := os.ReadFile(filepath.Join(repoRoot(), "dockerfiles", "npm-crowdsec", "homelab-init.sh"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(init), "\nset_real_ip_from "+docker.TunnelAddress+";\n") {
		t.Errorf("the proxy's server_proxy.conf does not trust %s alone", docker.TunnelAddress)
	}
	// The apps behind the proxy are told that one address, not a chain the
	// client began: NPM appends the client's own X-Forwarded-For.
	build, err := os.ReadFile(filepath.Join(repoRoot(), "dockerfiles", "npm-crowdsec", "Dockerfile"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(build), `\1$remote_addr;`) || !strings.Contains(string(build), "/etc/nginx/conf.d/include/proxy.conf") {
		t.Errorf("the proxy image passes on the client's own X-Forwarded-For chain to the apps")
	}
	for _, line := range strings.Split(string(init), "\n") {
		if strings.HasPrefix(strings.TrimSpace(line), "set_real_ip_from") && strings.TrimSpace(line) != "set_real_ip_from "+docker.TunnelAddress+";" {
			t.Errorf("the proxy's start script trusts another address than the tunnel's: %s", line)
		}
	}
}

// Backlog item 68: an app that believes a forwarded visitor's address
// (and scheme, and host) trusts the proxy's and Tailscale Serve's fixed
// addresses on the front network alone, and is not on the shared homelab
// network, where they have addresses Docker hands to anything. A private
// range would trust Docker's gateway too, which a device at home reaches
// through the app's own port with "listen on the network" on, sending an
// X-Forwarded-For of its choosing past the app's sign-in limits.
func TestOnlyTheProxyNamesAVisitorToTheApps(t *testing.T) {
	c := load(t)
	trusting := 0
	for _, a := range c.Apps {
		if a.Source == "" {
			continue // a native app, not a container
		}
		raw, err := os.ReadFile(a.Source)
		if err != nil {
			t.Fatal(err)
		}
		var f struct {
			Services map[string]struct {
				Environment any `yaml:"environment"`
			} `yaml:"services"`
		}
		if err := yaml.Unmarshal(raw, &f); err != nil {
			t.Fatal(err)
		}
		env := map[string]string{}
		switch e := f.Services[a.ID].Environment.(type) {
		case map[string]any:
			for k, v := range e {
				env[k] = fmt.Sprint(v)
			}
		case []any:
			for _, kv := range e {
				k, v, _ := strings.Cut(fmt.Sprint(kv), "=")
				env[k] = v
			}
		}
		// Pocket ID names it TRUST_PROXY, where "true" trusts every address (backlog item 89).
		value, ok := env["TRUSTED_PROXIES"]
		if !ok {
			value, ok = env["TRUST_PROXY"]
		}
		if !ok {
			continue
		}
		trusting++
		got := strings.FieldsFunc(value, func(r rune) bool { return r == ' ' || r == ',' })
		slices.Sort(got)
		want := []string{docker.FrontProxyAddress, docker.FrontServeAddress}
		if !slices.Equal(got, want) {
			t.Errorf("%s trusts %q to name a visitor: only the proxy and Tailscale Serve (%s) may", a.ID, value, strings.Join(want, " "))
		}
		if joins(a, "homelab") || a.NetworkMode != "" {
			t.Errorf("%s believes forwarded addresses but is on the shared homelab network, where the proxy's address is not the one it trusts", a.ID)
		}
		if !joins(a, docker.FrontNetwork) {
			t.Errorf("%s believes forwarded addresses but is not on %s, so the proxy cannot reach it", a.ID, docker.FrontNetwork)
		}
	}
	if trusting < 4 {
		t.Errorf("only %d apps set TRUSTED_PROXIES or TRUST_PROXY: the test no longer sees Nextcloud, Firefly III and its importer, and Pocket ID", trusting)
	}

	for id, addr := range map[string]string{"nginx-proxy-manager": docker.FrontProxyAddress, "tailscale": docker.FrontServeAddress} {
		a, ok := c.Get(id)
		if !ok || !joins(a, docker.FrontNetwork) {
			t.Errorf("%s is not on %s", id, docker.FrontNetwork)
			continue
		}
		text, err := os.ReadFile(a.Source)
		if err != nil {
			t.Fatal(err)
		}
		if strings.Count(string(text), "ipv4_address: "+addr+"\n") != 1 {
			t.Errorf("%s does not put %s at %s on %s", a.Source, id, addr, docker.FrontNetwork)
		}
	}

	subnet := netip.MustParsePrefix(docker.FrontSubnet)
	dynamic := netip.MustParsePrefix(docker.FrontRange)
	tunnel := netip.MustParsePrefix(docker.TunnelSubnet)
	if subnet.Overlaps(tunnel) || !subnet.Contains(dynamic.Addr()) || dynamic.Bits() < subnet.Bits() {
		t.Errorf("%s must hold %s and not overlap the tunnel's %s", subnet, dynamic, tunnel)
	}
	for _, s := range []string{docker.FrontProxyAddress, docker.FrontServeAddress} {
		addr := netip.MustParseAddr(s)
		if !subnet.Contains(addr) || dynamic.Contains(addr) || addr == subnet.Addr().Next() {
			t.Errorf("%s must be in %s, outside the range Docker hands out (%s), and not the gateway", addr, subnet, dynamic)
		}
	}
}
