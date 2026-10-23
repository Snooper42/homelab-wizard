// Package kit is the homelab folder as the desktop app carries it: a
// tar.gz of the repository's files (no git history, no app sources) with
// a manifest. The app creates ~/Homelab from it on a machine without git,
// and updates that folder from a newer kit, never touching settings, data,
// or your own apps, and keeping a copy of any file you changed.
package kit

import (
	"archive/tar"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
)

// FileName is the kit's name next to the app's CLI.
const FileName = "homelab-kit.tar.gz"

// ManifestName is the manifest inside the kit and, once extracted, the
// marker in the homelab folder that says the app manages it.
const ManifestName = ".homelab-kit.json"

// Manifest says where a kit came from and what is in it.
type Manifest struct {
	Version string            `json:"version"`
	Commit  string            `json:"commit"`
	Files   map[string]string `json:"files"` // path → sha256 of its contents
}

// Short is the commit's first 7 characters.
func (m Manifest) Short() string {
	if len(m.Commit) > 7 {
		return m.Commit[:7]
	}
	return m.Commit
}

// excluded are repository paths the kit leaves out: the desktop app's own
// sources and pictures, and CI. Everything the CLI and the docs need stays,
// web/ too: the CLI embeds it (the phone companion), and ./homelab builds
// the CLI from these sources where Go is installed.
var excluded = []string{"app/", "assets/", "docs/images/", ".github/", ".claude/"}

// Keep are the paths an update never writes or removes: settings, data,
// your own apps, and what the homelab makes as it runs.
var Keep = []string{".env", "data/", "appdata/", "recovery-staging/", "backups/", "scripts/logs/", "bin/", "stacks/custom/", "build/", "dist/"}

func kept(p string) bool {
	for _, k := range Keep {
		if p == k || strings.HasSuffix(k, "/") && strings.HasPrefix(p, k) {
			return true
		}
	}
	return false
}

// Included reports whether a repository file belongs in the kit.
func Included(p string) bool {
	if kept(p) || p == ManifestName {
		return false
	}
	for _, e := range excluded {
		if strings.HasPrefix(p, e) {
			return false
		}
	}
	return true
}

// Pack writes a kit of files (paths relative to root, slash-separated) to
// w. Files outside the kit are skipped.
func Pack(w io.Writer, root string, files []string, version, commit string) (Manifest, error) {
	m := Manifest{Version: version, Commit: commit, Files: map[string]string{}}
	gz := gzip.NewWriter(w)
	tw := tar.NewWriter(gz)
	sort.Strings(files)
	for _, f := range files {
		if !Included(f) {
			continue
		}
		full := filepath.Join(root, filepath.FromSlash(f))
		fi, err := os.Lstat(full)
		if err != nil || !fi.Mode().IsRegular() {
			continue // removed in the working tree, or a link
		}
		data, err := os.ReadFile(full)
		if err != nil {
			return m, err
		}
		mode := int64(0o644)
		if fi.Mode()&0o111 != 0 {
			mode = 0o755
		}
		if err := tw.WriteHeader(&tar.Header{Name: f, Mode: mode, Size: int64(len(data)), ModTime: fi.ModTime(), Typeflag: tar.TypeReg}); err != nil {
			return m, err
		}
		if _, err := tw.Write(data); err != nil {
			return m, err
		}
		m.Files[f] = sum(data)
	}
	data, _ := json.MarshalIndent(m, "", "  ")
	if err := tw.WriteHeader(&tar.Header{Name: ManifestName, Mode: 0o644, Size: int64(len(data)), Typeflag: tar.TypeReg}); err != nil {
		return m, err
	}
	if _, err := tw.Write(data); err != nil {
		return m, err
	}
	if err := tw.Close(); err != nil {
		return m, err
	}
	return m, gz.Close()
}

func sum(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}

// entry is one file read from a kit.
type entry struct {
	name string
	mode os.FileMode
	data []byte
}

// read loads a kit: its manifest and files.
func read(archive string) (Manifest, []entry, error) {
	var m Manifest
	f, err := os.Open(archive)
	if err != nil {
		return m, nil, err
	}
	defer f.Close()
	gz, err := gzip.NewReader(f)
	if err != nil {
		return m, nil, fmt.Errorf("%s: %w", filepath.Base(archive), err)
	}
	tr := tar.NewReader(gz)
	var files []entry
	for {
		h, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return m, nil, fmt.Errorf("%s: %w", filepath.Base(archive), err)
		}
		if h.Typeflag != tar.TypeReg {
			continue
		}
		name := path.Clean(h.Name)
		if name == ".." || strings.HasPrefix(name, "../") || path.IsAbs(name) {
			return m, nil, fmt.Errorf("%s: unsafe path %q", filepath.Base(archive), h.Name)
		}
		data, err := io.ReadAll(io.LimitReader(tr, 64<<20))
		if err != nil {
			return m, nil, err
		}
		if name == ManifestName {
			if err := json.Unmarshal(data, &m); err != nil {
				return m, nil, fmt.Errorf("%s: manifest: %w", filepath.Base(archive), err)
			}
			continue
		}
		files = append(files, entry{name, os.FileMode(h.Mode) & 0o755, data}) // #nosec G115 -- masked to the permission bits
	}
	if m.Commit == "" {
		return m, nil, fmt.Errorf("%s has no manifest: not a homelab kit", filepath.Base(archive))
	}
	return m, files, nil
}

