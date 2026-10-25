package selfupdate

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestLatest(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/o/r/releases/latest" {
			http.NotFound(w, r)
			return
		}
		w.Write([]byte(`{"tag_name":"v0.9.4-beta","target_commitish":"main","html_url":"https://github.com/o/r/releases/tag/v0.9.4-beta","body":"Built from 0123456789abcdef0123456789abcdef01234567. The newest","assets":[{"name":"homelab-darwin-arm64.zip","browser_download_url":"x"},{"name":"Homelab-Wizard-macOS.dmg","browser_download_url":"https://dl/mac.dmg","digest":"sha256:abc"}]}`))
	}))
	defer srv.Close()
	API = srv.URL
	r, err := Latest(context.Background(), "o/r")
	if err != nil {
		t.Fatal(err)
	}
	if r.Version != "v0.9.4-beta" || r.Commit != "0123456789abcdef0123456789abcdef01234567" || r.MacDMG != "https://dl/mac.dmg" || r.MacSHA256 != "abc" {
		t.Fatalf("%+v", r)
	}
	if !r.Newer("fedcba") || r.Newer("0123456789abcdef0123456789abcdef01234567") || r.Newer("") {
		t.Fatal("Newer")
	}
	if _, err := Latest(context.Background(), "o/none"); err == nil {
		t.Fatal("want an error without a release")
	}
}

func TestLatestStable(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/repos/o/r/releases":
			w.Write([]byte(`[{"tag_name":"v0.6.3","assets":[]},{"tag_name":"nightly","assets":[]},{"tag_name":"v0.6.0","draft":true},{"tag_name":"v0.5.0-alpha","html_url":"https://github.com/o/r/releases/tag/v0.5.0-alpha","assets":[{"name":"Homelab-Wizard-macOS.dmg","browser_download_url":"https://dl/v5.dmg"}]}]`))
		case "/repos/o/r/commits/v0.5.0-alpha":
			if r.Header.Get("Accept") != "application/vnd.github.sha" {
				http.Error(w, "accept", 400)
				return
			}
			w.Write([]byte("abcdef0123456789abcdef0123456789abcdef01"))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	API = srv.URL
	r, err := For(context.Background(), "o/r", "stable")
	if err != nil {
		t.Fatal(err)
	}
	if r.Version != "v0.5.0-alpha" || r.Commit != "abcdef0123456789abcdef0123456789abcdef01" || r.MacDMG != "https://dl/v5.dmg" {
		t.Fatalf("%+v", r)
	}
}

func TestRepo(t *testing.T) {
	if got := Repo("https://github.com/o/r/"); got != "o/r" {
		t.Fatal(got)
	}
}

func TestVerify(t *testing.T) {
	path := filepath.Join(t.TempDir(), "f")
	os.WriteFile(path, []byte("hello"), 0o644)
	if err := verify(path, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"); err != nil {
		t.Fatal(err)
	}
	if err := verify(path, ""); err == nil {
		t.Fatal("a download without a checksum must stop the install")
	}
	if err := verify(path, "00"); err == nil {
		t.Fatal("a wrong checksum must stop the install")
	}
}

func TestNotes(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/o/r/compare/aaa...bbb" {
			http.NotFound(w, r)
			return
		}
		w.Write([]byte(`{"commits":[{"commit":{"message":"Status: what's using power (#42)\n\nbody"}},{"commit":{"message":"Merge main"}},{"commit":{"message":"Setup: turn the jobs off (#43)"}}]}`))
	}))
	defer srv.Close()
	API = srv.URL
	got := Notes(context.Background(), "o/r", "aaa", "bbb")
	if len(got) != 2 || got[0] != "Setup: turn the jobs off" || got[1] != "Status: what's using power" {
		t.Fatalf("%q", got)
	}
	if got := Notes(context.Background(), "o/r", "zzz", "bbb"); got != nil {
		t.Fatalf("unknown commit: %q", got)
	}
}
