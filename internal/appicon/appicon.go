// Package appicon keeps each app's own icon for its page: asked of the
// app's page on this machine (the icon its home screen shortcut would
// use, else its favicon), kept in data/icons/<id>, and asked again after a
// week. Nothing is asked of anywhere but the app itself.
package appicon

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// MaxBytes is the largest icon kept.
const MaxBytes = 512 << 10

// How long a kept icon, or the note that the app has none, holds before
// the app is asked again.
const (
	Fresh    = 7 * 24 * time.Hour
	NoneHeld = time.Hour
)

var validID = regexp.MustCompile(`^[a-z0-9-]+$`)

// Path is where an app's icon is kept: empty when it was asked and had none.
func Path(root, id string) string { return filepath.Join(root, "data", "icons", id) }

// Kept is the app's kept icon as a data: URL, "" when there is none.
func Kept(root, id string) string {
	if !validID.MatchString(id) {
		return ""
	}
	b, err := os.ReadFile(Path(root, id))
	if err != nil {
		return ""
	}
	return DataURL(b)
}

// Get is the app's icon as a data: URL, "" when it has none: the kept one
// while it is fresh, else asked of page (the app's address on this
// machine). When asking fails the old one is kept and returned.
func Get(ctx context.Context, root, id, page string) string {
	if !validID.MatchString(id) {
		return ""
	}
	p := Path(root, id)
	if fi, err := os.Stat(p); err == nil {
		hold := Fresh
		if fi.Size() == 0 {
			hold = NoneHeld
		}
		if time.Since(fi.ModTime()) < hold {
			return Kept(root, id)
		}
	}
	if page == "" {
		return Kept(root, id)
	}
	b, err := Fetch(ctx, page)
	switch {
	case err == nil:
	case errors.Is(err, ErrNone):
		if old, _ := os.ReadFile(p); len(old) > 0 {
			b = old // it had one before: keep it, ask again in a week
		} else {
			b = nil
		}
	default:
		return Kept(root, id) // it did not answer: ask again next time
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err == nil {
		_ = os.WriteFile(p, b, 0o644)
	}
	return DataURL(b)
}

// ErrNone: the app answered, but has no icon this package can use.
var ErrNone = errors.New("no icon")

// Fetch asks the page at page for its icon: its apple-touch-icon first,
// then its largest icon link, then /apple-touch-icon.png and /favicon.ico.
// Only page's own host is asked, redirects included.
func Fetch(ctx context.Context, page string) ([]byte, error) {
	base, err := url.Parse(page)
	if err != nil || (base.Scheme != "http" && base.Scheme != "https") || base.Host == "" {
		return nil, fmt.Errorf("not a web address: %q", page)
	}
	c := &http.Client{
		Timeout: 10 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return errors.New("too many redirects")
			}
			if req.URL.Host != base.Host {
				return fmt.Errorf("it sends the icon elsewhere (%s)", req.URL.Host)
			}
			return nil
		},
	}
	html, final, err := get(ctx, c, base.String(), 1<<20, true)
	var status statusError
	switch {
	case errors.As(err, &status):
		final = base // it answered, without a page (a sign-in first): its favicon may still be there
	case err != nil:
		return nil, err
	}
	var tries []string
	for _, l := range Links(string(html)) {
		u, err := final.Parse(l)
		if err == nil && u.Host == base.Host {
			tries = append(tries, u.String())
		}
	}
	for _, s := range []string{"/apple-touch-icon.png", "/favicon.ico"} {
		u, _ := final.Parse(s)
		tries = append(tries, u.String())
	}
	for _, t := range tries {
		if b, _, err := get(ctx, c, t, MaxBytes, false); err == nil && Type(b) != "" {
			return b, nil
		}
	}
	return nil, ErrNone
}

// statusError: the server answered, but not with what was asked.
type statusError struct{ code int }

func (e statusError) Error() string { return "HTTP " + strconv.Itoa(e.code) }

