package media

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

// ffmpeg.json, what Tidy Up fetched and from where, is replaced whole:
// one read half-written says no ffmpeg was fetched, and preflight would
// offer to fetch it again.
func TestTheFetchedNoteIsReplacedWhole(t *testing.T) {
	archive := zipOf(t, map[string]string{"ffmpeg": "the ffmpeg", "ffprobe": "the ffprobe"})
	srv := serve(t, archive)
	pin := Pin{Version: "7.1", Source: "example.org", Licence: "GPL",
		Assets: []Asset{{URL: srv.URL + "/ffmpeg.zip", SHA256: sum(archive), Size: int64(len(archive)), Take: []string{"ffmpeg", "ffprobe"}}}}
	home := t.TempDir()
	opts := FetchOptions{Client: srv.Client(), Works: func(context.Context, string) error { return nil }}
	if err := Fetch(context.Background(), home, "darwin", pin, opts); err != nil {
		t.Fatal(err)
	}
	note := filepath.Join(BinDir(home), "ffmpeg.json")
	was, err := os.Stat(note)
	if err != nil {
		t.Fatal(err)
	}
	if err := Fetch(context.Background(), home, "darwin", pin, opts); err != nil {
		t.Fatal(err)
	}
	now, err := os.Stat(note)
	if err != nil {
		t.Fatal(err)
	}
	if os.SameFile(was, now) {
		t.Error("ffmpeg.json was rewritten in place")
	}
}
