//go:build unix

package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

// tarOf is a gzipped tar of files (name → body).
func tarOf(t *testing.T, files map[string]string) []byte {
	t.Helper()
	var b bytes.Buffer
	gz := gzip.NewWriter(&b)
	tw := tar.NewWriter(gz)
	for name, body := range files {
		if err := tw.WriteHeader(&tar.Header{Name: "./" + name, Mode: 0o644, Size: int64(len(body))}); err != nil {
			t.Fatal(err)
		}
		_, _ = tw.Write([]byte(body))
	}
	_ = tw.Close()
	_ = gz.Close()
	return b.Bytes()
}

func listing(t *testing.T, dir string) string {
	t.Helper()
	var out []string
	_ = filepath.Walk(dir, func(p string, fi os.FileInfo, err error) error {
		if err == nil && !fi.IsDir() {
			rel, _ := filepath.Rel(dir, p)
			data, _ := os.ReadFile(p)
			out = append(out, rel+"="+string(data))
		}
		return nil
	})
	sort.Strings(out)
	return strings.Join(out, " ")
}

// docs/SRE-Audit-2026-11.md, M2: putting a volume back reads its archive
// whole before anything of the volume goes. An archive cut short (a full
// disk, a copy interrupted) leaves the volume as it was; a whole one
// replaces it exactly, hidden files and folders included.
func TestLoadScriptReadsTheArchiveFirst(t *testing.T) {
	load := func(dir string, archive []byte) error {
		c := exec.Command("sh", "-c", loadScript, "sh", dir)
		c.Stdin = bytes.NewReader(archive)
		if out, err := c.CombinedOutput(); err != nil {
			return &exec.ExitError{ProcessState: c.ProcessState, Stderr: out}
		}
		return nil
	}
	dir := t.TempDir()
	for name, body := range map[string]string{"today.db": "today", ".hidden": "h", "sub/photo.heic": "p"} {
		_ = os.MkdirAll(filepath.Dir(filepath.Join(dir, name)), 0o755)
		_ = os.WriteFile(filepath.Join(dir, name), []byte(body), 0o644)
	}
	before := listing(t, dir)

	whole := tarOf(t, map[string]string{"app.db": "before the update", ".config": "c", "keep/x.txt": "x"})
	cut := whole[:len(whole)/2]
	if err := load(dir, cut); err == nil {
		t.Fatal("an archive cut short read as whole")
	}
	if got := listing(t, dir); got != before {
		t.Fatalf("an archive cut short changed the volume:\n%s\nwant\n%s", got, before)
	}
	if err := load(dir, whole); err != nil {
		t.Fatal(err)
	}
	if got, want := listing(t, dir), ".config=c app.db=before the update keep/x.txt=x"; got != want {
		t.Errorf("put back as %q, want %q", got, want)
	}
	if _, err := os.Stat(filepath.Join(dir, ".homelab-loading")); err == nil {
		t.Error("the loading folder was left")
	}
}
