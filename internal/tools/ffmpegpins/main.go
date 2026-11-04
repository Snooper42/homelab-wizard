// Command ffmpegpins writes internal/media/ffmpeg-pins.json: for each system
// Tidy Up's Install serves, the build it fetches, followed from the
// publisher's "latest" link to the versioned file it points at, downloaded
// once here so its SHA-256 and size are the real ones, and checked to hold
// ffmpeg and ffprobe. A system whose publisher can't be reached is left as
// it was in the file, and said; nothing is made up.
//
//	go run ./internal/tools/ffmpegpins [-only darwin/arm64] [-o internal/media/ffmpeg-pins.json]
//
// Bump the pins this way for a new ffmpeg (or a security fix), then run
// `go test ./internal/media` and try Install on each system.
package main

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/media"
)

// source is where one system's build comes from: a link per archive, which
// may redirect (to the versioned file), and the programs in each.
type source struct {
	Publisher, Licence string
	Archives           []archive
}

type archive struct {
	Start string
	Take  []string
}

// Martin Riedl's builds for macOS and Linux (signed and notarized on macOS,
// one zip per program); Gyan Doshi's "essentials" for Windows, from its
// GitHub releases (the build ffmpeg.org links for Windows). Both GPL.
func riedl(osName, arch string) source {
	base := "https://ffmpeg.martin-riedl.de/redirect/latest/" + osName + "/" + arch + "/release/"
	return source{Publisher: "ffmpeg.martin-riedl.de", Licence: "GPL",
		Archives: []archive{{Start: base + "ffmpeg.zip", Take: []string{"ffmpeg"}}, {Start: base + "ffprobe.zip", Take: []string{"ffprobe"}}}}
}

var sources = map[string]source{
	"darwin/arm64": riedl("macos", "arm64"),
	"darwin/amd64": riedl("macos", "amd64"),
	"linux/amd64":  riedl("linux", "amd64"),
	"linux/arm64":  riedl("linux", "arm64"),
	"windows/amd64": {Publisher: "github.com/GyanD/codexffmpeg", Licence: "GPL",
		Archives: []archive{{Start: "gyan:", Take: []string{"ffmpeg.exe", "ffprobe.exe"}}}},
}

// The version in a build's link: Riedl's ".../1729955588_7.1/ffmpeg.zip",
// Gyan's ".../download/7.1.1/ffmpeg-7.1.1-essentials_build.zip".
var versionIn = regexp.MustCompile(`[/_-]v?(\d+\.\d+(?:\.\d+)?)(?:[/_-]|$)`)

func main() {
	only := flag.String("only", "", "one system, as goos/goarch")
	out := flag.String("o", "internal/media/ffmpeg-pins.json", "the file to write")
	flag.Parse()
	pins := map[string]media.Pin{}
	if data, err := os.ReadFile(*out); err == nil {
		_ = json.Unmarshal(data, &pins)
	}
	client := &http.Client{Timeout: 20 * time.Minute}
	keys := make([]string, 0, len(sources))
	for k := range sources {
		if *only == "" || *only == k {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)
	failed := 0
	for _, k := range keys {
		p, err := pinOf(client, sources[k])
		if err != nil {
			failed++
			fmt.Fprintf(os.Stderr, "✗ %s: %v (left as it was)\n", k, err)
			continue
		}
		pins[k] = p
		fmt.Printf("✓ %s: ffmpeg %s from %s, %d MB\n", k, p.Version, p.Source, p.Size()>>20)
	}
	data, _ := json.MarshalIndent(pins, "", "  ")
	if err := os.WriteFile(*out, append(data, '\n'), 0o644); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if failed > 0 {
		os.Exit(1)
	}
}

// pinOf follows each archive's link, downloads it, and pins what came.
func pinOf(client *http.Client, s source) (media.Pin, error) {
	p := media.Pin{Source: s.Publisher, Licence: s.Licence}
	for _, a := range s.Archives {
		start := a.Start
		if start == "gyan:" {
			tag, err := latestTag(client, "https://github.com/GyanD/codexffmpeg/releases/latest")
			if err != nil {
				return p, err
			}
			start = fmt.Sprintf("https://github.com/GyanD/codexffmpeg/releases/download/%s/ffmpeg-%s-essentials_build.zip", tag, tag)
		}
		asset, version, err := fetchPin(client, start, a.Take)
		if err != nil {
			return p, err
		}
		if p.Version != "" && version != p.Version {
			return p, fmt.Errorf("ffmpeg is %s and ffprobe %s: not one build", p.Version, version)
		}
		p.Version = version
		p.Assets = append(p.Assets, asset)
	}
	return p, nil
}

// latestTag is the tag a GitHub "releases/latest" link redirects to.
func latestTag(client *http.Client, url string) (string, error) {
	c := *client
	c.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	resp, err := c.Get(url)
	if err != nil {
		return "", err
	}
	resp.Body.Close()
	loc := resp.Header.Get("Location")
	if i := strings.LastIndex(loc, "/tag/"); i >= 0 && loc[i+5:] != "" {
		return loc[i+5:], nil
	}
	return "", fmt.Errorf("%s pointed at %q, not a release", url, loc)
}

// fetchPin downloads url (following its redirects), and pins the file it
// ended at: its link, SHA-256, size, and version, with take inside it.
func fetchPin(client *http.Client, url string, take []string) (media.Asset, string, error) {
	resp, err := client.Get(url)
	if err != nil {
		return media.Asset{}, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return media.Asset{}, "", fmt.Errorf("%s answered %s", url, resp.Status)
	}
	final := resp.Request.URL.String()
	if !strings.HasPrefix(final, "https://") {
		return media.Asset{}, "", fmt.Errorf("%s ended at %s, not https", url, final)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 400<<20))
	if err != nil {
		return media.Asset{}, "", err
	}
	z, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		return media.Asset{}, "", fmt.Errorf("%s isn't a zip: %w", final, err)
	}
	for _, name := range take {
		found := false
		for _, f := range z.File {
			found = found || path.Base(strings.ReplaceAll(f.Name, "\\", "/")) == name
		}
		if !found {
			return media.Asset{}, "", fmt.Errorf("no %s in %s", name, final)
		}
	}
	m := versionIn.FindStringSubmatch(resp.Request.URL.Path)
	if m == nil {
		return media.Asset{}, "", errors.New("no version in " + final)
	}
	h := sha256.Sum256(body)
	return media.Asset{URL: final, SHA256: hex.EncodeToString(h[:]), Size: int64(len(body)), Take: take}, m[1], nil
}
