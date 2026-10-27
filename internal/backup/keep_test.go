package backup

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCopies(t *testing.T) {
	staging := t.TempDir()
	now := time.Date(2026, 10, 26, 3, 0, 0, 0, time.UTC)
	if _, ok := LatestCopy(staging, "ntfy"); ok {
		t.Fatal("a copy before any")
	}
	var made []UpdateCopy
	for i, when := range []time.Time{now.Add(-10 * 24 * time.Hour), now.Add(-time.Hour), now} {
		c := NewCopy(staging, "ntfy", "sha256:"+string(rune('a'+i)), when)
		if err := os.MkdirAll(c.Dir, 0o700); err != nil {
			t.Fatal(err)
		}
		c.Mounts = []CopiedMount{{Kind: "folder", Source: "/h/data/appdata/ntfy", Archive: "1-ntfy.tar.gz", Bytes: 8192}}
		if err := c.Save(); err != nil {
			t.Fatal(err)
		}
		made = append(made, c)
	}
	// A copy that never finished: no record.
	unfinished := filepath.Join(staging, CopiesFolder, "ntfy", "20261026-013000")
	_ = os.MkdirAll(unfinished, 0o700)

	c, ok := LatestCopy(staging, "ntfy")
	if !ok || c.ImageID != "sha256:c" || c.Dir != made[2].Dir || len(c.Mounts) != 1 || c.Mounts[0].Bytes != 8192 {
		t.Fatalf("latest: %+v", c)
	}
	if got := Copies(staging, "ntfy"); len(got) != 3 || got[2].ImageID != "sha256:a" {
		t.Fatalf("newest first: %+v", got)
	}
	// A week on, the oldest goes; then only the newest is kept.
	if gone := ExpireCopies(staging, now, 7*24*time.Hour); len(gone) != 1 || gone[0] != made[0].Dir {
		t.Errorf("expired: %v", gone)
	}
	if gone := PruneCopies(staging, "ntfy"); len(gone) != 2 {
		t.Errorf("pruned: %v", gone)
	}
	if got := Copies(staging, "ntfy"); len(got) != 1 || got[0].Dir != made[2].Dir {
		t.Errorf("kept: %+v", got)
	}
	if _, err := os.Stat(unfinished); !os.IsNotExist(err) {
		t.Error("the unfinished copy is still there")
	}
}
