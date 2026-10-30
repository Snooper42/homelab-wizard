package main

import (
	"context"
	"sort"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

// The versions the apps run, kept in .env: each app the nightly update
// moves forward (its image follows a tag such as :latest) has its image's
// digest under <APP>_DIGEST. homelab update, a rollback, and the watchdog
// write it when what runs changes; homelab up, install, and a move or
// rebuild start that version again (useKeptVersions), so data is never
// opened by a newer version than the one that wrote it. .env goes off
// site in Homelab Secrets, so a restore keeps them too. The PostgreSQL
// versions are kept the same way, by hand (PAPERLESS_DB_VERSION).

// versionsNote heads the kept versions in .env, written with the first.
var versionsNote = []string{
	"",
	"# The version each app runs, by its image's digest (<APP>_DIGEST). homelab",
	"# update writes them, and homelab up starts these versions again, so a restore",
	"# or a new machine opens the data with the version that wrote it. Delete a",
	"# line to let that app start on its newest version.",
}

// versionKey is the .env key holding the version app runs.
func versionKey(app string) string {
	return strings.ToUpper(strings.ReplaceAll(app, "-", "_")) + "_DIGEST"
}

// keepsVersion reports whether .env keeps a's version: an image the
// nightly update moves forward, not one built here or set by hand.
func keepsVersion(a *catalog.App) bool {
	how, _ := a.UpdatePolicy()
	return how == "nightly"
}

// keepVersions writes into .env the digest of the image each running app
// runs, where it changed, and returns the apps whose line changed.
func (h *homelab) keepVersions(ctx context.Context, client *docker.Client) []string {
	containers, err := client.Containers(ctx)
	if err != nil {
		return nil
	}
	report := detect.Analyze(h.catalog, containers)
	f, err := envfile.Load(h.envFile)
	if err != nil || !f.Exists() {
		return nil
	}
	have := f.Map()
	first := true
	for k := range have {
		if strings.HasSuffix(k, "_DIGEST") {
			first = false
			break
		}
	}
	var changed []string
	for _, a := range h.catalog.Apps {
		ctr, ok := runningContainer(report, a.ID)
		if !ok || !keepsVersion(a) {
			continue
		}
		digests, err := client.RepoDigests(ctx, ctr.ImageID)
		if err != nil {
			continue
		}
		_, sum, ok := strings.Cut(backup.RepoDigest(ctr.Image, digests), "@")
		if !ok || have[versionKey(a.ID)] == sum {
			continue
		}
		if first {
			f.Comment(versionsNote...)
			first = false
		}
		f.Set(versionKey(a.ID), sum)
		changed = append(changed, a.ID)
	}
	if len(changed) == 0 {
		return nil
	}
	if err := f.Save(); err != nil {
		h.ui.Warn("could not keep the apps' versions in .env: %v", err)
		return nil
	}
	sort.Strings(changed)
	return changed
}

// useKeptVersions puts, under the name each app's compose file uses, the
// version .env keeps for it, before the apps start: from this machine if
// it has it, else from its registry by digest. An app with no line, or
// already on its version, is left; one whose version cannot be pulled
// starts on what is here, which it says. It returns the apps it put back.
func (h *homelab) useKeptVersions(ctx context.Context, client *docker.Client, apps []*catalog.App) []string {
	env := h.envMap()
	lookup := compose.MapLookup(env)
	var put []string
	for _, a := range apps {
		sum := env[versionKey(a.ID)]
		if !keepsVersion(a) || !strings.HasPrefix(sum, "sha256:") {
			continue
		}
		ref, err := compose.Interpolate(a.Image, lookup)
		if err != nil || ref == "" {
			continue
		}
		pin := repositoryOf(ref) + "@" + sum
		if digests, err := client.RepoDigests(ctx, ref); err == nil && strings.HasSuffix(backup.RepoDigest(ref, digests), "@"+sum) {
			continue
		}
		if _, err := client.ImageID(ctx, pin); err != nil {
			if _, err := client.Runner.Output(ctx, client.Bin, "pull", "--quiet", pin); err != nil {
				h.ui.Warn("%s: the version .env keeps (%s) could not be pulled, so it starts on the image here or the newest: %v", a.ID, shortDigest(pin), err)
				continue
			}
		}
		if err := client.Tag(ctx, pin, ref); err != nil {
			h.ui.Warn("%s: %v", a.ID, err)
			continue
		}
		put = append(put, a.ID)
	}
	sort.Strings(put)
	return put
}

// repositoryOf is a reference without its tag or digest:
// ghcr.io/paperless-ngx/paperless-ngx:latest is ghcr.io/paperless-ngx/paperless-ngx.
func repositoryOf(ref string) string {
	ref, _, _ = strings.Cut(ref, "@")
	if i := strings.LastIndex(ref, ":"); i > strings.LastIndex(ref, "/") {
		ref = ref[:i]
	}
	return ref
}
