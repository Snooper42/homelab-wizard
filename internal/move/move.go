// Package move packs a homelab into one file on the machine it leaves and
// unpacks it on the one it moves to: the settings, every app's data
// folders, and the newest database dumps and volume archives. The photos
// and media stay on their drive, which moves with them.
package move

import (
	"archive/tar"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// ManifestName is the bundle's first entry, and where move in keeps it.
const ManifestName = "homelab-move.json"

// Manifest says where a bundle came from and what ran there.
type Manifest struct {
	Made    time.Time `json:"made"`
	From    string    `json:"from"`    // the machine it left
	Version string    `json:"version"` // the homelab's version there
	Apps    []string  `json:"apps"`    // the apps that ran, to start again
}

// Folders are what a bundle holds, relative to the homelab folder.
var Folders = []string{".env", "data", "appdata", "stacks/custom", "recovery-staging/secrets"}

// Newest are the folders whose subfolders each keep only their newest
// file in a bundle (dumps and archives, one per app or volume).
var Newest = []string{"recovery-staging/databases", "recovery-staging/volumes"}

// skip are paths a bundle leaves out: things made again on the new machine.
func skip(rel string) bool {
	return rel == filepath.Join("data", ManifestName)
}

// Result is what Pack wrote.
type Result struct {
	Files   int
	Size    int64
	Skipped []string // unreadable files, left out
}

// Pack writes the bundle for the homelab at root to w.
func Pack(root string, m Manifest, w io.Writer) (Result, error) {
	var r Result
	tw := tar.NewWriter(w)
	data, _ := json.MarshalIndent(m, "", "  ")
	if err := tw.WriteHeader(&tar.Header{Name: ManifestName, Mode: 0o600, Size: int64(len(data)), ModTime: m.Made, Typeflag: tar.TypeReg}); err != nil {
		return r, err
	}
	if _, err := tw.Write(data); err != nil {
		return r, err
	}
	var paths []string
	for _, f := range Folders {
		paths = append(paths, filepath.Join(root, f))
	}
	for _, f := range Newest {
		subs, _ := os.ReadDir(filepath.Join(root, f))
		for _, s := range subs {
			if n := newestFile(filepath.Join(root, f, s.Name())); n != "" {
				paths = append(paths, n)
			}
		}
	}
	for _, p := range paths {
		if _, err := os.Lstat(p); errors.Is(err, fs.ErrNotExist) {
			continue
		}
		err := filepath.WalkDir(p, func(path string, d fs.DirEntry, err error) error {
			rel, _ := filepath.Rel(root, path)
			if err != nil {
				r.Skipped = append(r.Skipped, rel)
				if d != nil && d.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			if skip(rel) {
				if d.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			return addEntry(tw, path, filepath.ToSlash(rel), d, &r)
		})
		if err != nil {
			return r, err
		}
	}
	return r, tw.Close()
}

func addEntry(tw *tar.Writer, path, name string, d fs.DirEntry, r *Result) error {
	info, err := d.Info()
	if err != nil {
		r.Skipped = append(r.Skipped, name)
		return nil
	}
	link := ""
	switch {
	case info.Mode()&fs.ModeSymlink != 0:
		if link, err = os.Readlink(path); err != nil {
			r.Skipped = append(r.Skipped, name)
			return nil
		}
	case !info.IsDir() && !info.Mode().IsRegular():
		return nil // sockets and pipes are made again by their apps
	}
	h, err := tar.FileInfoHeader(info, link)
	if err != nil {
		return err
	}
	h.Name = name
	h.Uname, h.Gname = "", ""
	if info.IsDir() {
		h.Name += "/"
		return tw.WriteHeader(h)
	}
	if !info.Mode().IsRegular() {
		return tw.WriteHeader(h)
	}
	f, err := os.Open(path)
	if err != nil {
		r.Skipped = append(r.Skipped, name)
		return nil
	}
	defer f.Close()
	if err := tw.WriteHeader(h); err != nil {
		return err
	}
	n, err := io.Copy(tw, f)
	if err != nil {
		return fmt.Errorf("%s: %w", name, err)
	}
	r.Files++
	r.Size += n
	return nil
}

// newestFile is the newest regular file in dir, "" for none.
func newestFile(dir string) string {
	entries, _ := os.ReadDir(dir)
	var files []fs.FileInfo
	for _, e := range entries {
		if info, err := e.Info(); err == nil && info.Mode().IsRegular() && !strings.HasPrefix(e.Name(), ".") {
			files = append(files, info)
		}
	}
	if len(files) == 0 {
		return ""
	}
	sort.Slice(files, func(i, j int) bool { return files[i].ModTime().After(files[j].ModTime()) })
	return filepath.Join(dir, files[0].Name())
}

// ReadManifest reads a bundle's manifest, its first entry.
func ReadManifest(path string) (Manifest, error) {
	var m Manifest
	f, err := os.Open(path)
	if err != nil {
		return m, err
	}
	defer f.Close()
	tr := tar.NewReader(f)
	h, err := tr.Next()
	if err != nil || h.Name != ManifestName {
		return m, fmt.Errorf("%s is not a homelab move file (homelab move out makes one)", filepath.Base(path))
	}
	return m, json.NewDecoder(tr).Decode(&m)
}

// LoadKept reads the manifest move in keeps in data/homelab-move.json
// until the move is done.
func LoadKept(path string) (Manifest, error) {
	var m Manifest
	data, err := os.ReadFile(path)
	if err != nil {
		return m, err
	}
	return m, json.Unmarshal(data, &m)
}

// Unpack writes the bundle into root, keeping the manifest as
// data/homelab-move.json. Names that would land outside root are refused.
func Unpack(path, root string) (Manifest, int, error) {
	var m Manifest
	f, err := os.Open(path)
	if err != nil {
		return m, 0, err
	}
	defer f.Close()
	tr := tar.NewReader(f)
	n := 0
	for {
		h, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return m, n, err
		}
		name := filepath.FromSlash(strings.TrimSuffix(h.Name, "/"))
		if h.Name == ManifestName {
			if err := json.NewDecoder(tr).Decode(&m); err != nil {
				return m, n, fmt.Errorf("the move file's manifest: %w", err)
			}
			name = filepath.Join("data", ManifestName)
			data, _ := json.MarshalIndent(m, "", "  ")
			if err := writeFile(filepath.Join(root, name), 0o600, h.ModTime, strings.NewReader(string(data))); err != nil {
				return m, n, err
			}
			continue
		}
		if !filepath.IsLocal(name) {
			return m, n, fmt.Errorf("the move file holds %q, outside the homelab folder", h.Name)
		}
		target := filepath.Join(root, name)
		switch h.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, fs.FileMode(h.Mode)&fs.ModePerm|0o700); err != nil {
				return m, n, err
			}
		case tar.TypeSymlink:
			_ = os.MkdirAll(filepath.Dir(target), 0o755)
			_ = os.Remove(target)
			if err := os.Symlink(h.Linkname, target); err != nil {
				return m, n, err
			}
		case tar.TypeReg:
			if err := writeFile(target, fs.FileMode(h.Mode)&fs.ModePerm, h.ModTime, tr); err != nil {
				return m, n, err
			}
			n++
		}
	}
	if m.Made.IsZero() {
		return m, n, errors.New("the move file has no manifest (homelab move out makes one)")
	}
	return m, n, nil
}

func writeFile(path string, mode fs.FileMode, when time.Time, r io.Reader) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, mode|0o200)
	if err != nil {
		return err
	}
	_, err = io.Copy(f, r)
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return err
	}
	_ = os.Chmod(path, mode)
	return os.Chtimes(path, when, when)
}
