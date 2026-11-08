package main

import (
	"os"
	"testing"
	"time"
)

// What homelab quit stopped is written before it stops anything, so a quit
// cut short still knows what to start; it is replaced whole, never
// rewritten in place, which a quit cut short at that moment would leave
// torn, and then nothing would start the apps again.
func TestQuitsListIsReplacedWhole(t *testing.T) {
	h := &homelab{root: t.TempDir()}
	if err := os.MkdirAll(h.logsDir(), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := h.saveStopped(stoppedApps{At: time.Now(), Containers: []string{"homelab_photos-immich-1"}}); err != nil {
		t.Fatal(err)
	}
	was, err := statNow(h.stoppedFile())
	if err != nil {
		t.Fatal(err)
	}
	if err := h.saveStopped(stoppedApps{At: time.Now(), Containers: []string{"homelab_photos-immich-1", "homelab_media-jellyfin-1"}}); err != nil {
		t.Fatal(err)
	}
	now, err := os.Stat(h.stoppedFile())
	if err != nil {
		t.Fatal(err)
	}
	if os.SameFile(was, now) {
		t.Error("the list was rewritten in place")
	}
	if s, err := h.loadStopped(); err != nil || len(s.Containers) != 2 {
		t.Errorf("list %+v, %v", s, err)
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