// ReadFile is one file from a kit.
func ReadFile(archive, name string) ([]byte, error) {
	_, files, err := read(archive)
	if err != nil {
		return nil, err
	}
	for _, e := range files {
		if e.name == name {
			return e.data, nil
		}
	}
	return nil, fmt.Errorf("%s has no %s", filepath.Base(archive), name)
}

// Info reads a kit's manifest.
func Info(archive string) (Manifest, error) {
	m, _, err := read(archive)
	return m, err
}

// Installed reads the manifest of the kit a homelab folder was made from;
// ok is false for a folder the app does not manage (a git checkout).
func Installed(root string) (Manifest, bool) {
	var m Manifest
	data, err := os.ReadFile(filepath.Join(root, ManifestName))
	if err != nil || json.Unmarshal(data, &m) != nil || m.Commit == "" {
		return m, false
	}
	return m, true
}

// Extract creates a homelab folder at dest from a kit. dest must not exist
// or be empty.
func Extract(archive, dest string) (Manifest, error) {
	m, files, err := read(archive)
	if err != nil {
		return m, err
	}
	if entries, err := os.ReadDir(dest); err == nil && len(entries) > 0 {
		return m, fmt.Errorf("%s already has files in it; choose it as the homelab folder instead, or pick an empty one", dest)
	}
	for _, e := range files {
		if err := write(dest, e); err != nil {
			return m, err
		}
	}
	return m, writeManifest(dest, m)
}

// Change is what an update did to one file.
type Change struct {
	Path string
	What string // "added", "updated", "removed", or "kept your copy as <path>.local"
}

// Update brings a folder made from a kit up to a newer kit. Files you
// changed since the last kit are saved beside it as <file>.local before
// the new version is written; files the new kit no longer has are removed
// unless you changed them. Settings, data, and your own apps are never
// touched.
func Update(archive, root string) (Manifest, []Change, error) {
	old, ok := Installed(root)
	if !ok {
		return old, nil, errors.New("this homelab folder was not made by the app (it is a git checkout): update it with homelab upgrade")
	}
	m, files, err := read(archive)
	if err != nil {
		return m, nil, err
	}
	var changes []Change
	changed := func(p string) bool {
		data, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(p)))
		return err == nil && sum(data) != old.Files[p]
	}
	saveLocal := func(p string) error {
		src := filepath.Join(root, filepath.FromSlash(p))
		data, err := os.ReadFile(src)
		if err != nil {
			return err
		}
		return os.WriteFile(src+".local", data, 0o644)
	}
	for _, e := range files {
		if kept(e.name) {
			continue
		}
		current, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(e.name)))
		switch {
		case err != nil:
			changes = append(changes, Change{e.name, "added"})
		case sum(current) == sum(e.data):
			continue
		case old.Files[e.name] != "" && changed(e.name):
			if err := saveLocal(e.name); err != nil {
				return m, changes, err
			}
			changes = append(changes, Change{e.name, "kept your copy as " + e.name + ".local"})
		default:
			changes = append(changes, Change{e.name, "updated"})
		}
		if err := write(root, e); err != nil {
			return m, changes, err
		}
	}
	for p := range old.Files {
		if _, still := m.Files[p]; still || kept(p) {
			continue
		}
		full := filepath.Join(root, filepath.FromSlash(p))
		if _, err := os.Stat(full); err != nil {
			continue
		}
		if changed(p) {
			if err := saveLocal(p); err != nil {
				return m, changes, err
			}
		}
		if err := os.Remove(full); err != nil {
			return m, changes, err
		}
		changes = append(changes, Change{p, "removed"})
	}
	sort.Slice(changes, func(i, j int) bool { return changes[i].Path < changes[j].Path })
	return m, changes, writeManifest(root, m)
}

func write(root string, e entry) error {
	full := filepath.Join(root, filepath.FromSlash(e.name))
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		return err
	}
	mode := os.FileMode(0o644)
	if e.mode&0o111 != 0 {
		mode = 0o755
	}
	tmp := full + ".kit-tmp"
	if err := os.WriteFile(tmp, e.data, mode); err != nil {
		return err
	}
	return os.Rename(tmp, full)
}

func writeManifest(root string, m Manifest) error {
	data, _ := json.MarshalIndent(m, "", "  ")
	return os.WriteFile(filepath.Join(root, ManifestName), data, 0o644)
}

// Bundled is the kit that ships with the desktop app: in the bundle's
// Resources on macOS, next to the program on Windows, in
// share/homelab-wizard on Linux (and in the AppImage). "" when this
// program came without one (a source build).
func Bundled() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	if real, err := filepath.EvalSymlinks(exe); err == nil {
		exe = real
	}
	dir := filepath.Dir(exe)
	for _, p := range []string{filepath.Join(dir, FileName), filepath.Join(dir, "..", "Resources", FileName), filepath.Join(dir, "..", "share", "homelab-wizard", FileName)} {
		if fi, err := os.Stat(p); err == nil && fi.Mode().IsRegular() {
			return p
		}
	}
	return ""
}

// Edited lists the kit's files changed in root since it was extracted or
// last updated.
func Edited(root string, m Manifest) []string {
	var out []string
	for p, want := range m.Files {
		data, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(p)))
		if err == nil && sum(data) != want {
			out = append(out, p)
		}
	}
	sort.Strings(out)
	return out
}
