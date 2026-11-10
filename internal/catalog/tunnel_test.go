package catalog

import (
	"net/netip"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/docker"
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
	for _, line := range strings.Split(string(init), "\n") {
		if strings.HasPrefix(strings.TrimSpace(line), "set_real_ip_from") && strings.TrimSpace(line) != "set_real_ip_from "+docker.TunnelAddress+";" {
			t.Errorf("the proxy's start script trusts another address than the tunnel's: %s", line)
		}
	}
}
