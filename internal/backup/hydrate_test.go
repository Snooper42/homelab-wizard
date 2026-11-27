package backup

import (
	"context"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// A cloud drive's placeholders are read through here before a restore reads
// the folder from inside Docker (ISSUE-0003); files already here are not read
// again, and a drive that never hands one over fails with what to do.
func TestHydrate(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"duplicati-1.dblock.zip.aes", "duplicati-2.dblock.zip.aes", "sub/duplicati-3.dindex.zip.aes"} {
		p := filepath.Join(dir, filepath.FromSlash(name))
		_ = os.MkdirAll(filepath.Dir(p), 0o755)
		if err := os.WriteFile(p, []byte("block"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	placeholder := func(fi fs.FileInfo) bool { return !strings.HasPrefix(fi.Name(), "duplicati-1") }
	n, err := Hydrate(context.Background(), dir, placeholder, time.Second)
	if err != nil || n != 2 {
		t.Fatalf("read %d, %v; want the 2 placeholders", n, err)
	}
	if n, err := Hydrate(context.Background(), dir, func(fs.FileInfo) bool { return false }, time.Second); err != nil || n != 0 {
		t.Errorf("all here: read %d, %v", n, err)
	}
	// Not on this machine (Duplicati backs up elsewhere): nothing to fetch.
	if n, err := Hydrate(context.Background(), filepath.Join(dir, "missing"), placeholder, time.Second); err != nil || n != 0 {
		t.Errorf("a folder elsewhere: %d, %v", n, err)
	}
	// One that can't be read is an error, not a whole backup.
	locked := filepath.Join(dir, "locked")
	_ = os.MkdirAll(filepath.Join(locked, "inner"), 0o755)
	_ = os.Chmod(locked, 0o000)
	t.Cleanup(func() { _ = os.Chmod(locked, 0o755) })
	if _, err := os.ReadDir(locked); err != nil { // root reads it anyway
		if _, err := Hydrate(context.Background(), locked, placeholder, time.Second); err == nil {
			t.Error("an unreadable backup folder read as fine")
		}
	}
	// This machine's own Dataless never takes an ordinary file for a placeholder.
	info, _ := os.Stat(filepath.Join(dir, "duplicati-1.dblock.zip.aes"))
	if Dataless(info) {
		t.Error("an ordinary file is a placeholder")
	}
}
