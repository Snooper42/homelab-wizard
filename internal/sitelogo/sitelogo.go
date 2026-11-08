// Package sitelogo finds a company's own logo on its website, as a browser
// finds a site's icon: the page's apple-touch-icon (a solid square, made
// for a phone's home screen), else its largest icon, else the site's
// /apple-touch-icon.png or /favicon.ico. Finances asks for one only when
// the household clicks Get the real logo (or Get them all): that one
// request goes to that company's website, from this computer, and the
// image is kept in the household's own plan, never in the app's code.
//
// Only a public website is asked: an address on this machine, the home
// network, or the tailnet is refused at the moment of connecting (so a
// name that later points somewhere private is refused too), as are other
// schemes, a page over 2 MB, and an image over 1 MB.
package sitelogo

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// Logo is a logo found: the image as a data URL in its own type (PNG, ICO,
// SVG, …; Finances makes it a small PNG before keeping it), and where it
// was found.
type Logo struct {
	Image string `json:"image"`
	From  string `json:"from"`
}

const (
	maxPage  = 2 << 20
	maxImage = 1 << 20
)

// Public reports whether an address may be asked: not this machine, a
// private or link-local network, the tailnet's (100.64.0.0/10), or any
// address that is not one. Tests set it to allow their own server.
var Public = func(ip net.IP) bool {
	if ip == nil || ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified() || ip.IsMulticast() || ip.IsInterfaceLocalMulticast() {
		return false
	}
	if v4 := ip.To4(); v4 != nil && v4[0] == 100 && v4[1]&0xc0 == 64 {
		return false // the tailnet's addresses (CGNAT)
	}
	return true
}

var errPrivate = errors.New("that address is on this machine or the home network, not a company's website")

func client() *http.Client {
	dialer := &net.Dialer{Timeout: 8 * time.Second, Control: func(_, address string, _ syscall.RawConn) error {
		host, _, err := net.SplitHostPort(address)
		if err != nil || !Public(net.ParseIP(host)) {
			return errPrivate
		}
		return nil
	}}
	return &http.Client{
		Timeout:   20 * time.Second,
		Transport: &http.Transport{DialContext: dialer.DialContext, TLSHandshakeTimeout: 8 * time.Second, ResponseHeaderTimeout: 10 * time.Second},
		CheckRedirect: func(r *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return errors.New("the website sends it round too many times")
			}
			if r.URL.Scheme != "https" && r.URL.Scheme != "http" {
				return errors.New("the website sends it somewhere that is not a web page")
			}
			return nil
		},
	}
}

// Site is the website a name or address typed means: "fpl.com",
// "www.fpl.com/home" and "https://fpl.com" are https://fpl.com/.
func Site(typed string) (*url.URL, error) {
	s := strings.TrimSpace(typed)
	if s == "" {
		return nil, errors.New("type the company's website, like fpl.com")
	}
	if !strings.Contains(s, "://") {
		s = "https://" + s
	}
	u, err := url.Parse(s)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Hostname() == "" {
		return nil, fmt.Errorf("%q is not a website: type one like fpl.com", typed)
	}
	host := strings.ToLower(u.Hostname())
	if ip := net.ParseIP(host); ip != nil {
		if !Public(ip) {
			return nil, errPrivate
		}
	} else if !strings.Contains(host, ".") || strings.HasSuffix(host, ".local") || strings.HasSuffix(host, ".lan") || strings.HasSuffix(host, ".home") || strings.HasSuffix(host, ".internal") || strings.HasSuffix(host, ".ts.net") {
		return nil, fmt.Errorf("%q is not a company's website: type one like fpl.com", typed)
	}
	return &url.URL{Scheme: u.Scheme, Host: u.Host, Path: "/"}, nil
}

// candidate is an icon a page names, and how much it is worth trying first.
type candidate struct {
	href  string
	score int
}

var (
	linkTag = regexp.MustCompile(`(?is)<link\b[^>]*>`)
	attr    = regexp.MustCompile(`(?is)\b(rel|href|sizes|type)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)`)
)

