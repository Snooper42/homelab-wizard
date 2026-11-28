package domain

import (
	"context"
	"errors"
	"net"
	"testing"
)

func fixed(addrs []string, err error) Lookup {
	return func(context.Context, string) ([]string, error) { return addrs, err }
}

// A home-only app's name is checked as the internet sees it: the home record
// (a private address), Tailscale's, or no record at all leave it home only;
// Cloudflare's addresses (a tunnel hostname left behind) do not.
func TestReachable(t *testing.T) {
	ctx := context.Background()
	for _, c := range []struct {
		name   string
		addrs  []string
		err    error
		public int
		fails  bool
	}{
		{"the home record", []string{"10.0.0.16"}, nil, 0, false},
		{"a home record on another network", []string{"192.168.1.10", "fd00::10"}, nil, 0, false},
		{"Tailscale's address", []string{"100.101.102.103"}, nil, 0, false},
		{"no such name", nil, &net.DNSError{Err: "no such host", Name: "passwords.example.com", IsNotFound: true}, 0, false},
		{"through Cloudflare's tunnel", []string{"104.21.32.1", "172.67.150.2", "2606:4700:3030::6815:2001"}, nil, 3, false},
		{"one home and one public", []string{"10.0.0.16", "104.21.32.1"}, nil, 1, false},
		{"an answer that isn't an address", []string{"not-an-ip"}, nil, 1, false},
		{"no network", nil, errors.New("dial udp 1.1.1.1:53: connect: network is unreachable"), 0, true},
	} {
		got, err := Reachable(ctx, fixed(c.addrs, c.err), "passwords.example.com")
		if (err != nil) != c.fails || len(got) != c.public {
			t.Errorf("%s: %v %v", c.name, got, err)
		}
	}
}
