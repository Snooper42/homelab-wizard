package appicon

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

var (
	png = append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 40)...)
	ico = append([]byte{0, 0, 1, 0, 1, 0}, make([]byte, 40)...)
)

func TestLinks(t *testing.T) {
	page := `<html><head>
<link rel="stylesheet" href="/app.css">
<link rel="icon" type="image/png" sizes="16x16" href="/icons/16.png">
<link rel="mask-icon" href="/mask.svg" color="#000">
<link rel='icon' sizes='32x32 192x192' href='/icons/192.png'>
<LINK REL="shortcut icon" href=/favicon-shortcut.ico>
<link rel="apple-touch-icon" href="/touch.png">
<link rel="icon" href="data:image/png;base64,AAAA">
<link href="/icons/any.svg" rel="icon" sizes="any">
</head></html>`
	want := []string{"/touch.png", "/icons/any.svg", "/icons/192.png", "/icons/16.png", "/favicon-shortcut.ico"}
	if got := Links(page); !reflect.DeepEqual(got, want) {
		t.Errorf("Links = %q, want %q", got, want)
	}
	if got := Links("<html>no icons</html>"); len(got) != 0 {
		t.Errorf("Links of a page without icons = %q", got)
	}
}

func TestType(t *testing.T) {
	for _, c := range []struct {
		b    []byte
		want string
	}{
		{png, "image/png"},
		{ico, "image/x-icon"},
		{[]byte("GIF89a......"), "image/gif"},
		{[]byte(`<svg xmlns="http://www.w3.org/2000/svg"></svg>`), "image/svg+xml"},
		{[]byte("\xef\xbb\xbf<?xml version=\"1.0\"?>\n<!-- made by hand -->\n<!DOCTYPE svg>\n<svg viewBox=\"0 0 1 1\"/>"), "image/svg+xml"},
		{[]byte("<!doctype html><html><body>Not found</body></html>"), ""},
		{[]byte("<svgx/>"), ""},
		{[]byte("<?xml version=\"1.0\""), ""},
		{[]byte("plain text"), ""},
	} {
		if got := Type(c.b); got != c.want {
			t.Errorf("Type(%.20q) = %q, want %q", c.b, got, c.want)
		}
	}
	if DataURL([]byte("<html>")) != "" {
		t.Error("an HTML page made a data URL")
	}
	if got := DataURL(png); !strings.HasPrefix(got, "data:image/png;base64,iVBORw0K") {
		t.Errorf("DataURL(png) = %.40s", got)
	}
}

// app is a fake app: its page, and the files it serves.
func app(t *testing.T, page string, files map[string][]byte) *httptest.Server {
	t.Helper()
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			if page == "" {
				http.Error(w, "sign in first", http.StatusUnauthorized)
				return
			}
			_, _ = w.Write([]byte(page))
			return
		}
		if b, ok := files[r.URL.Path]; ok {
			_, _ = w.Write(b)
			return
		}
		// Many apps answer every address with their page.
		_, _ = w.Write([]byte("<!doctype html><html>the app</html>"))
	}))
	t.Cleanup(s.Close)
	return s
}

func TestFetch(t *testing.T) {
	ctx := context.Background()
	t.Run("the touch icon first", func(t *testing.T) {
		s := app(t, `<link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="touch.png">`, map[string][]byte{"/touch.png": png, "/favicon.ico": ico})
		if b, err := Fetch(ctx, s.URL); err != nil || !bytes.Equal(b, png) {
			t.Fatalf("Fetch = %.8q, %v; want the touch icon", b, err)
		}
	})
	t.Run("a link that is not an icon is skipped", func(t *testing.T) {
		s := app(t, `<link rel="apple-touch-icon" href="/gone.png">`, map[string][]byte{"/favicon.ico": ico})
		if b, err := Fetch(ctx, s.URL); err != nil || !bytes.Equal(b, ico) {
			t.Fatalf("Fetch = %.8q, %v; want favicon.ico", b, err)
		}
	})
	t.Run("a page behind a sign-in still has its favicon", func(t *testing.T) {
		s := app(t, "", map[string][]byte{"/favicon.ico": ico})
		if b, err := Fetch(ctx, s.URL+"/"); err != nil || !bytes.Equal(b, ico) {
			t.Fatalf("Fetch = %.8q, %v; want favicon.ico", b, err)
		}
	})
	t.Run("none", func(t *testing.T) {
		s := app(t, "<html></html>", nil)
		if _, err := Fetch(ctx, s.URL); err != ErrNone {
			t.Fatalf("Fetch = %v, want ErrNone", err)
		}
	})
	t.Run("too large", func(t *testing.T) {
		big := append(append([]byte{}, png...), make([]byte, MaxBytes)...)
		s := app(t, `<link rel="icon" href="/big.png">`, map[string][]byte{"/big.png": big})
		if _, err := Fetch(ctx, s.URL); err != ErrNone {
			t.Fatalf("Fetch of a %d KB icon = %v, want ErrNone", len(big)>>10, err)
		}
	})
	t.Run("another host is never asked", func(t *testing.T) {
		asked := false
		other := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { asked = true; _, _ = w.Write(png) }))
		defer other.Close()
		s := app(t, `<link rel="apple-touch-icon" href="`+other.URL+`/touch.png">`, nil)
		redirect := httptest.NewServer(http.RedirectHandler(other.URL+"/", http.StatusFound))
		defer redirect.Close()
		if _, err := Fetch(ctx, s.URL); err != ErrNone {
			t.Errorf("Fetch = %v, want ErrNone", err)
		}
		if _, err := Fetch(ctx, redirect.URL); err == nil {
			t.Error("Fetch followed a redirect to another host")
		}
		if asked {
			t.Error("the other host was asked")
		}
	})
	t.Run("not a web address", func(t *testing.T) {
		for _, u := range []string{"", "file:///etc/passwd", "localhost:8080"} {
			if _, err := Fetch(ctx, u); err == nil {
				t.Errorf("Fetch(%q) did not fail", u)
			}
		}
	})
	t.Run("it does not answer", func(t *testing.T) {
		s := app(t, "<html></html>", nil)
		s.Close()
		if _, err := Fetch(ctx, s.URL); err == nil || err == ErrNone {
			t.Errorf("Fetch of a stopped app = %v", err)
		}
	})
}