// icons are the icons a page's <link> tags name, the best first: an
// apple-touch-icon, then any icon by its size (an SVG counts as large);
// a monochrome mask-icon is left out.
func icons(page string) []candidate {
	var out []candidate
	for _, tag := range linkTag.FindAllString(page, -1) {
		a := map[string]string{}
		for _, m := range attr.FindAllStringSubmatch(tag, -1) {
			a[strings.ToLower(m[1])] = strings.Trim(m[2], `"'`)
		}
		rel, href := strings.ToLower(a["rel"]), strings.TrimSpace(a["href"])
		if href == "" || strings.HasPrefix(href, "data:") || strings.Contains(rel, "mask-icon") || !strings.Contains(rel, "icon") {
			continue
		}
		size := 16
		for _, s := range strings.Fields(strings.ToLower(a["sizes"])) {
			if s == "any" {
				size = 512
			} else if w, _, ok := strings.Cut(s, "x"); ok {
				if n, err := strconv.Atoi(w); err == nil && n > size {
					size = n
				}
			}
		}
		if strings.Contains(strings.ToLower(a["type"]), "svg") || strings.HasSuffix(strings.ToLower(strings.SplitN(href, "?", 2)[0]), ".svg") {
			size = max(size, 256)
		}
		score := size
		if strings.Contains(rel, "apple-touch-icon") {
			score = max(size, 180) + 1000
		}
		out = append(out, candidate{href, score})
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].score > out[j].score })
	return out
}

// Fetch finds the logo of the website typed (Site): its page's icons, the
// best first, then its /apple-touch-icon.png and /favicon.ico; the first
// that answers with an image is it.
func Fetch(ctx context.Context, typed string) (Logo, error) {
	site, err := Site(typed)
	if err != nil {
		return Logo{}, err
	}
	c := client()
	base := site
	var tried []candidate
	if page, at, err := get(ctx, c, site.String(), maxPage, "text/html"); err == nil {
		base = at
		tried = icons(string(page))
	} else if errors.Is(err, errPrivate) {
		return Logo{}, err
	}
	tried = append(tried, candidate{href: "/apple-touch-icon.png"}, candidate{href: "/favicon.ico"})
	seen := map[string]bool{}
	for _, cand := range tried {
		ref, err := url.Parse(cand.href)
		if err != nil {
			continue
		}
		u := base.ResolveReference(ref)
		if (u.Scheme != "https" && u.Scheme != "http") || seen[u.String()] {
			continue
		}
		seen[u.String()] = true
		body, _, err := get(ctx, c, u.String(), maxImage, "image/*")
		if err != nil {
			continue
		}
		if kind := imageType(body); kind != "" {
			return Logo{Image: "data:" + kind + ";base64," + base64.StdEncoding.EncodeToString(body), From: u.String()}, nil
		}
	}
	return Logo{}, fmt.Errorf("%s has no logo it shares as a site icon: use your own image instead", site.Host)
}

// get reads an address, at most limit bytes, and says where it ended up after any redirects.
func get(ctx context.Context, c *http.Client, address string, limit int64, accept string) ([]byte, *url.URL, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, address, nil)
	if err != nil {
		return nil, nil, err
	}
	req.Header.Set("Accept", accept)
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; HomelabWizard logo lookup)")
	res, err := c.Do(req)
	if err != nil {
		if errors.Is(err, errPrivate) {
			return nil, nil, errPrivate
		}
		return nil, nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, nil, fmt.Errorf("%s answered %s", address, res.Status)
	}
	body, err := io.ReadAll(io.LimitReader(res.Body, limit+1))
	if err != nil {
		return nil, nil, err
	}
	if int64(len(body)) > limit {
		return nil, nil, fmt.Errorf("%s is too large", address)
	}
	return body, res.Request.URL, nil
}

// imageType is what kind of image the bytes are (PNG, JPEG, GIF, WebP,
// ICO, or SVG), or "" for anything else (a page answering instead).
func imageType(b []byte) string {
	switch t := http.DetectContentType(b); {
	case t == "image/png", t == "image/jpeg", t == "image/gif", t == "image/webp":
		return t
	case t == "image/x-icon" || t == "image/vnd.microsoft.icon" || (len(b) > 4 && b[0] == 0 && b[1] == 0 && b[2] == 1 && b[3] == 0):
		return "image/x-icon"
	}
	head := strings.ToLower(strings.TrimSpace(string(b[:min(len(b), 512)])))
	if strings.HasPrefix(head, "<svg") || (strings.HasPrefix(head, "<?xml") && strings.Contains(head, "<svg")) {
		return "image/svg+xml"
	}
	return ""
}
