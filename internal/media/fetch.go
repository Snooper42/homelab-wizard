package media

// Install, for ffmpeg: a machine without it (most Macs, which have no
// Homebrew) gets its own copy from one click, with no Terminal and no
// password. The copy is one pinned build per system (ffmpeg-pins.json,
// written by `go run ./internal/tools/ffmpegpins` from the publishers'
// downloads), fetched over HTTPS and checked against its pinned SHA-256
// before anything is unpacked; a file that doesn't match is thrown away
// and never run. It goes in ~/.homelab-media/bin, which the preflight and
// the engines (media_common.which) look in after PATH, so an ffmpeg
// installed another way always comes first.

import (
	"archive/zip"
	"context"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"
)

// Asset is one archive to fetch: where, its pinned SHA-256 and size, and
// the programs taken from it (matched by their name, wherever they sit in it).
type Asset struct {
	URL    string   `json:"url"`
	SHA256 string   `json:"sha256"`
	Size   int64    `json:"size"`
	Take   []string `json:"take"`
}

// Pin is the build fetched on one system: its version, who publishes it,
// its licence, and its archives.
type Pin struct {
	Version string  `json:"version"`
	Source  string  `json:"source"`
	Licence string  `json:"licence"`
	Assets  []Asset `json:"assets"`
}

//go:embed ffmpeg-pins.json
var pinsJSON []byte

// FFmpegPins is the pinned build for each "goos/goarch".
var FFmpegPins = func() map[string]Pin {
	var m map[string]Pin
	if err := json.Unmarshal(pinsJSON, &m); err != nil {
		panic("ffmpeg-pins.json: " + err.Error())
	}
	return m
}()

// FFmpegPin is the build Install fetches on goos/goarch, when one is pinned
// there: every archive with its checksum, and ffmpeg and ffprobe among them.
func FFmpegPin(goos, goarch string) (Pin, bool) {
	p, ok := FFmpegPins[goos+"/"+goarch]
	if !ok || len(p.Assets) == 0 {
		return Pin{}, false
	}
	takes := map[string]bool{}
	for _, a := range p.Assets {
		if !strings.HasPrefix(a.URL, "https://") || len(a.SHA256) != 64 {
			return Pin{}, false
		}
		for _, t := range a.Take {
			takes[t] = true
		}
	}
	return p, takes[exe(goos, "ffmpeg")] && takes[exe(goos, "ffprobe")]
}

// BinDir is where Install puts the programs it fetches.
func BinDir(home string) string { return filepath.Join(home, ".homelab-media", "bin") }

func exe(goos, name string) string {
	if goos == "windows" {
		return name + ".exe"
	}
	return name
}

// Size is what the pin downloads, in bytes.
func (p Pin) Size() int64 {
	var n int64
	for _, a := range p.Assets {
		n += a.Size
	}
	return n
}

// Fetched is the record Install keeps beside what it fetched: where it came from.
type Fetched struct {
	Version string    `json:"version"`
	Source  string    `json:"source"`
	URLs    []string  `json:"urls"`
	At      time.Time `json:"at"`
}

// FetchOptions is how Fetch reaches the network and says how far it is.
type FetchOptions struct {
	Client *http.Client
	// Progress is called as bytes arrive: so far, and in all.
	Progress func(done, total int64)
	// Works runs the fetched ffmpeg (-version) before it is kept.
	Works func(ctx context.Context, ffmpeg string) error
}

// ErrChecksum is a download that isn't the pinned build.
var ErrChecksum = errors.New("the download isn't the build this app expects")

