package wiring

import (
	"context"
	"fmt"
	"net/http"
	"path"
	"strings"
)

// Tidy Up owns the media libraries: the *arr apps find and download, and
// leave the finished downloads in the download folder, where Tidy Up's
// inbox shrinks them and files them. So each *arr app stops renaming files
// (Media Management › Rename) and stops importing finished downloads into
// its library (Download Clients › Completed Download Handling), which is
// what moves them.

// handOver is what each *arr app's rename setting is called.
var handOver = []struct{ id, rename string }{
	{"sonarr", "renameEpisodes"}, {"radarr", "renameMovies"}, {"lidarr", "renameTracks"},
}

// HandOverPlan is what HandOver would change, one link a setting.
func (w *Wirer) HandOverPlan() []Link {
	links := []Link{}
	for _, s := range w.handOverSteps() {
		links = append(links, Link{Text: s.text, State: "planned"})
	}
	return links
}

// HandOver turns the *arr apps' renaming and importing off, reporting each
// setting as it is changed; an app already set so is "already".
func (w *Wirer) HandOver(ctx context.Context, progress func(Link)) []Link {
	w.keys, w.notUp = map[string]string{}, map[string]error{}
	links := []Link{}
	for _, s := range w.handOverSteps() {
		state, detail, err := s.do(ctx)
		if err != nil {
			state, detail = "failed", err.Error()
		}
		l := Link{Text: s.text, State: state, Detail: detail}
		if progress != nil {
			progress(l)
		}
		links = append(links, l)
	}
	return links
}

func (w *Wirer) handOverSteps() []step {
	var steps []step
	for _, h := range handOver {
		if !w.has(h.id) {
			continue
		}
		id, rename := h.id, h.rename
		steps = append(steps,
			step{fmt.Sprintf("%s stops renaming files", w.name(id)), func(ctx context.Context) (string, string, error) {
				return w.setConfig(ctx, id, "config/naming", rename, false)
			}},
			step{fmt.Sprintf("%s leaves finished downloads for Tidy Up", w.name(id)), func(ctx context.Context) (string, string, error) {
				return w.setConfig(ctx, id, "config/downloadclient", "enableCompletedDownloadHandling", false)
			}})
	}
	if w.has("lazylibrarian") {
		steps = append(steps, step{"LazyLibrarian leaves finished downloads for Tidy Up", func(context.Context) (string, string, error) {
			return "manual", "In LazyLibrarian › Config › Processing, turn post-processing off; Tidy Up picks its books up from the download folder", nil
		}})
	}
	return steps
}

// setConfig sets one field of an *arr config resource (GET it, change the
// field, PUT it back by its id).
func (w *Wirer) setConfig(ctx context.Context, id, path, field string, value any) (string, string, error) {
	key, err := w.ready(ctx, id)
	if err != nil {
		return "", "", err
	}
	var cfg resource
	if err := w.call(ctx, id, key, http.MethodGet, path, nil, &cfg); err != nil {
		return "", "", err
	}
	if cfg[field] == value {
		return "already", "", nil
	}
	cfg[field] = value
	if err := w.call(ctx, id, key, http.MethodPut, fmt.Sprintf("%s/%v", path, cfg["id"]), cfg, nil); err != nil {
		return "", "", err
	}
	return "done", "", nil
}

// tidyFilingSteps are Connect apps' part of the hand-over (the owner, Nov
// 19, 2026: Tidy Up files every download, so the *arr apps never import a
// second copy): HandOver's steps, found and left alone on the next run. When
// Tidy Up's inbox won't file what qBittorrent downloads, handing over would
// strand the downloads, so each app keeps filing and the step says why.
func (w *Wirer) tidyFilingSteps() []step {
	why := w.tidyNotFiling()
	if why == "" {
		return w.handOverSteps()
	}
	var steps []step
	for _, h := range handOver {
		if w.has(h.id) {
			steps = append(steps, step{w.name(h.id) + " keeps filing what it downloads", func(context.Context) (string, string, error) {
				return "manual", why, nil
			}})
		}
	}
	return steps
}

// tidyNotFiling is why Tidy Up's inbox won't file what lands in
// DOWNLOADS_ROOT, as the agent reads TIDY_UP, TIDY_INBOX, TIDY_INBOX_WHEN
// and TIDY_INBOX_FOLDERS (internal/media InboxFolders); "" when it will.
func (w *Wirer) tidyNotFiling() string {
	const then = ", so Sonarr, Radarr and Lidarr keep filing what they download themselves"
	off := func(k string) bool {
		v := strings.ToLower(strings.TrimSpace(w.Env[k]))
		return v == "false" || v == "0" || v == "no" || v == "off"
	}
	dl := strings.TrimSpace(w.Env["DOWNLOADS_ROOT"])
	switch {
	case off("TIDY_UP"):
		return "Tidy Up is turned off (TIDY_UP)" + then
	case off("TIDY_INBOX"):
		return "Tidy Up's inbox is turned off (TIDY_INBOX)" + then
	case strings.EqualFold(strings.TrimSpace(w.Env["TIDY_INBOX_WHEN"]), "manual"):
		return "Tidy Up's inbox runs only when you press Tidy up now (TIDY_INBOX_WHEN=manual)" + then
	case dl == "":
		return "no downloads folder is set (DOWNLOADS_ROOT)" + then
	}
	folders := strings.TrimSpace(w.Env["TIDY_INBOX_FOLDERS"])
	if folders == "" {
		return "" // Downloads and DOWNLOADS_ROOT
	}
	clean := func(p string) string {
		return strings.ToLower(path.Clean(strings.ReplaceAll(strings.TrimSpace(p), "\\", "/")))
	}
	for _, f := range strings.Split(folders, ";") {
		if clean(f) == clean(dl) {
			return ""
		}
	}
	return "Tidy Up's inbox doesn't watch the downloads folder (" + dl + " isn't in TIDY_INBOX_FOLDERS)" + then
}
