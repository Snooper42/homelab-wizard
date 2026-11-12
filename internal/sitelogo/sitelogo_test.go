package sitelogo

import (
	"context"
	"encoding/base64"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

var (
	png1 = []byte("\x89PNG\r\n\x1a\n-small-")
	png2 = []byte("\x89PNG\r\n\x1a\n-apple-touch-")
	ico  = []byte{0, 0, 1, 0, 1, 0, 16, 16}
	svg  = []byte(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>`)
)

// allowLocal lets the test's own server (on 127.0.0.1) be asked.
func allowLocal(t *testing.T) {
	saved := Public
	t.Cleanup(func() { Public = saved })
	Public = func(net.IP) bool { return true }
}

func site(t *testing.T, h http.HandlerFunc) string {
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	return srv.URL
}

// The page's apple-touch-icon is taken before a small icon, through a
// redirect and a relative address; a page that names nothing gives its
// /favicon.ico; an SVG icon is taken as one; a named icon that answers
// with a page is passed over; a site with none says so.
func TestFetch(t *testing.T) {
	allowLocal(t)
	ctx := context.Background()

	u := site(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/":
			http.Redirect(w, r, "/home/", http.StatusFound)
		case "/home/":
			w.Write([]byte(`<html><head><link rel="icon" href="/fav-16.png" sizes="16x16"><link rel='apple-touch-icon' href="touch.png"><link rel="mask-icon" href="/mask.svg"></head></html>`))
		case "/home/touch.png":
			w.Write(png2)
		case "/fav-16.png":
			w.Write(png1)
		default:
			http.NotFound(w, r)
		}
	})
	got, err := Fetch(ctx, u)
	if err != nil || got.Image != "data:image/png;base64,"+base64.StdEncoding.EncodeToString(png2) || !strings.HasSuffix(got.From, "/home/touch.png") {
		t.Fatalf("apple-touch-icon: %+v, %v", got, err)
	}

	u = site(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/":
			w.Write([]byte(`<html><head><title>No icons named</title></head></html>`))
		case "/favicon.ico":
			w.Write(ico)
		default:
			http.NotFound(w, r)
		}
	})
	if got, err := Fetch(ctx, u); err != nil || !strings.HasPrefix(got.Image, "data:image/x-icon;base64,") {
		t.Errorf("favicon.ico: %+v, %v", got, err)
	}

	u = site(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/":
			w.Write([]byte(`<link rel="icon" href="/broken.png" sizes="512x512"><link rel="icon" type="image/svg+xml" href="/logo.svg">`))
		case "/broken.png":
			w.Write([]byte("<html>not an image</html>"))
		case "/logo.svg":
			w.Write(svg)
		default:
			http.NotFound(w, r)
		}
	})
	if got, err := Fetch(ctx, u); err != nil || !strings.HasPrefix(got.Image, "data:image/svg+xml;base64,") {
		t.Errorf("svg after a page answering for an image: %+v, %v", got, err)
	}

	u = site(t, func(w http.ResponseWriter, r *http.Request) { http.NotFound(w, r) })
	if _, err := Fetch(ctx, u); err == nil || !strings.Contains(err.Error(), "has no logo") {
		t.Errorf("no icon at all: %v", err)
	}
}

// What is typed becomes a site's home page; a name on this machine, the
// home network, or the tailnet, or no name at all, is refused before
// anything is asked; so is a connection that lands on a private address.
func TestSiteAndPrivate(t *testing.T) {
	for typed, want := range map[string]string{"fpl.com": "https://fpl.com/", "www.fpl.com/home?x=1": "https://www.fpl.com/", "http://Example.org/a": "http://Example.org/"} {
		if u, err := Site(typed); err != nil || u.String() != want {
			t.Errorf("Site(%q) = %v, %v; want %s", typed, u, err, want)
		}
	}
	for _, typed := range []string{"", "localhost", "nas.local", "router.lan", "box.tail1234.ts.net", "127.0.0.1", "192.168.1.5", "10.0.0.2", "100.100.1.1", "[::1]", "ftp://fpl.com", "javascript:alert(1)"} {
		if _, err := Site(typed); err == nil {
			t.Errorf("Site(%q) was taken", typed)
		}
	}
	// Whatever a name points to, a connection that lands on a private address is refused as it connects.
	u := site(t, func(w http.ResponseWriter, r *http.Request) { w.Write(png1) })
	if _, _, err := get(context.Background(), client(), u, maxImage, "image/*"); err != errPrivate {
		t.Errorf("a connection to 127.0.0.1: %v", err)
	}
	for _, ip := range []string{"8.8.8.8", "2606:4700:4700::1111"} {
		if !Public(net.ParseIP(ip)) {
			t.Errorf("%s is public", ip)
		}
	}
	// N46: the homelab's own front and tunnel networks (which a Linux host
	// reaches directly), "this network", the reserved ranges, and IPv6
	// that carries an IPv4 address inside are not websites, however a
	// site redirects there.
	for _, ip := range []string{"198.18.89.18", "198.18.89.2", "198.19.255.1", "0.0.0.1", "100.64.0.1", "192.0.0.8", "240.0.0.1", "255.255.255.255", "::ffff:127.0.0.1", "::ffff:198.18.89.18", "64:ff9b::c0a8:105", "2002:c0a8:105::1", "2001:db8::1"} {
		if Public(net.ParseIP(ip)) {
			t.Errorf("%s was taken for a website", ip)
		}
	}
}

// Only images are taken: PNG, JPEG, GIF, WebP, ICO, and SVG, not a page.
func TestImageType(t *testing.T) {
	for b, want := range map[string]string{string(png1): "image/png", "\xff\xd8\xff\xe0jpeg": "image/jpeg", "GIF89a": "image/gif", string(ico): "image/x-icon", string(svg): "image/svg+xml", `<?xml version="1.0"?><svg/>`: "image/svg+xml", "<html></html>": "", "plain text": ""} {
		if got := imageType([]byte(b)); got != want {
			t.Errorf("imageType(%.12q) = %q, want %q", b, got, want)
		}
	}
}
