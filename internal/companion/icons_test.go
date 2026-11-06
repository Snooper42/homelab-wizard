package companion

import (
	"encoding/json"
	"fmt"
	"image"
	_ "image/png"
	"io/fs"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/web"
)

// Added to the Home Screen, the companion has an icon a phone will take:
// the iPhone's apple-touch-icon and the manifest's are PNGs that are there,
// at the size they say, with no transparent corner (an iPhone fills one with
// black), and one is maskable for Android's shapes.
func TestHomeScreenIcons(t *testing.T) {
	files := web.Files()
	opaque := func(name string, want int) {
		t.Helper()
		f, err := files.Open(name)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		defer f.Close()
		img, _, err := image.Decode(f)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if b := img.Bounds(); b.Dx() != want || b.Dy() != want {
			t.Errorf("%s is %dx%d, not %dx%d", name, b.Dx(), b.Dy(), want, want)
		}
		b := img.Bounds()
		for _, p := range []image.Point{b.Min, {b.Max.X - 1, b.Min.Y}, {b.Min.X, b.Max.Y - 1}, {b.Max.X - 1, b.Max.Y - 1}} {
			if _, _, _, a := img.At(p.X, p.Y).RGBA(); a != 0xffff {
				t.Errorf("%s: its corner %v is not opaque", name, p)
			}
		}
	}

	page := string(Page([]byte(`<html lang="en"><head></head><body><script src="app.js"></script></body></html>`)))
	if !strings.Contains(page, `<link rel="apple-touch-icon" sizes="180x180" href="icon-180.png">`) {
		t.Errorf("no PNG apple-touch-icon:\n%s", page)
	}
	for _, want := range []string{`content="` + splashLight + `" media="(prefers-color-scheme: light)"`, `content="` + splashDark + `" media="(prefers-color-scheme: dark)"`} {
		if !strings.Contains(page, want) {
			t.Errorf("no theme colour %s", want)
		}
	}
	opaque("icon-180.png", 180)

	rec := httptest.NewRecorder()
	manifest(rec, httptest.NewRequest("GET", "/manifest.webmanifest", nil))
	var m struct {
		Background string              `json:"background_color"`
		Icons      []map[string]string `json:"icons"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &m); err != nil {
		t.Fatal(err)
	}
	if m.Background != splashLight {
		t.Errorf("the splash is %s, not the app's background", m.Background)
	}
	maskable := false
	for _, ic := range m.Icons {
		if _, err := fs.Stat(files, ic["src"]); err != nil {
			t.Errorf("the manifest names %s, which is not there", ic["src"])
			continue
		}
		if ic["type"] != "image/png" {
			continue
		}
		var n int
		if _, err := fmt.Sscanf(ic["sizes"], "%dx", &n); err != nil {
			t.Errorf("%s: sizes %q", ic["src"], ic["sizes"])
			continue
		}
		opaque(ic["src"], n)
		maskable = maskable || (ic["purpose"] == "maskable" && n >= 512)
	}
	if !maskable {
		t.Error("no maskable icon of 512 or more")
	}
}
