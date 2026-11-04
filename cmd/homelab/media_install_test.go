package main

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/media"
)

// Install's Install button: a preview says what and from whom, and fetches
// nothing; --yes fetches the pinned build, with its progress as events.
func TestMediaInstallFFmpeg(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	var b bytes.Buffer
	z := zip.NewWriter(&b)
	for _, name := range []string{"ffmpeg", "ffprobe"} {
		if runtime.GOOS == "windows" {
			name += ".exe"
		}
		w, _ := z.Create("build/bin/" + name)
		w.Write([]byte("#!/bin/sh\n"))
	}
	z.Close()
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write(b.Bytes()) }))
	defer srv.Close()
	h := sha256.Sum256(b.Bytes())
	take := []string{"ffmpeg", "ffprobe"}
	if runtime.GOOS == "windows" {
		take = []string{"ffmpeg.exe", "ffprobe.exe"}
	}
	pin := media.Pin{Version: "7.1", Source: "builds.example.org", Licence: "GPL",
		Assets: []media.Asset{{URL: srv.URL + "/ffmpeg.zip", SHA256: hex.EncodeToString(h[:]), Size: int64(b.Len()), Take: take}}}
	savedPin, savedClient, savedWorks := mediaPin, mediaClient, mediaWorks
	t.Cleanup(func() { mediaPin, mediaClient, mediaWorks = savedPin, savedClient, savedWorks })
	mediaPin = func() (media.Pin, bool) { return pin, true }
	mediaClient = srv.Client()
	ran := 0
	mediaWorks = func(context.Context, string) error { ran++; return nil }

	root, _ := repoCopy(t)
	ffmpeg := filepath.Join(media.BinDir(home), take[0])
	out, code := homelabCmd(t, root, "", "media", "install", "ffmpeg")
	if code != 0 || !strings.Contains(out, "ffmpeg 7.1 from builds.example.org") || !strings.Contains(out, "Preview only") {
		t.Fatalf("the preview: exit %d\n%s", code, out)
	}
	if _, err := os.Stat(ffmpeg); err == nil || ran != 0 {
		t.Fatal("the preview fetched it")
	}
	out, code = homelabCmd(t, root, "", "media", "install", "ffmpeg", "--events", "json", "--yes")
	if code != 0 || !strings.Contains(out, `"type":"progress"`) || !strings.Contains(out, `"text":"ffmpeg 7.1 is ready: Tidy Up uses it from now on"`) {
		t.Fatalf("exit %d\n%s", code, out)
	}
	if _, err := os.Stat(ffmpeg); err != nil || ran != 1 {
		t.Errorf("not fetched (%v), or not run first (%d)", err, ran)
	}
	if out, code := homelabCmd(t, root, "", "media", "install", "beets"); code == 0 || !strings.Contains(out, "only one it fetches is ffmpeg") {
		t.Errorf("exit %d\n%s", code, out)
	}
	mediaPin = func() (media.Pin, bool) { return media.Pin{}, false }
	if out, code := homelabCmd(t, root, "", "media", "install", "ffmpeg", "--yes"); code == 0 || !strings.Contains(out, "no ffmpeg build is pinned") {
		t.Errorf("nothing pinned here: exit %d\n%s", code, out)
	}
}
