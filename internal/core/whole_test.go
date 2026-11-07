package core

import (
	"os"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// The note of the last Docker read that went back to the CLI is replaced
// whole, never rewritten in place: the app reads it for Status's note.
func TestTheAPIFallbackNoteIsReplacedWhole(t *testing.T) {
	root := t.TempDir()
	if err := SaveAPIFallback(root, docker.Fallback{When: time.Now(), Read: "containers"}); err != nil {
		t.Fatal(err)
	}
	was, err := statNow(apiFallbackPath(root))
	if err != nil {
		t.Fatal(err)
	}
	if err := SaveAPIFallback(root, docker.Fallback{When: time.Now(), Read: "info"}); err != nil {
		t.Fatal(err)
	}
	now, err := os.Stat(apiFallbackPath(root))
	if err != nil {
		t.Fatal(err)
	}
	if os.SameFile(was, now) {
		t.Error("docker-api.json was rewritten in place")
	}
}

// statNow stats the file at path as it is now. os.Stat on Windows reads
// the file's identity only when SameFile asks, by path, so it would see
// whatever file is there by then; a stat through an open file reads it at
// once.
func statNow(path string) (os.FileInfo, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return f.Stat()
}
