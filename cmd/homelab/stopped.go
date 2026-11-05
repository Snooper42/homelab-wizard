package main

import (
	"context"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/stopped"
)

// startWhenDue starts the apps stopped for a while (homelab stop --until)
// whose time has come, and forgets any in the record that run again
// (started from Docker Desktop, say): stopped on purpose means stopped. An
// app that will not start stays in the record, to be tried again on the
// next call. The awake job calls it every minute (resumeStopped).
func (h *homelab) startWhenDue(ctx context.Context, client *docker.Client, containers []docker.Container, now time.Time) {
	path := stopped.Path(h.root)
	r := stopped.Load(path)
	if len(r) == 0 {
		return
	}
	// What to forget is worked out from this copy, while the starts take
	// their seconds; the record is changed afterwards under its lock, and
	// only for entries no one has changed since, so a stop made meanwhile
	// (a phone's Stop for a while) is kept.
	forget := map[string]stopped.Stop{}
	report := detect.Analyze(h.catalog, containers)
	for _, id := range r.IDs() {
		if st, _ := report.State(id); st == detect.Running {
			forget[id] = r[id]
		}
	}
	var apps []*catalog.App
	for _, id := range r.Due(now) {
		a, ok := h.catalog.Get(id)
		if st, _ := report.State(id); !ok || st != detect.Stopped {
			// Gone from the catalog, or its container removed: nothing to start.
			forget[id] = r[id]
			continue
		}
		apps = append(apps, a)
	}
	var started []*catalog.App
	for _, pa := range h.byProject(apps) {
		for _, id := range pa.ids {
			if err := client.Compose(ctx, h.project(pa.file), pa.profiles, "start", id); err != nil {
				h.ui.Warn("start %s again: %v", id, err)
				continue
			}
			a, _ := h.catalog.Get(id)
			started = append(started, a)
			forget[id] = r[id]
		}
	}
	if len(started) > 0 {
		h.ui.Info("started %s again, as asked when it was stopped", names(started))
	}
	if len(forget) == 0 {
		return
	}
	err := stopped.Update(path, func(now stopped.Record) bool {
		changed := false
		for id, was := range forget {
			if s, ok := now[id]; ok && s.Since.Equal(was.Since) && s.Until.Equal(was.Until) {
				delete(now, id)
				changed = true
			}
		}
		return changed
	})
	if err != nil {
		h.ui.Warn("could not keep which apps were stopped on purpose: %v", err)
	}
}

// resumeStopped runs startWhenDue every powerEvery, beside resumeOnPower in
// the awake job, so an app stopped until 9 PM starts within a minute of it.
// It asks Docker only while the record holds something.
func (h *homelab) resumeStopped(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(powerEvery):
		}
		if len(stopped.Load(stopped.Path(h.root))) == 0 {
			continue
		}
		client, err := h.docker(ctx)
		if err != nil {
			continue
		}
		containers, err := client.Containers(ctx)
		if err != nil {
			continue
		}
		h.startWhenDue(ctx, client, containers, time.Now())
	}
}
