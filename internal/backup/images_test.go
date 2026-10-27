package backup

import (
	"path/filepath"
	"testing"
	"time"
)

func TestRepoDigestPicksTheRefsRepository(t *testing.T) {
	sum := "sha256:" + "ab12cd34ef56ab12cd34ef56ab12cd34ef56ab12cd34ef56ab12cd34ef56ab12"
	for _, c := range []struct {
		ref     string
		digests []string
		want    string
	}{
		{"binwiederhier/ntfy:latest", []string{"binwiederhier/ntfy@" + sum}, "binwiederhier/ntfy@" + sum},
		// Docker Hub's official images, in any of their spellings.
		{"postgres:16", []string{"postgres@" + sum}, "postgres@" + sum},
		{"docker.io/library/postgres:16", []string{"postgres@" + sum}, "postgres@" + sum},
		{"postgres", []string{"docker.io/library/postgres@" + sum}, "docker.io/library/postgres@" + sum},
		// Another registry, and a registry with a port.
		{"lscr.io/linuxserver/duplicati:latest", []string{"linuxserver/duplicati@" + sum, "lscr.io/linuxserver/duplicati@" + sum}, "lscr.io/linuxserver/duplicati@" + sum},
		{"registry.local:5000/app:1", []string{"registry.local:5000/app@" + sum}, "registry.local:5000/app@" + sum},
		// The same image known by another name is not this one's.
		{"lscr.io/linuxserver/duplicati:latest", []string{"linuxserver/duplicati@" + sum}, ""},
		// Built here: no digest.
		{"homelab/sqlite:1", nil, ""},
		// Pinned already.
		{"ghcr.io/immich-app/postgres@" + sum, nil, "ghcr.io/immich-app/postgres@" + sum},
	} {
		if got := RepoDigest(c.ref, c.digests); got != c.want {
			t.Errorf("RepoDigest(%q, %v) = %q, want %q", c.ref, c.digests, got, c.want)
		}
	}
}

func TestImagesKeptLikeTheDumps(t *testing.T) {
	dir := filepath.Join(t.TempDir(), ImagesFolder)
	start := time.Date(2026, 10, 20, 3, 30, 0, 0, time.UTC)
	var last string
	for i := 0; i < 9; i++ {
		im := Images{Made: start.Add(time.Duration(i) * 24 * time.Hour), Apps: map[string]AppImage{"ntfy": {Ref: "binwiederhier/ntfy:latest", ImageID: "sha256:1", Digest: "binwiederhier/ntfy@sha256:2"}}}
		path, err := SaveImages(dir, im)
		if err != nil {
			t.Fatal(err)
		}
		last = path
		if _, err := Rotate(dir, ImagesFolder, 7); err != nil {
			t.Fatal(err)
		}
	}
	files, _ := filepath.Glob(filepath.Join(dir, "*"))
	if len(files) != 7 {
		t.Errorf("kept %d records, want the newest 7: %v", len(files), files)
	}
	if filepath.Base(last) != "images-20261028-033000.json" {
		t.Errorf("named %s", filepath.Base(last))
	}
	im, err := LoadImages(last)
	if err != nil || im.Apps["ntfy"].Digest != "binwiederhier/ntfy@sha256:2" || !im.Made.Equal(start.Add(8*24*time.Hour)) {
		t.Errorf("read back %+v, %v", im, err)
	}
}
