package main

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/notify"
	"github.com/Snooper42/homelab-wizard/internal/updates"
)

// trackUpdates notes the image every running app runs. When one changed
// (Watchtower updated it overnight, or homelab update did), the image it
// ran before is kept under its rollback name for a week. With auto, an app
// updated a little while ago that stays unwell is rolled back by itself.
// It returns what it did, for the watchdog to report.
func (h *homelab) trackUpdates(ctx context.Context, client *docker.Client, containers []docker.Container, auto bool) []string {
	path := updates.HistoryPath(h.root)
	hist := updates.LoadHistory(path)
	report := detect.Analyze(h.catalog, containers)
	now := time.Now()
	seen := map[string]updates.Seen{}
	for _, a := range h.catalog.Apps {
		if ctr, ok := runningContainer(report, a.ID); ok && a.Native() == nil {
			seen[a.ID] = updates.Seen{Ref: ctr.Image, ImageID: ctr.ImageID}
		}
	}
	var notes []string
	pruned := false
	for _, c := range hist.Observe(seen) {
		r := hist.Apps[c.App]
		if err := client.Tag(ctx, c.From, updates.RollbackRef(c.App)); err != nil {
			// The old image is gone (cleaned up already): nothing to go back to.
			r.Previous = ""
			continue
		}
		r.Previous, r.Updated = c.From, now
		pruned = true // an older kept image may now have no name
	}
	for _, app := range hist.Expired(now) {
		_ = client.RemoveImage(ctx, updates.RollbackRef(app))
		hist.Apps[app].Previous = ""
		pruned = true
	}
	if auto && !strings.EqualFold(h.envMap()["AUTO_ROLLBACK"], "false") {
		// A page that does not answer now, and did not on the watchdog's
		// last run either, counts too: the container runs, the app not.
		quiet := map[string]string{}
		last := health.LoadState(health.StatePath(h.root))
		for _, s := range api.StatusOf(ctx, h.catalog, containers, h.envMap(), true).Apps {
			if _, failed := last.Failing[s.ID]; s.NotAnswering != "" && (failed || last.Pending[s.ID] > 0) {
				quiet[s.ID] = s.NotAnswering
			}
		}
		for _, a := range h.catalog.Apps {
			ctr, ok := runningContainer(report, a.ID)
			if !ok || !hist.Recent(a.ID, now) || (ctr.Health != "unhealthy" && ctr.State != "restarting" && quiet[a.ID] == "") {
				continue
			}
			why := "unhealthy"
			switch {
			case ctr.State == "restarting":
				why = "restarting over and over"
			case quiet[a.ID] != "":
				why = "not answering (" + quiet[a.ID] + ")"
			}
			if err := h.doRollback(ctx, client, a, ctr, &hist); err != nil {
				notes = append(notes, fmt.Sprintf("%s has been %s since its update, and going back failed: %v", a.Name(), why, err))
				continue
			}
			notes = append(notes, fmt.Sprintf("%s was %s after its update, so it went back to the image it ran before; its updates are held until homelab updates release %s", a.Name(), why, a.ID))
		}
	}
	if pruned {
		_ = client.PruneDangling(ctx)
	}
	if err := hist.Save(path); err != nil {
		h.ui.Warn("could not save the update history: %v", err)
	}
	return notes
}

// doRollback puts an app back on the image it ran before its last update
// and holds its updates, so Watchtower does not update it again tonight.
func (h *homelab) doRollback(ctx context.Context, client *docker.Client, a *catalog.App, ctr docker.Container, hist *updates.History) error {
	r := hist.Apps[a.ID]
	if r == nil || r.Previous == "" {
		return fmt.Errorf("no earlier image of %s is kept (one is kept for a week after each update)", a.ID)
	}
	if err := client.Tag(ctx, updates.RollbackRef(a.ID), r.Ref); err != nil {
		return fmt.Errorf("going back to the earlier image: %w", err)
	}
	if err := client.Compose(ctx, h.project(a.File), a.Profiles, "up", "--detach", "--no-deps", "--force-recreate", a.ID); err != nil {
		return err
	}
	_ = client.RemoveImage(ctx, updates.RollbackRef(a.ID))
	r.Current, r.Previous, r.RolledBack = r.Previous, "", time.Now()
	if err := h.holdUpdates(ctx, client, a.ID, ctr.Name, r, true); err != nil {
		return fmt.Errorf("went back, but holding its updates failed: %w", err)
	}
	_ = client.PruneDangling(ctx) // the update it left
	return nil
}

