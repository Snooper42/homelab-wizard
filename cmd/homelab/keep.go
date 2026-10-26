package main

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/diskspace"
	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// defaultCopyLimit is UPDATE_COPY_LIMIT's default: the largest folder or
// volume copied before an update (ADR-0020). The databases are dumped
// whatever their size.
const defaultCopyLimit = "2GB"

// updateCopyLimit is UPDATE_COPY_LIMIT in bytes ("2GB", "500MB"); 0 copies
// any size.
func (h *homelab) updateCopyLimit() int64 {
	s := strings.TrimSpace(h.envMap()["UPDATE_COPY_LIMIT"])
	if s == "" {
		s = defaultCopyLimit
	}
	if s == "0" {
		return 0
	}
	if n := int64(parseSize(s)); n > 0 {
		return n
	}
	return int64(parseSize(defaultCopyLimit))
}

// dataMounts are the app's own data a copy keeps: the folders inside the
// homelab folder it writes to, and its project's named volumes. Left out:
// what it only reads, recovery-staging (the dumps and restores of the
// backup apps), and folders outside the homelab folder (the media), whose
// apps keep their schemas in their databases.
func (h *homelab) dataMounts(ctr docker.Container) []docker.Mount {
	staging := h.stagingDir()
	var out []docker.Mount
	for _, m := range ctr.Mounts {
		switch {
		case !m.Writable:
		case m.Type == "bind" && insideFolder(m.Source, h.root) && !insideFolder(m.Source, staging) && isFolder(m.Source):
			out = append(out, m)
		case m.Type == "volume" && ctr.Project() != "" && strings.HasPrefix(m.Name, ctr.Project()+"_"):
			out = append(out, m)
		}
	}
	return out
}

// insideFolder reports whether path is dir or inside it.
func insideFolder(path, dir string) bool {
	rel, err := filepath.Rel(dir, path)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

func isFolder(p string) bool {
	st, err := os.Stat(p)
	return err == nil && st.IsDir()
}

// mountRef is how docker run mounts it: the folder, or the volume's name.
func mountRef(m docker.Mount) string {
	if m.Type == "volume" {
		return m.Name
	}
	return m.Source
}

// mountSize is what a folder or volume holds, read from inside a
// container, which reads files any account owns.
func mountSize(ctx context.Context, client *docker.Client, ref string) (int64, error) {
	var out bytes.Buffer
	if err := client.RunTo(ctx, &out, "-v", ref+":/data:ro", "alpine:3", "du", "-sk", "/data"); err != nil {
		return 0, err
	}
	kb, err := strconv.ParseInt(strings.Fields(out.String() + " x")[0], 10, 64)
	if err != nil {
		return 0, fmt.Errorf("reading the size of %s: %q", ref, out.String())
	}
	return kb * 1024, nil
}

var unsafeName = regexp.MustCompile(`[^A-Za-z0-9._-]+`)

// archiveMount writes a gzipped tar of a folder or volume to path.
func archiveMount(ctx context.Context, client *docker.Client, ref, path string) error {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	err = client.RunTo(ctx, f, "-v", ref+":/data:ro", "alpine:3", "tar", "czf", "-", "-C", "/data", ".")
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		_ = os.Remove(path)
		return fmt.Errorf("copying %s: %w", ref, err)
	}
	return nil
}

// copyBeforeUpdate keeps the app's own data just before its update: it
// stops the app, archives each folder and volume it writes to (up to
// UPDATE_COPY_LIMIT each), and keeps its databases' newest dumps beside
// them, made just before by beforeUpdate. The caller starts the update,
// or the app again if this fails. Older copies of the app go.
func (h *homelab) copyBeforeUpdate(ctx context.Context, client *docker.Client, a *catalog.App, ctr docker.Container) (backup.UpdateCopy, error) {
	cp := backup.NewCopy(h.stagingDir(), a.ID, ctr.ImageID, time.Now())
	if err := os.MkdirAll(cp.Dir, 0o700); err != nil {
		return cp, err
	}
	limit := h.updateCopyLimit()
	mounts := h.dataMounts(ctr)
	sizes := make([]int64, len(mounts))
	for i, m := range mounts {
		n, err := mountSize(ctx, client, mountRef(m))
		if err != nil {
			return cp, err
		}
		sizes[i] = n
	}
	if err := client.Compose(ctx, h.project(a.File), a.Profiles, "stop", a.ID); err != nil {
		return cp, err
	}
	for i, m := range mounts {
		kind := "folder"
		if m.Type == "volume" {
			kind = "volume"
		}
		if limit > 0 && sizes[i] > limit {
			cp.Skipped = append(cp.Skipped, backup.SkippedMount{Kind: kind, Source: mountRef(m), Bytes: sizes[i], Why: "larger than UPDATE_COPY_LIMIT (" + diskspace.Size(uint64(limit)) + ")"})
			continue
		}
		name := fmt.Sprintf("%d-%s.tar.gz", i+1, unsafeName.ReplaceAllString(filepath.Base(mountRef(m)), "_"))
		if err := archiveMount(ctx, client, mountRef(m), filepath.Join(cp.Dir, name)); err != nil {
			return cp, err
		}
		cp.Mounts = append(cp.Mounts, backup.CopiedMount{Kind: kind, Source: mountRef(m), Target: m.Target, Archive: name, Bytes: sizes[i]})
	}
	for _, id := range append([]string{a.ID}, a.DependsOn...) {
		d, ok := h.catalog.Get(id)
		if !ok || d.Meta.Dump == "" {
			continue
		}
		dump := newestIn(h.stagingDir("databases", id))
		if dump == "" {
			continue
		}
		name := id + "-" + filepath.Base(dump)
		if err := os.Link(dump, filepath.Join(cp.Dir, name)); err != nil {
			if err := copyFile(dump, filepath.Join(cp.Dir, name)); err != nil {
				return cp, err
			}
		}
		cp.Dumps = append(cp.Dumps, backup.CopiedDump{App: id, File: name})
	}
	if err := cp.Save(); err != nil {
		return cp, err
	}
	backup.PruneCopies(h.stagingDir(), a.ID)
	return cp, nil
}