// Fetch downloads the pin's archives into home's BinDir, checks each against
// its pinned SHA-256, takes ffmpeg and ffprobe out, and keeps them only once
// the new ffmpeg runs. Until then nothing in the folder changes: a failure at
// any step leaves what was there.
func Fetch(ctx context.Context, home, goos string, pin Pin, o FetchOptions) error {
	dir := BinDir(home)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	client := o.Client
	if client == nil {
		client = &http.Client{Timeout: 30 * time.Minute}
	}
	work, err := os.MkdirTemp(dir, ".fetch-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(work)
	total, done := pin.Size(), int64(0)
	var got []string
	for i, a := range pin.Assets {
		file := filepath.Join(work, fmt.Sprintf("%d.zip", i))
		n, err := download(ctx, client, a, file, func(k int64) {
			if o.Progress != nil {
				o.Progress(done+k, max(total, done+k))
			}
		})
		if err != nil {
			return err
		}
		done += n
		for _, name := range a.Take {
			if err := unzipOne(file, name, filepath.Join(work, name)); err != nil {
				return fmt.Errorf("%s: %w", path.Base(a.URL), err)
			}
			got = append(got, name)
		}
	}
	if o.Works != nil {
		if err := o.Works(ctx, filepath.Join(work, exe(goos, "ffmpeg"))); err != nil {
			return fmt.Errorf("the fetched ffmpeg doesn't run on this machine: %w", err)
		}
	}
	for _, name := range got {
		if err := os.Rename(filepath.Join(work, name), filepath.Join(dir, name)); err != nil {
			return err
		}
	}
	rec := Fetched{Version: pin.Version, Source: pin.Source, At: time.Now().UTC()}
	for _, a := range pin.Assets {
		rec.URLs = append(rec.URLs, a.URL)
	}
	data, _ := json.MarshalIndent(rec, "", "  ")
	return os.WriteFile(filepath.Join(dir, "ffmpeg.json"), data, 0o644)
}

// download writes a's archive to file, hashing it as it arrives; a file that
// isn't the pinned one (its checksum, or longer than pinned) is removed.
func download(ctx context.Context, client *http.Client, a Asset, file string, progress func(int64)) (int64, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, a.URL, nil)
	if err != nil {
		return 0, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("couldn't reach %s: %w", req.URL.Host, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("%s answered %s", req.URL.Host, resp.Status)
	}
	f, err := os.Create(file)
	if err != nil {
		return 0, err
	}
	h := sha256.New()
	limit := a.Size + a.Size/10 + 1<<20 // a little over the pinned size, never without end
	n, err := io.Copy(io.MultiWriter(f, h), &counting{r: io.LimitReader(resp.Body, limit+1), each: progress})
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err == nil && n > limit {
		err = ErrChecksum
	}
	if err == nil && hex.EncodeToString(h.Sum(nil)) != strings.ToLower(a.SHA256) {
		err = ErrChecksum
	}
	if err != nil {
		os.Remove(file)
		if errors.Is(err, ErrChecksum) {
			return n, fmt.Errorf("%s: %w; nothing was installed", path.Base(a.URL), err)
		}
		return n, err
	}
	return n, nil
}

type counting struct {
	r    io.Reader
	n    int64
	each func(int64)
}

func (c *counting) Read(p []byte) (int, error) {
	k, err := c.r.Read(p)
	c.n += int64(k)
	if c.each != nil && k > 0 {
		c.each(c.n)
	}
	return k, err
}

// unzipOne writes the file named name (by its base name, anywhere in the
// archive) to dest, runnable.
func unzipOne(archive, name, dest string) error {
	z, err := zip.OpenReader(archive)
	if err != nil {
		return err
	}
	defer z.Close()
	for _, f := range z.File {
		if f.FileInfo().IsDir() || path.Base(strings.ReplaceAll(f.Name, "\\", "/")) != name {
			continue
		}
		r, err := f.Open()
		if err != nil {
			return err
		}
		defer r.Close()
		out, err := os.OpenFile(dest, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o755)
		if err != nil {
			return err
		}
		// No program is bigger than this; an archive that unpacks to more is not a build.
		const most = 512 << 20
		n, err := io.CopyN(out, r, most+1)
		if err != nil && !errors.Is(err, io.EOF) {
			out.Close()
			return err
		}
		if n > most {
			out.Close()
			return fmt.Errorf("%s unpacks to more than %d MB", name, most>>20)
		}
		return out.Close()
	}
	return fmt.Errorf("no %s in it", name)
}

// FetchedRecord is what Install fetched, when it did.
func FetchedRecord(home string) (Fetched, bool) {
	var f Fetched
	data, err := os.ReadFile(filepath.Join(BinDir(home), "ffmpeg.json"))
	return f, err == nil && json.Unmarshal(data, &f) == nil
}
