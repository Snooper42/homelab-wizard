package releases

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestRepo(t *testing.T) {
	for _, c := range []struct {
		meta, ref string
		labels    map[string]string
		want      string
	}{
		{"usememos/memos", "neosmemo/memos:stable", nil, "usememos/memos"},
		{"", "binwiederhier/ntfy:latest", map[string]string{"org.opencontainers.image.source": "https://github.com/binwiederhier/ntfy"}, "binwiederhier/ntfy"},
		{"", "lscr.io/linuxserver/sonarr:latest", map[string]string{"org.opencontainers.image.source": "https://github.com/linuxserver/docker-sonarr.git"}, "linuxserver/docker-sonarr"},
		{"", "ghcr.io/immich-app/immich-server:release", nil, "immich-app/immich-server"},
		{"", "ghcr.io/gethomepage/homepage@sha256:abc", nil, "gethomepage/homepage"},
		{"", "deluan/navidrome:latest", map[string]string{"org.opencontainers.image.source": "https://gitlab.com/x/y"}, ""},
		{"", "postgres:17", nil, ""},
	} {
		if got := Repo(c.meta, c.ref, c.labels); got != c.want {
			t.Errorf("Repo(%q, %q) = %q, want %q", c.meta, c.ref, got, c.want)
		}
	}
}

func TestVersion(t *testing.T) {
	for _, c := range []struct {
		ref, label, want string
	}{
		{"binwiederhier/ntfy:latest", "2.32.0", "2.32.0"},
		{"lscr.io/linuxserver/sonarr:latest", "4.0.15.2941-ls290", "4.0.15.2941-ls290"},
		{"louislam/uptime-kuma:2", "", ""},
		{"getmeili/meilisearch:v1.41.0", "", "v1.41.0"},
		{"neosmemo/memos:stable", "", ""},
		{"localhost:5000/app", "", ""},
		{"x/y:latest", "latest", ""},
	} {
		if got := Version(c.ref, map[string]string{"org.opencontainers.image.version": c.label}); got != c.want {
			t.Errorf("Version(%q, %q) = %q, want %q", c.ref, c.label, got, c.want)
		}
	}
}

func TestPlace(t *testing.T) {
	list := []Release{{Tag: "v2.33.0"}, {Tag: "v2.32.1"}, {Tag: "v2.32.0"}, {Tag: "v2.31.0"}}
	p := Place("ntfy", "binwiederhier/ntfy", "2.32.0", list)
	if !p.Placed || len(p.Releases) != 2 || p.Releases[0].Tag != "v2.33.0" {
		t.Fatalf("%+v", p)
	}
	if got := p.Summary(); got != "2.32.0 → v2.33.0 (2 releases)" {
		t.Errorf("Summary = %q", got)
	}
	if p := Place("ntfy", "binwiederhier/ntfy", "v2.33.0", list); !p.Current() || p.Summary() != "v2.33.0 is the newest release" {
		t.Errorf("newest: %+v %q", p, p.Summary())
	}
	if p := Place("memos", "usememos/memos", "", list); p.Placed || len(p.Releases) != 1 || !strings.Contains(p.Summary(), "not labelled") {
		t.Errorf("unknown version: %+v", p)
	}
	if p := Place("x", "", "1.0", nil); p.Page != "" || p.Summary() != "no release notes known" {
		t.Errorf("no repo: %+v", p)
	}
}

func TestBrief(t *testing.T) {
	body := "<!-- template -->\r\n## What's Changed\r\n\r\n* **Fix** the [login](https://x/1) page ![shot](https://x/a.png)\r\n* Faster `search`\r\n---\r\n<details><summary>More</summary>\r\n" + strings.Repeat("x", 300)
	got := Brief(body, 3)
	want := "What's Changed\n- Fix the login page\n- Faster search\n…"
	if got != want {
		t.Errorf("Brief =\n%s\nwant\n%s", got, want)
	}
	if long := Brief(strings.Repeat("y", 300), 5); len([]rune(long)) != 160 {
		t.Errorf("long line kept %d runes", len([]rune(long)))
	}
}