// copyFile copies a file, private to this account.
func copyFile(from, to string) error {
	data, err := os.ReadFile(from)
	if err != nil {
		return err
	}
	return os.WriteFile(to, data, 0o600)
}

// copySaid is one line on what a copy holds and what it left out.
func (h *homelab) copySaid(cp backup.UpdateCopy) string {
	var held []string
	for _, m := range cp.Mounts {
		held = append(held, h.rel(m.Source))
	}
	for _, d := range cp.Dumps {
		held = append(held, d.App+"'s dump")
	}
	s := "nothing of its own to copy"
	if len(held) > 0 {
		s = "copied " + strings.Join(held, ", ")
	}
	for _, sk := range cp.Skipped {
		s += "; not copied: " + h.rel(sk.Source) + " (" + diskspace.Size(uint64(sk.Bytes)) + ", " + sk.Why + ")"
	}
	return s
}

// putBack restores a copy: it stops the app, sets today's data aside in
// recovery-staging/rolled-back/<app>/<time>/ (the rollback never deletes
// it), puts each folder and volume back from the copy, and loads its
// PostgreSQL dumps into their databases. The caller starts the app.
func (h *homelab) putBack(ctx context.Context, client *docker.Client, a *catalog.App, cp backup.UpdateCopy) (aside string, err error) {
	base := h.stagingDir(backup.RolledBackFolder, a.ID, time.Now().Format(backup.CopyStamp))
	if err := os.MkdirAll(filepath.Dir(base), 0o700); err != nil {
		return "", err
	}
	// Its own folder each time, even twice in a second.
	aside = base
	for n := 2; ; n++ {
		if err := os.Mkdir(aside, 0o700); err == nil {
			break
		} else if !os.IsExist(err) {
			return "", err
		}
		aside = fmt.Sprintf("%s-%d", base, n)
	}
	if err := client.Compose(ctx, h.project(a.File), a.Profiles, "stop", a.ID); err != nil {
		return "", err
	}
	for _, m := range cp.Mounts {
		if err := archiveMount(ctx, client, m.Source, filepath.Join(aside, m.Archive)); err != nil {
			return aside, fmt.Errorf("setting today's %s aside, so nothing was put back: %w", m.Source, err)
		}
	}
	for _, m := range cp.Mounts {
		if err := loadVolume(ctx, client, m.Source, filepath.Join(cp.Dir, m.Archive)); err != nil {
			return aside, fmt.Errorf("putting back %s (today's is in %s): %w", m.Source, h.rel(aside), err)
		}
	}
	for _, d := range cp.Dumps {
		db, ok := h.catalog.Get(d.App)
		if !ok || db.Meta.Dump != "postgres" {
			continue // SQLite files came back with their folder
		}
		// Today's database first, beside today's folders.
		if err := h.backup(ctx, []string{"--apply", "--apps", d.App}); err != nil {
			return aside, fmt.Errorf("dumping today's %s, so its dump was not loaded: %w", d.App, err)
		}
		if today := newestIn(h.stagingDir("databases", d.App)); today != "" {
			if err := copyFile(today, filepath.Join(aside, d.App+"-"+filepath.Base(today))); err != nil {
				return aside, err
			}
		}
		ctr, err := h.containerOf(ctx, client, db)
		if err != nil {
			return aside, err
		}
		if out, err := restoreDump(ctx, client, ctr, filepath.Join(cp.Dir, d.File)); err != nil {
			return aside, fmt.Errorf("loading %s's dump: %w\n%s", d.App, err, lastLines(out, 5))
		}
	}
	return aside, nil
}

// copyUpdating copies the data of each app whose image the pull just
// changed, and returns the apps to start on their new images. An app whose
// copy failed starts again as it was and is not updated.
func (h *homelab) copyUpdating(ctx context.Context, client *docker.Client, ids []string) (update, notCopied []string) {
	containers, err := client.Containers(ctx)
	if err != nil {
		h.ui.Warn("no copies before the update: %v", err)
		return nil, ids
	}
	for _, id := range ids {
		a, ok := h.catalog.Get(id)
		var ctr docker.Container
		found := false
		for _, c := range containers {
			if ok && c.Service() == a.ID && c.Project() == a.Project() {
				ctr, found = c, true
			}
		}
		if !found {
			update = append(update, id) // not made yet: nothing to keep
			continue
		}
		if now, err := client.ImageID(ctx, ctr.Image); err == nil && now == ctr.ImageID {
			update = append(update, id) // no newer image: compose leaves it be
			continue
		}
		cp, err := h.copyBeforeUpdate(ctx, client, a, ctr)
		if err != nil {
			h.ui.Warn("%s: the copy of its data before the update failed, so it was not updated: %v", a.Name(), err)
			if serr := client.Compose(ctx, h.project(a.File), a.Profiles, "start", a.ID); serr != nil {
				h.ui.Warn("%s: starting it again failed too: %v", a.Name(), serr)
			}
			_ = os.RemoveAll(cp.Dir)
			notCopied = append(notCopied, id)
			continue
		}
		h.ui.Info("%s: %s (%s)", a.Name(), h.copySaid(cp), h.rel(cp.Dir))
		update = append(update, id)
	}
	return update, notCopied
}
