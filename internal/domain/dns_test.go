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