// get reads at most max bytes from u: more is cut off when cut is set (a
// page, whose head is all that is read), else an error.
func get(ctx context.Context, c *http.Client, u string, max int64, cut bool) ([]byte, *url.URL, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, nil, err
	}
	resp, err := c.Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, nil, statusError{resp.StatusCode}
	}
	b, err := io.ReadAll(io.LimitReader(resp.Body, max+1))
	if err != nil {
		return nil, nil, err
	}
	if int64(len(b)) > max {
		if !cut {
			return nil, nil, fmt.Errorf("%s: larger than %d KB", u, max>>10)
		}
		b = b[:max]
	}
	return b, resp.Request.URL, nil
}

var (
	linkTag = regexp.MustCompile(`(?is)<link\b[^>]*>`)
	attr    = regexp.MustCompile(`(?is)([a-z-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+)`)
)

// Links are a page's icon links, best first: its apple-touch-icons, then
// its other icons, each the largest first (sizes="any", an SVG, counts as
// largest). Safari's mask-icon, one colour on a pinned tab, is left out.
func Links(page string) []string {
	type link struct {
		href  string
		touch bool
		size  int
	}
	var ls []link
	for _, tag := range linkTag.FindAllString(page, -1) {
		a := map[string]string{}
		for _, m := range attr.FindAllStringSubmatch(tag, -1) {
			a[strings.ToLower(m[1])] = strings.Trim(m[2], `"'`)
		}
		rels := strings.Fields(strings.ToLower(a["rel"]))
		touch, icon := false, false
		for _, r := range rels {
			switch r {
			case "apple-touch-icon", "apple-touch-icon-precomposed":
				touch = true
			case "icon":
				icon = true
			}
		}
		if (!touch && !icon) || a["href"] == "" || strings.HasPrefix(a["href"], "data:") {
			continue
		}
		ls = append(ls, link{href: a["href"], touch: touch, size: largest(a["sizes"])})
	}
	better := func(x, y link) bool {
		if x.touch != y.touch {
			return x.touch
		}
		return x.size > y.size
	}
	for i := 1; i < len(ls); i++ { // a stable insertion sort: equal ones keep the page's order
		for j := i; j > 0 && better(ls[j], ls[j-1]); j-- {
			ls[j], ls[j-1] = ls[j-1], ls[j]
		}
	}
	out := make([]string, len(ls))
	for i, l := range ls {
		out[i] = l.href
	}
	return out
}

// largest is the widest of a sizes attribute ("16x16 32x32" → 32; "any" →
// as large as can be; none → 0).
func largest(sizes string) int {
	n := 0
	for _, s := range strings.Fields(strings.ToLower(sizes)) {
		if s == "any" {
			return 1 << 20
		}
		w, _, _ := strings.Cut(s, "x")
		if v, err := strconv.Atoi(w); err == nil && v > n {
			n = v
		}
	}
	return n
}

// Type is an icon's media type from its first bytes: png, jpeg, gif, webp,
// ico or svg; "" for anything else (an HTML page served for a missing icon).
func Type(b []byte) string {
	switch t := http.DetectContentType(b); t {
	case "image/png", "image/jpeg", "image/gif", "image/webp", "image/x-icon":
		return t
	}
	if svg(b) {
		return "image/svg+xml"
	}
	return ""
}

// svg: an SVG document, after an XML declaration, comments, and a doctype.
func svg(b []byte) bool {
	s := bytes.TrimPrefix(b, []byte("\xef\xbb\xbf"))
	for {
		s = bytes.TrimLeft(s, " \t\r\n")
		switch {
		case bytes.HasPrefix(s, []byte("<?")):
			s = after(s, "?>")
		case bytes.HasPrefix(s, []byte("<!--")):
			s = after(s, "-->")
		case bytes.HasPrefix(s, []byte("<!")):
			s = after(s, ">")
		default:
			return bytes.HasPrefix(s, []byte("<svg")) && len(s) > 4 && strings.ContainsRune(" \t\r\n>/", rune(s[4]))
		}
		if s == nil {
			return false
		}
	}
}

func after(s []byte, end string) []byte {
	if i := bytes.Index(s, []byte(end)); i >= 0 {
		return s[i+len(end):]
	}
	return nil
}

// DataURL is an icon as a data: URL, "" when it is not one.
func DataURL(b []byte) string {
	t := Type(b)
	if t == "" {
		return ""
	}
	return "data:" + t + ";base64," + base64.StdEncoding.EncodeToString(b)
}
