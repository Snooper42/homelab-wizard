package media

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// zipOf is an archive holding each file under a folder, as the publishers' are.
func zipOf(t *testing.T, files map[string]string) []byte {
	t.Helper()
	var b bytes.Buffer
	z := zip.NewWriter(&b)
	for name, body := range files {
		w, err := z.Create("ffmpeg-7.1-build/bin/" + name)
		if err != nil {
			t.Fatal(err)
		}
		w.Write([]byte(body))
	}
	z.Close()
	return b.Bytes()
}

func sum(b []byte) string { h := sha256.Sum256(b); return hex.EncodeToString(h[:]) }

func serve(t *testing.T, body []byte) *httptest.Server {
	t.Helper()
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write(body) }))
	t.Cleanup(srv.Close)
	return srv
}

func TestFetchKeepsOnlyTheCheckedBuild(t *testing.T) {
	archive := zipOf(t, map[string]string{"ffmpeg": "the ffmpeg", "ffprobe": "the ffprobe", "ffplay": "not taken"})
	srv := serve(t, archive)
	good := Pin{Version: "7.1", Source: "example.org", Licence: "GPL",
		Assets: []Asset{{URL: srv.URL + "/ffmpeg.zip", SHA256: sum(archive), Size: int64(len(archive)), Take: []string{"ffmpeg", "ffprobe"}}}}
	home := t.TempDir()
	dir := BinDir(home)
	leftovers := func() []string { m, _ := filepath.Glob(filepath.Join(dir, ".fetch-*")); return m }

	// Not the pinned build: nothing changes, what was there stays.
	os.MkdirAll(dir, 0o755)
	os.WriteFile(filepath.Join(dir, "ffmpeg"), []byte("the old one"), 0o755)
	bad := good
	bad.Assets = []Asset{good.Assets[0]}
	bad.Assets[0].SHA256 = strings.Repeat("0", 64)
	err := Fetch(context.Background(), home, "darwin", bad, FetchOptions{Client: srv.Client()})
	if !errors.Is(err, ErrChecksum) || !strings.Contains(err.Error(), "nothing was installed") {
		t.Fatalf("a download that isn't the pinned one: %v", err)
	}
	if b, _ := os.ReadFile(filepath.Join(dir, "ffmpeg")); string(b) != "the old one" {
		t.Errorf("the old ffmpeg was replaced: %q", b)
	}
	if _, err := os.Stat(filepath.Join(dir, "ffprobe")); err == nil {
		t.Error("ffprobe was kept from a build that didn't check out")
	}

	// Checked, but it doesn't run here: nothing kept either.
	err = Fetch(context.Background(), home, "darwin", good, FetchOptions{Client: srv.Client(), Works: func(context.Context, string) error { return errors.New("bad CPU type") }})
	if err == nil || !strings.Contains(err.Error(), "doesn't run on this machine") {
		t.Fatalf("an ffmpeg that doesn't run: %v", err)
	}
	if b, _ := os.ReadFile(filepath.Join(dir, "ffmpeg")); string(b) != "the old one" {
		t.Errorf("a build that doesn't run replaced the old one: %q", b)
	}

	// The pinned build: ffmpeg and ffprobe, runnable, and where they came from.
	var ran string
	var last [2]int64
	err = Fetch(context.Background(), home, "darwin", good, FetchOptions{Client: srv.Client(),
		Works:    func(_ context.Context, ffmpeg string) error { ran = ffmpeg; return nil },
		Progress: func(done, total int64) { last = [2]int64{done, total} }})
	if err != nil {
		t.Fatal(err)
	}
	for name, want := range map[string]string{"ffmpeg": "the ffmpeg", "ffprobe": "the ffprobe"} {
		p := filepath.Join(dir, name)
		b, _ := os.ReadFile(p)
		fi, _ := os.Stat(p)
		// Runnable: Windows keeps no such bit (an .exe runs by its name).
		if string(b) != want || fi == nil || runtime.GOOS != "windows" && fi.Mode()&0o100 == 0 {
			t.Errorf("%s: %q %v", name, b, fi)
		}
	}
	if _, err := os.Stat(filepath.Join(dir, "ffplay")); err == nil {
		t.Error("a program not asked for was kept")
	}
	if filepath.Base(ran) != "ffmpeg" || filepath.Dir(ran) == dir {
		t.Errorf("the new ffmpeg runs before it is put in place: %s", ran)
	}
	if last[0] != int64(len(archive)) || last[1] != int64(len(archive)) {
		t.Errorf("progress ends at %v", last)
	}
	if rec, ok := FetchedRecord(home); !ok || rec.Version != "7.1" || rec.Source != "example.org" || len(rec.URLs) != 1 {
		t.Errorf("record: %+v %v", rec, ok)
	}
	if l := leftovers(); len(l) != 0 {
		t.Errorf("left behind: %v", l)
	}

	// A program missing from the archive: said, nothing kept.
	none := good
	none.Assets = []Asset{good.Assets[0]}
	none.Assets[0].Take = []string{"ffmpeg", "ffprobe", "ffserver"}
	if err := Fetch(context.Background(), t.TempDir(), "darwin", none, FetchOptions{Client: srv.Client()}); err == nil || !strings.Contains(err.Error(), "no ffserver in it") {
		t.Errorf("a missing program: %v", err)
	}
}

