package main

import (
	"context"
	"errors"
	"io"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

func TestARestoreStartsTheImagesTheBackupRecorded(t *testing.T) {
	root, _ := repoCopy(t)
	c, err := catalog.Load(root)
	if err != nil {
		t.Fatal(err)
	}
	h := &homelab{root: root, envFile: filepath.Join(root, ".env"), ui: &ui.UI{Out: io.Discard}, catalog: c}
	ctx := context.Background()
	old := "linuxserver/sonarr@sha256:" + strings.Repeat("a", 64)
	fake := &docker.FakeRunner{
		Containers: []docker.FakeContainer{
			sonarr("sha256:old", "healthy"),
			{Name: "homelab_security-ntfy-1", Image: "binwiederhier/ntfy:latest", ImageID: "sha256:ntfy", Running: true, Project: "homelab_security", Service: "ntfy"},
		},
		RepoDigests: map[string][]string{"sha256:old": {"lscr.io/linuxserver/sonarr@sha256:" + strings.Repeat("a", 64)}},
	}
	client := &docker.Client{Runner: fake, Bin: "docker"}
	cs, err := client.Containers(ctx)
	if err != nil {
		t.Fatal(err)
	}
	when := time.Date(2026, 10, 27, 3, 30, 0, 0, time.Local)
	path, n, err := h.recordImages(ctx, client, detect.Analyze(c, cs), when, 7)
	if err != nil || n != 2 {
		t.Fatalf("recorded %d: %v", n, err)
	}
	im, err := backup.LoadImages(path)
	if err != nil {
		t.Fatal(err)
	}
	if s := im.Apps["sonarr"]; s.Ref != "lscr.io/linuxserver/sonarr:latest" || s.ImageID != "sha256:old" || s.Digest != "lscr.io/"+old {
		t.Errorf("sonarr: %+v", s)
	}
	// ntfy's image has no digest here (built or loaded locally): noted,
	// but nothing to pull it again by.
	if s := im.Apps["ntfy"]; s.ImageID != "sha256:ntfy" || s.Digest != "" {
		t.Errorf("ntfy: %+v", s)
	}

	// On the new machine a newer Sonarr has that name: the backup's comes
	// back under it, by its digest.
	fresh := &docker.FakeRunner{Images: map[string]string{"lscr.io/linuxserver/sonarr:latest": "sha256:new"}}
	client = &docker.Client{Runner: fresh, Bin: "docker"}
	if pinned := h.pinImages(ctx, client); len(pinned) != 1 || pinned[0] != "sonarr" {
		t.Fatalf("pinned %v", pinned)
	}
	calls := strings.Join(fresh.Calls, "\n")
	if !strings.Contains(calls, "pull --quiet lscr.io/"+old) || !strings.Contains(calls, "image tag lscr.io/"+old+" lscr.io/linuxserver/sonarr:latest") {
		t.Errorf("calls:\n%s", calls)
	}
	// Already the backup's version: nothing to pull.
	fresh = &docker.FakeRunner{Images: map[string]string{"lscr.io/linuxserver/sonarr:latest": "sha256:old"}}
	if pinned := h.pinImages(ctx, &docker.Client{Runner: fresh, Bin: "docker"}); len(pinned) != 0 || strings.Contains(strings.Join(fresh.Calls, "\n"), "pull") {
		t.Errorf("pinned %v with %v", pinned, fresh.Calls)
	}
	// A registry that cannot be reached leaves the newest to start.
	fresh = &docker.FakeRunner{PullErr: map[string]error{"lscr.io/" + old: errors.New("manifest unknown")}}
	if pinned := h.pinImages(ctx, &docker.Client{Runner: fresh, Bin: "docker"}); len(pinned) != 0 || strings.Contains(strings.Join(fresh.Calls, "\n"), "image tag") {
		t.Errorf("pinned %v with %v", pinned, fresh.Calls)
	}
	// The compose file now names another image (a new major version):
	// the record is for the old name, so it is left.
	im.Apps["sonarr"] = backup.AppImage{Ref: "lscr.io/linuxserver/sonarr:3", ImageID: "sha256:old", Digest: "lscr.io/" + old}
	im.Made = when.Add(time.Hour)
	if _, err := backup.SaveImages(filepath.Dir(path), im); err != nil {
		t.Fatal(err)
	}
	fresh = &docker.FakeRunner{}
	if pinned := h.pinImages(ctx, &docker.Client{Runner: fresh, Bin: "docker"}); len(pinned) != 0 || len(fresh.Calls) != 0 {
		t.Errorf("pinned %v with %v", pinned, fresh.Calls)
	}
}
