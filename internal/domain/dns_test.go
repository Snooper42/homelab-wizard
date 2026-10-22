package domain

import (
	"strings"
	"testing"
)

func TestResolver(t *testing.T) {
	got := Resolver("example.com", "192.168.1.10")
	if !strings.Contains(got, "nameserver 192.168.1.10\n") || ResolverPath("example.com") != "/etc/resolver/example.com" {
		t.Errorf("%q", got)
	}
}

func TestResolved(t *testing.T) {
	got := Resolved("example.com", "192.168.1.10")
	for _, want := range []string{"[Resolve]\n", "DNS=192.168.1.10\n", "Domains=~example.com\n"} {
		if !strings.Contains(got, want) {
			t.Errorf("missing %q in:\n%s", want, got)
		}
	}
	if ResolvedPath("example.com") != "/etc/systemd/resolved.conf.d/homelab-example.com.conf" {
		t.Error(ResolvedPath("example.com"))
	}
	if got := encodePS("Get-Date"); got != "RwBlAHQALQBEAGEAdABlAA==" {
		t.Error(got)
	}
}
