package npm_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/npm"
	"github.com/Snooper42/homelab-wizard/internal/npm/npmtest"
)

func TestLoginAndTwoFactor(t *testing.T) {
	srv := npmtest.NewFakeServer("homelab@example.com", "s3cret")
	defer srv.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	c := npm.New(srv.URL)
	if err := c.WaitHealthy(ctx, 10*time.Millisecond); err != nil {
		t.Fatal(err)
	}
	if err := c.Login(ctx, "homelab@example.com", "wrong"); !errors.Is(err, npm.ErrUnauthorized) {
		t.Fatalf("wrong password: %v", err)
	}
	if _, err := c.ProxyHosts(ctx); !errors.Is(err, npm.ErrUnauthorized) {
		t.Fatalf("unauthenticated call should fail: %v", err)
	}
	if err := c.Login(ctx, "homelab@example.com", "s3cret"); err != nil {
		t.Fatal(err)
	}
	srv.TwoFactor = true
	if err := npm.New(srv.URL).Login(ctx, "homelab@example.com", "s3cret"); !errors.Is(err, npm.ErrTwoFactor) {
		t.Fatalf("2FA accounts should be reported, got %v", err)
	}
}

func TestRequestsMatchTheSchema(t *testing.T) {
	srv := npmtest.NewFakeServer("a@b.c", "pw")
	defer srv.Close()
	ctx := context.Background()
	c := npm.New(srv.URL)
	if err := c.Login(ctx, "a@b.c", "pw"); err != nil {
		t.Fatal(err)
	}
	id, err := c.CreateProxyHost(ctx, npm.ProxyHost{DomainNames: []string{"x.example.com"}, ForwardScheme: "http", ForwardHost: "x", ForwardPort: 80, TrustForwardedProto: true})
	if err != nil {
		t.Fatal(err)
	}
	if err := c.UpdateProxyHost(ctx, id, npm.ProxyHost{DomainNames: []string{"x.example.com"}, ForwardScheme: "http", ForwardHost: "y", ForwardPort: 81}); err != nil {
		t.Fatal(err)
	}
	if srv.Hosts[id].ForwardHost != "y" {
		t.Fatalf("update not applied: %+v", srv.Hosts[id])
	}
	cert, err := c.CloudflareCertificate(ctx, []string{"*.example.com", "example.com"}, "token")
	if err != nil || cert.ID == 0 || !strings.HasPrefix(cert.DomainNames[0], "*.") {
		t.Fatalf("certificate: %+v %v", cert, err)
	}
}
