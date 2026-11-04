package main

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFetchPinFollowsToTheVersionedFile(t *testing.T) {
	var b bytes.Buffer
	z := zip.NewWriter(&b)
	w, _ := z.Create("ffmpeg")
	w.Write([]byte("x"))
	z.Close()
	mux := http.NewServeMux()
	mux.HandleFunc("/redirect/latest/macos/arm64/release/ffmpeg.zip", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/download/macos/arm64/1729955588_7.1/ffmpeg.zip", http.StatusFound)
	})
	mux.HandleFunc("/download/macos/arm64/1729955588_7.1/ffmpeg.zip", func(w http.ResponseWriter, r *http.Request) { w.Write(b.Bytes()) })
	mux.HandleFunc("/releases/latest", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/GyanD/codexffmpeg/releases/tag/7.1.1", http.StatusFound)
	})
	srv := httptest.NewTLSServer(mux)
	defer srv.Close()

	a, v, err := fetchPin(srv.Client(), srv.URL+"/redirect/latest/macos/arm64/release/ffmpeg.zip", []string{"ffmpeg"})
	h := sha256.Sum256(b.Bytes())
	if err != nil || v != "7.1" || !strings.HasSuffix(a.URL, "/1729955588_7.1/ffmpeg.zip") || a.SHA256 != hex.EncodeToString(h[:]) || a.Size != int64(b.Len()) {
		t.Fatalf("%+v %q %v", a, v, err)
	}
	if _, _, err := fetchPin(srv.Client(), srv.URL+"/redirect/latest/macos/arm64/release/ffmpeg.zip", []string{"ffprobe"}); err == nil || !strings.Contains(err.Error(), "no ffprobe") {
		t.Errorf("a program missing: %v", err)
	}
	if tag, err := latestTag(srv.Client(), srv.URL+"/releases/latest"); err != nil || tag != "7.1.1" {
		t.Errorf("tag %q %v", tag, err)
	}
	for path, want := range map[string]string{"/download/7.1.1/ffmpeg-7.1.1-essentials_build.zip": "7.1.1", "/download/macos/arm64/1729955588_8.0/ffprobe.zip": "8.0"} {
		if m := versionIn.FindStringSubmatch(path); m == nil || m[1] != want {
			t.Errorf("%s: %v", path, m)
		}
	}
}
