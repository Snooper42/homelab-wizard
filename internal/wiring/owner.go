package wiring

import (
	"context"
	"fmt"
	"net/http"
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
