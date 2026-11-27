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
			step{fmt.Sprintf("%s leaves finished downloads for Library", w.name(id)), func(ctx context.Context) (string, string, error) {
				return w.setConfig(ctx, id, "config/downloadclient", "enableCompletedDownloadHandling", false)
			}})
	}
	if w.has("lazylibrarian") {
		steps = append(steps, step{"LazyLibrarian leaves finished downloads for Library", func(context.Context) (string, string, error) {
			return "manual", "In LazyLibrarian › Config › Processing, turn post-processing off; Library picks its books up from the download folder", nil
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
	why, fix := w.tidyNotFiling()
	if why == "" {
		return w.handOverSteps()
	}
	// One line for all of them: the reason is the same for each.
	var names []string
	for _, h := range handOver {
		if w.has(h.id) {
			names = append(names, w.name(h.id))
		}
	}
	if len(names) == 0 {
		return nil
	}
	text := names[0] + " files its own downloads"
	if len(names) > 1 {
		text = joinAnd(names) + " file their own downloads"
	}
	if fix != "" {
		if w.fixes == nil {
			w.fixes = map[string]string{}
		}
		w.fixes[text] = fix
	}
	return []step{{text, func(context.Context) (string, string, error) {
		return "manual", why, nil
	}}}
}

// FixInboxArrive is the fix for an inbox that files only on Tidy up now:
// let it file downloads as they arrive (TIDY_INBOX_WHEN=arrive), then
// connect again, which hands the downloads over to Tidy Up.
const FixInboxArrive = "inbox-arrive"

// tidyNotFiling is why Tidy Up's inbox won't file what lands in
// DOWNLOADS_ROOT, as the agent reads TIDY_UP, TIDY_INBOX, TIDY_INBOX_WHEN
// and TIDY_INBOX_FOLDERS (internal/media InboxFolders), in words and
// without the settings' code names, with a fix when one click makes it
// file; "" when it will.
func (w *Wirer) tidyNotFiling() (string, string) {
	const then = ", so they file what they download themselves, and Library doesn't"
	off := func(k string) bool {
		v := strings.ToLower(strings.TrimSpace(w.Env[k]))
		return v == "false" || v == "0" || v == "no" || v == "off"
	}
	dl := strings.TrimSpace(w.Env["DOWNLOADS_ROOT"])
	switch {
	case off("TIDY_UP"):
		return "Library is turned off" + then, ""
	case off("TIDY_INBOX"):
		return "Library's inbox is turned off" + then, ""
	case strings.EqualFold(strings.TrimSpace(w.Env["TIDY_INBOX_WHEN"]), "manual"):
		return "Library files downloads only when you press Tidy up now" + then + ". Let it file them as they arrive, and Connect apps hands them over to it", FixInboxArrive
	case dl == "":
		return "no downloads folder is set" + then, ""
	}
	folders := strings.TrimSpace(w.Env["TIDY_INBOX_FOLDERS"])
	if folders == "" {
		return "", "" // Downloads and DOWNLOADS_ROOT
	}
	clean := func(p string) string {
		return strings.ToLower(path.Clean(strings.ReplaceAll(strings.TrimSpace(p), "\\", "/")))
	}
	for _, f := range strings.Split(folders, ";") {
		if clean(f) == clean(dl) {
			return "", ""
		}
	}
	return "Library's inbox doesn't watch the downloads folder (" + dl + ")" + then, ""
}
