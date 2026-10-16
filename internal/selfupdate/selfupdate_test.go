package selfupdate

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLatest(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/o/r/releases/tags/nightly" {
			http.NotFound(w, r)
			return
		}
		w.Write([]byte(`{"target_commitish":"main","html_url":"https://github.com/o/r/releases/tag/nightly","body":"Built from 0123456789abcdef0123456789abcdef01234567. The newest","assets":[{"name":"homelab-darwin-arm64.zip","browser_download_url":"x"},{"name":"Homelab-Wizard-macOS.dmg","browser_download_url":"https://dl/mac.dmg"}]}`))
	}))
	defer srv.Close()
	API = srv.URL
	r, err := Latest(context.Background(), "o/r")
	if err != nil {
		t.Fatal(err)
	}
	if r.Commit != "0123456789abcdef0123456789abcdef01234567" || r.MacDMG != "https://dl/mac.dmg" {
		t.Fatalf("%+v", r)
	}
	if !r.Newer("fedcba") || r.Newer("0123456789abcdef0123456789abcdef01234567") || r.Newer("") {
		t.Fatal("Newer")
	}
	if _, err := Latest(context.Background(), "o/none"); err == nil {
		t.Fatal("want an error without a release")
	}
}

func TestRepo(t *testing.T) {
	if got := Repo("https://github.com/o/r/"); got != "o/r" {
		t.Fatal(got)
	}
}
