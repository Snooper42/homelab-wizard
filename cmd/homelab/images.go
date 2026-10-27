package main

import (
	"context"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// recordImages notes, beside the dumps, the image each running app runs
// and the digest that pulls it again, keeping the newest keep records like
// the dumps. A restore starts those versions first (pinImages).
func (h *homelab) recordImages(ctx context.Context, client *docker.Client, report *detect.Report, now time.Time, keep int) (string, int, error) {
	im := backup.Images{Made: now, Apps: map[string]backup.AppImage{}}
	for _, a := range h.catalog.Apps {
		ctr, ok := runningContainer(report, a.ID)
		if !ok || a.Native() != nil {
			continue
		}
		rec := backup.AppImage{Ref: ctr.Image, ImageID: ctr.ImageID}
		if digests, err := client.RepoDigests(ctx, ctr.ImageID); err == nil {
			rec.Digest = backup.RepoDigest(ctr.Image, digests)
		}
		im.Apps[a.ID] = rec
	}
	dir := h.stagingDir("databases", backup.ImagesFolder)
	path, err := backup.SaveImages(dir, im)
	if err != nil {
		return "", 0, err
	}
	_, _ = backup.Rotate(dir, backup.ImagesFolder, keep)
	return path, len(im.Apps), nil
}

// pinImages puts the images the newest backup's apps ran under the names
// their compose files use, so they start on the versions that wrote their
// data rather than whatever is newest. Each comes from its digest; one the
// compose file now names differently, or that is already here, is left.
// It returns the apps it pinned; a failed pull leaves that app to start on
// the newest image, which it says.
func (h *homelab) pinImages(ctx context.Context, client *docker.Client) []string {
	path := newestIn(h.stagingDir("databases", backup.ImagesFolder))
	if path == "" {
		return nil
	}
	im, err := backup.LoadImages(path)
	if err != nil {
		h.ui.Warn("the images the backup's apps ran (%s): %v", filepath.Base(path), err)
		return nil
	}
	lookup := compose.MapLookup(h.envMap())
	var pinned []string
	for _, a := range h.catalog.Apps {
		rec, ok := im.Apps[a.ID]
		if !ok || rec.Digest == "" || rec.Ref == "" || a.Native() != nil {
			continue
		}
		if ref, err := compose.Interpolate(a.Image, lookup); err != nil || ref != rec.Ref {
			continue
		}
		if id, err := client.ImageID(ctx, rec.Ref); err == nil && id == rec.ImageID {
			continue
		}
		if _, err := client.Runner.Output(ctx, client.Bin, "pull", "--quiet", rec.Digest); err != nil {
			h.ui.Warn("%s: the version from the backup (%s) could not be pulled, so it starts on the newest: %v", a.ID, shortDigest(rec.Digest), err)
			continue
		}
		if err := client.Tag(ctx, rec.Digest, rec.Ref); err != nil {
			h.ui.Warn("%s: %v", a.ID, err)
			continue
		}
		pinned = append(pinned, a.ID)
		h.ui.OK("%s: %s, the version from the backup (%s)", a.ID, rec.Ref, shortDigest(rec.Digest))
	}
	sort.Strings(pinned)
	return pinned
}

// shortDigest is a digest's first twelve hex digits, as Docker shows IDs.
func shortDigest(ref string) string {
	_, sum, _ := strings.Cut(ref, "@sha256:")
	if len(sum) > 12 {
		sum = sum[:12]
	}
	return sum
}