func TestList(t *testing.T) {
	asked := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		asked++
		if r.URL.Path != "/repos/o/r/releases" || r.Header.Get("User-Agent") == "" {
			http.NotFound(w, r)
			return
		}
		_ = json.NewEncoder(w).Encode([]map[string]any{
			{"tag_name": "v3.0.0-rc1", "prerelease": true},
			{"tag_name": "v2.0.0", "name": "v2.0.0", "html_url": "https://github.com/o/r/releases/tag/v2.0.0", "published_at": "2026-10-01T00:00:00Z", "body": "- new"},
			{"tag_name": "v1.9.0", "name": "Spring", "draft": true},
			{"tag_name": "v1.0.0", "name": "First"},
		})
	}))
	defer srv.Close()
	API = srv.URL
	defer func() { API = "https://api.github.com" }()

	path := filepath.Join(t.TempDir(), "data", "releases.json")
	list, err := List(context.Background(), path, "o/r")
	if err != nil || len(list) != 2 || list[0].Name != "" || list[0].Notes != "- new" || list[1].Name != "First" {
		t.Fatalf("%+v %v", list, err)
	}
	if !list[0].When.Equal(time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)) {
		t.Errorf("When = %v", list[0].When)
	}
	if _, err := List(context.Background(), path, "o/r"); err != nil || asked != 1 {
		t.Errorf("not cached: asked %d times, %v", asked, err)
	}
	p, err := For(context.Background(), path, "app", "o/r", "img:1.0.0", nil)
	if err != nil || !p.Placed || len(p.Releases) != 1 || p.Page != "https://github.com/o/r/releases" {
		t.Errorf("For = %+v, %v", p, err)
	}
	if _, err := List(context.Background(), path, "o/missing"); err == nil {
		t.Error("a missing project gave no error")
	}
}

// A project's releases are a stranger's text, printed by homelab updates
// notes in a terminal: control characters (an escape that rewrites the
// screen, sets the title or the clipboard) are taken out of the tag, the
// name and the notes, also from a copy cached before; a release's link is
// kept only on GitHub. An image's label naming "." or ".." as its project
// names none, so no other address on GitHub's API is asked.
func TestAReleaseIsPlainText(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode([]map[string]any{
			{"tag_name": "v2.0.0\x1b[2J", "name": "Big\x1b]52;c;ZWNobyBoaQ==\x07 one", "html_url": "https://evil.example/x", "body": "- fixed\x1b[8m hidden\r\n- \x07two"},
			{"tag_name": "v1.0.0", "html_url": "https://github.com/o/r/releases/tag/v1.0.0"},
		})
	}))
	defer srv.Close()
	API = srv.URL
	defer func() { API = "https://api.github.com" }()
	path := filepath.Join(t.TempDir(), "data", "releases.json")
	list, err := List(context.Background(), path, "o/r")
	if err != nil || len(list) != 2 {
		t.Fatalf("%+v %v", list, err)
	}
	for _, r := range list {
		for _, s := range []string{r.Tag, r.Name, r.Notes, r.URL} {
			if strings.ContainsFunc(s, func(c rune) bool { return c != '\n' && (c < 0x20 || c == 0x7f || c >= 0x80 && c < 0xa0) }) {
				t.Errorf("a control character is left: %q", s)
			}
		}
	}
	if list[0].URL != "" || list[1].URL != "https://github.com/o/r/releases/tag/v1.0.0" {
		t.Errorf("links: %q, %q", list[0].URL, list[1].URL)
	}
	if !strings.Contains(list[0].Notes, "fixed") || !strings.Contains(list[0].Notes, "\n") {
		t.Errorf("notes: %q", list[0].Notes)
	}

	// A copy cached by an older version is cleaned as it is read.
	old := `{"x/y":{"at":"` + time.Now().UTC().Format(time.RFC3339) + `","releases":[{"tag":"v9\u001b[2J","url":"javascript:alert(1)"}]}}`
	if err := os.WriteFile(path, []byte(old), 0o644); err != nil {
		t.Fatal(err)
	}
	list, _ = List(context.Background(), path, "x/y")
	if len(list) != 1 || list[0].Tag != "v9[2J" || list[0].URL != "" {
		t.Errorf("cached: %+v", list)
	}

	for _, label := range []string{"https://github.com/../orgs", "https://github.com/o/..", "https://github.com/./x"} {
		if got := Repo("", "img:1", map[string]string{"org.opencontainers.image.source": label}); got != "" {
			t.Errorf("%s names %q", label, got)
		}
	}
}