// holdUpdates tells Watchtower to leave an app alone (WATCHTOWER_DISABLE_
// CONTAINERS, from UPDATES_HELD_CONTAINERS), or to update it again, and
// restarts Watchtower when it runs.
func (h *homelab) holdUpdates(ctx context.Context, client *docker.Client, app, container string, r *updates.Record, held bool) error {
	f, err := envfile.Load(h.envFile)
	if err != nil {
		return err
	}
	if !held && r != nil && r.HeldAs != "" {
		container = r.HeldAs
	}
	apps, containers := updates.SetHeld(f.Map(), app, container, held)
	f.Set(updates.HeldKey, apps)
	f.Set(updates.HeldContainersKey, containers)
	if err := f.Save(); err != nil {
		return err
	}
	if r != nil {
		r.HeldAs = ""
		if held {
			r.HeldAs = container
		}
	}
	w, ok := h.catalog.Get(updates.App)
	if !ok || updates.Paused(f.Map()) {
		return nil
	}
	cs, err := client.Containers(ctx)
	if err != nil {
		return err
	}
	if st, _ := detect.Analyze(h.catalog, cs).State(w.ID); st != detect.Running {
		return nil
	}
	return client.Compose(ctx, h.project(w.File), w.Profiles, "up", "--detach", "--no-deps", w.ID)
}

// rollback puts an app back on the image it ran before its last update.
func (h *homelab) rollback(ctx context.Context, args []string) error {
	fs := newFlags("rollback")
	apply := applyFlag(fs)
	pos, err := parseFlags(fs, args)
	if err != nil {
		return err
	}
	if len(pos) != 1 {
		return fmt.Errorf("usage: homelab rollback <app>")
	}
	a, ok := h.catalog.Get(pos[0])
	if !ok || a.Native() != nil {
		return fmt.Errorf("unknown container app %q", pos[0])
	}
	client, err := h.docker(ctx)
	if err != nil {
		return err
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return err
	}
	ctr, ok := runningContainer(detect.Analyze(h.catalog, containers), a.ID)
	if !ok {
		// Stopped apps can go back too: the container still names its image.
		for _, c := range containers {
			if c.Service() == a.ID && c.Project() == a.Project() {
				ctr, ok = c, true
			}
		}
	}
	if !ok {
		return fmt.Errorf("%s is not installed", a.ID)
	}
	path := updates.HistoryPath(h.root)
	hist := updates.LoadHistory(path)
	r := hist.Apps[a.ID]
	if r == nil || r.Previous == "" {
		return fmt.Errorf("no earlier image of %s is kept: one is kept for a week after each update", a.Name())
	}
	u := h.ui
	u.Title("Roll back " + a.Name())
	u.Info("go back to the image it ran before its update on %s", r.Updated.Local().Format("Mon 2 Jan 15:04"))
	u.Info("hold its nightly updates until homelab updates release %s", a.ID)
	if err := h.goAhead(*apply, "\nRoll back?"); err != nil {
		return err
	}
	if err := h.doRollback(ctx, client, a, ctr, &hist); err != nil {
		_ = hist.Save(path)
		return err
	}
	if err := hist.Save(path); err != nil {
		return err
	}
	u.OK("%s runs the image from before %s; updates held (homelab updates release %s)", a.Name(), r.Updated.Local().Format("2 Jan"), a.ID)
	h.alert(ctx, "watchtower", notify.Message{Title: "Homelab: " + a.Name() + " rolled back", Body: "It runs the version from before its update again. Its nightly updates are held until released.", Tags: []string{"rewind"}})
	return nil
}

// beforeUpdate dumps the databases of the apps about to be updated (and of
// the databases they use), and notes the images they run now, so the
// update can be undone.
func (h *homelab) beforeUpdate(ctx context.Context, client *docker.Client, apps []*catalog.App) error {
	containers, err := client.Containers(ctx)
	if err != nil {
		return err
	}
	h.trackUpdates(ctx, client, containers, false)
	report := detect.Analyze(h.catalog, containers)
	var dumps []string
	for _, a := range apps {
		for _, id := range append([]string{a.ID}, a.DependsOn...) {
			if _, running := runningContainer(report, id); !running {
				continue // nothing to dump from
			}
			if d, ok := h.catalog.Get(id); ok && d.Meta.Dump != "" && !slices.Contains(dumps, id) {
				dumps = append(dumps, id)
			}
		}
	}
	if len(dumps) == 0 {
		return nil
	}
	h.ui.Info("dumping %s first", strings.Join(dumps, ", "))
	if err := h.backup(ctx, []string{"--apply", "--apps", strings.Join(dumps, ",")}); err != nil {
		return fmt.Errorf("the dump before the update failed, so nothing was updated: %w", err)
	}
	return nil
}