func TestGet(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	files := map[string][]byte{"/favicon.ico": ico}
	s := app(t, "<html></html>", files)
	icoURL := DataURL(ico)

	if got := Get(ctx, root, "../etc", s.URL); got != "" {
		t.Fatalf("Get with a bad id = %q", got)
	}
	if got := Get(ctx, root, "vikunja", s.URL); got != icoURL {
		t.Fatalf("Get = %.30q, want the favicon", got)
	}
	if got := Kept(root, "vikunja"); got != icoURL {
		t.Fatalf("Kept = %.30q, want the favicon", got)
	}
	// Fresh: not asked again, even when the app now has another.
	files["/favicon.ico"] = png
	if got := Get(ctx, root, "vikunja", s.URL); got != icoURL {
		t.Errorf("a fresh icon was asked again")
	}
	// A week on, asked again.
	old := time.Now().Add(-Fresh - time.Hour)
	_ = os.Chtimes(Path(root, "vikunja"), old, old)
	if got := Get(ctx, root, "vikunja", s.URL); got != DataURL(png) {
		t.Errorf("an old icon was not asked again")
	}
	// The app now has none: the old one is kept.
	_ = os.Chtimes(Path(root, "vikunja"), old, old)
	delete(files, "/favicon.ico")
	if got := Get(ctx, root, "vikunja", s.URL); got != DataURL(png) {
		t.Errorf("the old icon was not kept when the app had none")
	}
	// It does not answer: the old one is kept, and asked again next time.
	_ = os.Chtimes(Path(root, "vikunja"), old, old)
	s.Close()
	if got := Get(ctx, root, "vikunja", s.URL); got != DataURL(png) {
		t.Errorf("the old icon was not kept when the app did not answer")
	}
	if fi, _ := os.Stat(Path(root, "vikunja")); time.Since(fi.ModTime()) < Fresh {
		t.Errorf("a failed ask counted as asked")
	}

	// An app without one: noted, and asked again after an hour.
	s2 := app(t, "<html></html>", nil)
	if got := Get(ctx, root, "notes", s2.URL); got != "" {
		t.Fatalf("Get of an app without an icon = %q", got)
	}
	if fi, err := os.Stat(Path(root, "notes")); err != nil || fi.Size() != 0 {
		t.Fatalf("no empty note kept: %v", err)
	}
	files2 := map[string][]byte{"/favicon.ico": ico}
	s3 := app(t, "<html></html>", files2)
	if got := Get(ctx, root, "notes", s3.URL); got != "" {
		t.Errorf("the note was asked again within the hour")
	}
	hour := time.Now().Add(-NoneHeld - time.Minute)
	_ = os.Chtimes(Path(root, "notes"), hour, hour)
	if got := Get(ctx, root, "notes", s3.URL); got != icoURL {
		t.Errorf("the note was not asked again after an hour")
	}

	// No page to ask (the app is stopped): what is kept.
	if got := Get(ctx, root, "notes", ""); got != icoURL {
		t.Errorf("Get without a page = %.30q", got)
	}
	if got := Kept(root, "never-asked"); got != "" {
		t.Errorf("Kept of an app never asked = %q", got)
	}
	if got := Kept(root, "../../x"); got != "" {
		t.Errorf("Kept with a bad id = %q", got)
	}
	if _, err := os.Stat(filepath.Join(root, "data", "icons")); err != nil {
		t.Error(err)
	}
}