func TestFetchStopsAtMoreThanPinned(t *testing.T) {
	body := bytes.Repeat([]byte("x"), 3<<20)
	srv := serve(t, body)
	pin := Pin{Assets: []Asset{{URL: srv.URL + "/big.zip", SHA256: sum(body), Size: 1000, Take: []string{"ffmpeg"}}}}
	if err := Fetch(context.Background(), t.TempDir(), "linux", pin, FetchOptions{Client: srv.Client()}); !errors.Is(err, ErrChecksum) {
		t.Errorf("a download far over its pinned size: %v", err)
	}
}

func TestFFmpegPin(t *testing.T) {
	saved := FFmpegPins
	t.Cleanup(func() { FFmpegPins = saved })
	sha := strings.Repeat("a", 64)
	FFmpegPins = map[string]Pin{
		"darwin/arm64":  {Version: "7.1", Assets: []Asset{{URL: "https://example.org/ffmpeg.zip", SHA256: sha, Take: []string{"ffmpeg"}}, {URL: "https://example.org/ffprobe.zip", SHA256: sha, Take: []string{"ffprobe"}}}},
		"darwin/amd64":  {Assets: []Asset{{URL: "http://example.org/ffmpeg.zip", SHA256: sha, Take: []string{"ffmpeg", "ffprobe"}}}},
		"linux/amd64":   {Assets: []Asset{{URL: "https://example.org/ffmpeg.zip", SHA256: "abc", Take: []string{"ffmpeg", "ffprobe"}}}},
		"linux/arm64":   {Assets: []Asset{{URL: "https://example.org/ffmpeg.zip", SHA256: sha, Take: []string{"ffmpeg"}}}},
		"windows/amd64": {Assets: []Asset{{URL: "https://example.org/ffmpeg.zip", SHA256: sha, Take: []string{"ffmpeg", "ffprobe"}}}},
	}
	for key, want := range map[string]bool{"darwin/arm64": true, "darwin/amd64": false, "linux/amd64": false, "linux/arm64": false, "windows/amd64": false, "freebsd/amd64": false} {
		goos, goarch, _ := strings.Cut(key, "/")
		if _, ok := FFmpegPin(goos, goarch); ok != want {
			t.Errorf("%s: %v (only https, a whole SHA-256, and both programs, .exe on Windows)", key, ok)
		}
	}
	if p, _ := FFmpegPin("darwin", "arm64"); p.Size() != 0 {
		t.Errorf("size: %d", p.Size())
	}
}

// Every pin that ships is whole: https, a SHA-256, a size, ffmpeg and ffprobe.
func TestShippedPins(t *testing.T) {
	for key := range FFmpegPins {
		goos, goarch, _ := strings.Cut(key, "/")
		p, ok := FFmpegPin(goos, goarch)
		if !ok || p.Version == "" || p.Source == "" || p.Licence == "" || p.Size() == 0 {
			t.Errorf("%s: an unusable pin: %+v", key, FFmpegPins[key])
		}
	}
}
