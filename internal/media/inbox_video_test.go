package media

import (
	"os"
	"path/filepath"
	"testing"
)

// A sweep wakes a resting Tdarr only when a watched folder holds a video:
// in it, or a download's folder or two down; not a hidden one, nor a song.
func TestInboxHasVideo(t *testing.T) {
	dir := t.TempDir()
	put := func(rel string) {
		t.Helper()
		p := filepath.Join(dir, filepath.FromSlash(rel))
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	missing := filepath.Join(dir, "gone")
	if InboxHasVideo([]string{missing, dir}) {
		t.Fatal("an empty folder has a video")
	}
	put("Rumours/01 Dreams.flac")
	put(".partial/Heat.mkv")
	if InboxHasVideo([]string{dir}) {
		t.Fatal("a song, or a hidden folder's video, counted")
	}
	put("Show.S01.1080p/Season 1/Show.S01E01.MKV")
	if !InboxHasVideo([]string{missing, dir}) {
		t.Fatal("an episode two folders down not found")
	}
}
