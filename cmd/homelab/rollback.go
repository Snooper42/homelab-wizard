package main

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/backup"
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
	if auto {
		// A page that does not answer now, and did not on the watchdog's
		// last run either, counts too: the container runs, the app not.
		quiet, answering := map[string]string{}, map[string]bool{}
		last := health.LoadState(health.StatePath(h.root))
		for _, s := range api.StatusOf(ctx, h.catalog, containers, h.envMap(), true).Apps {
			answering[s.ID] = s.NotAnswering == ""
			if _, failed := last.Failing[s.ID]; s.NotAnswering != "" && (failed || last.Pending[s.ID] > 0) {
				quiet[s.ID] = s.NotAnswering
			}
		}
		rollBack := !strings.EqualFold(h.envMap()["AUTO_ROLLBACK"], "false")
		for _, a := range h.catalog.Apps {
			ctr, ok := runningContainer(report, a.ID)
			r := hist.Apps[a.ID]
			if !ok || r == nil {
				continue
			}
			// Seen well since its update: from now on it may hold what
			// people added, so a rollback keeps today's data.
			if r.Previous != "" && r.HealthyAfter.IsZero() && ctr.State == "running" && (ctr.Health == "healthy" || ctr.Health == "") && answering[a.ID] {
				r.HealthyAfter = now
			}
			if !rollBack || !hist.Recent(a.ID, now) || (ctr.Health != "unhealthy" && ctr.State != "restarting" && quiet[a.ID] == "") {
				continue
			}
			why := "unhealthy"
			switch {
			case ctr.State == "restarting":
				why = "restarting over and over"
			case quiet[a.ID] != "":
				why = "not answering (" + quiet[a.ID] + ")"
			}
			// Its data goes back with the image only when it never came
			// up well after the update (ADR-0020): nothing new is lost.
			var cp *backup.UpdateCopy
			if r.HealthyAfter.IsZero() {
				cp, _ = h.copyFor(a.ID, r.Previous)
			}
			later, _ := h.copyFor(a.ID, r.Previous)
			if _, err := h.doRollback(ctx, client, a, ctr, &hist, cp); err != nil {
				notes = append(notes, fmt.Sprintf("%s has been %s since its update, and going back failed: %v", a.Name(), why, err))
				continue
			}
			note := fmt.Sprintf("%s was %s after its update, so it went back to the image it ran before", a.Name(), why)
			switch {
			case cp != nil:
				note += ", with its data from just before the update, as it never came up well after it (today's is set aside in recovery-staging/rolled-back/" + a.ID + ")"
			case later != nil:
				note += "; its data stays as it is, since it ran well for a while after the update. homelab rollback " + a.ID + " --data puts back its data from before the update, setting today's aside"
			}
			notes = append(notes, note+"; its updates are held until homelab updates release "+a.ID)
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
// and holds its updates, so the nightly update does not update it again.
// With cp, the copy made before that update, its data goes back too
// (putBack), and today's is set aside in the folder it returns.
func (h *homelab) doRollback(ctx context.Context, client *docker.Client, a *catalog.App, ctr docker.Container, hist *updates.History, cp *backup.UpdateCopy) (aside string, err error) {
	r := hist.Apps[a.ID]
	if r == nil || r.Previous == "" {
		return "", fmt.Errorf("no earlier image of %s is kept (one is kept for a week after each update)", a.ID)
	}
	if err := client.Tag(ctx, updates.RollbackRef(a.ID), r.Ref); err != nil {
		return "", fmt.Errorf("going back to the earlier image: %w", err)
	}
	var dataErr error
	if cp != nil {
		aside, dataErr = h.putBack(ctx, client, a, *cp)
	}
	if err := client.Compose(ctx, h.project(a.File), a.Profiles, "up", "--detach", "--no-deps", "--force-recreate", a.ID); err != nil {
		return aside, err
	}
	_ = client.RemoveImage(ctx, updates.RollbackRef(a.ID))
	r.Current, r.Previous, r.RolledBack = r.Previous, "", time.Now()
	if err := h.holdUpdates(a.ID, true); err != nil {
		return aside, fmt.Errorf("went back, but holding its updates failed: %w", err)
	}
	_ = client.PruneDangling(ctx) // the update it left
	if dataErr != nil {
		return aside, fmt.Errorf("it runs the earlier image, but its data was not all put back: %w", dataErr)
	}
	return aside, nil
}

// copyFor is the copy made before the update that brought the image
// imageID replaced: the one a rollback to imageID puts back.
func (h *homelab) copyFor(app, imageID string) (*backup.UpdateCopy, bool) {
	cp, ok := backup.LatestCopy(h.stagingDir(), app)
	if !ok || imageID == "" || cp.ImageID != imageID {
		return nil, false
	}
	return &cp, true
}

// holdUpdates leaves an app out of the nightly updates (UPDATES_HELD), or
// puts it back in; homelab update --all passes over a held app.
func (h *homelab) holdUpdates(app string, held bool) error {
	f, err := envfile.Load(h.envFile)
	if err != nil {
		return err
	}
	f.Set(updates.HeldKey, updates.SetHeld(f.Map(), app, held))
	return f.Save()
}

// rollback puts an app back on the image it ran before its last update.
func (h *homelab) rollback(ctx context.Context, args []string) error {
	fs := newFlags("rollback")
	apply := applyFlag(fs)
	imageOnly := fs.Bool("image-only", false, "")
	dataOnly := fs.Bool("data", false, "")
	pos, err := parseFlags(fs, args)
	if err != nil {
		return err
	}
	if len(pos) != 1 || *imageOnly && *dataOnly {
		return fmt.Errorf("usage: homelab rollback <app> [--image-only | --data]")
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
	if *dataOnly {
		return h.restoreData(ctx, client, a, r, *apply)
	}
	if r == nil || r.Previous == "" {
		return fmt.Errorf("no earlier image of %s is kept: one is kept for a week after each update", a.Name())
	}
	cp, haveCopy := h.copyFor(a.ID, r.Previous)
	u := h.ui
	u.Title("Roll back " + a.Name())
	u.Info("go back to the image it ran before its update on %s", r.Updated.Local().Format("Mon 2 Jan 15:04"))
	switch {
	case *imageOnly:
		u.Info("keep today's data (--image-only)")
		cp = nil
	case haveCopy:
		u.Info("put back its data from just before the update (%s), and set today's aside in %s", h.copySaid(*cp), h.rel(h.stagingDir(backup.RolledBackFolder, a.ID)))
	default:
		u.Info("its data stays as it is: no copy from before that update is kept")
	}
	u.Info("hold its nightly updates until homelab updates release %s", a.ID)
	if err := h.goAhead(*apply, "\nRoll back?"); err != nil {
		return err
	}
	aside, err := h.doRollback(ctx, client, a, ctr, &hist, cp)
	if err != nil {
		_ = hist.Save(path)
		return err
	}
	if aside != "" {
		u.OK("its data is as it was before the update; what it held since is in %s", h.rel(aside))
	}
	if err := hist.Save(path); err != nil {
		return err
	}
	u.OK("%s runs the image from before %s; updates held (homelab updates release %s)", a.Name(), r.Updated.Local().Format("2 Jan"), a.ID)
	h.alert(ctx, "watchtower", notify.Message{Title: "Homelab: " + a.Name() + " rolled back", Body: "It runs the version from before its update again. Its nightly updates are held until released.", Tags: []string{"rewind"}})
	return nil
}

// restoreData is homelab rollback <app> --data: after a rollback that kept
// today's data (the watchdog's, or --image-only), the copy from before the
// update goes back under the earlier image the app runs now.
func (h *homelab) restoreData(ctx context.Context, client *docker.Client, a *catalog.App, r *updates.Record, apply bool) error {
	if r == nil || r.RolledBack.IsZero() {
		return fmt.Errorf("%s was not rolled back: homelab rollback %s puts back its image and its data together", a.Name(), a.ID)
	}
	cp, ok := h.copyFor(a.ID, r.Current)
	if !ok {
		return fmt.Errorf("no copy of %s's data from before its update is kept for the image it runs now", a.Name())
	}
	u := h.ui
	u.Title("Restore " + a.Name() + "'s data")
	u.Info("put back its data from just before the update on %s (%s)", cp.When.Local().Format("Mon 2 Jan 15:04"), h.copySaid(*cp))
	u.Info("set what it holds now aside in %s, never deleted", h.rel(h.stagingDir(backup.RolledBackFolder, a.ID)))
	if err := h.goAhead(apply, "\nRestore its data?"); err != nil {
		return err
	}
	aside, err := h.putBack(ctx, client, a, *cp)
	if uerr := client.Compose(ctx, h.project(a.File), a.Profiles, "up", "--detach", "--no-deps", a.ID); err == nil {
		err = uerr
	}
	if err != nil {
		return err
	}
	u.OK("%s's data is as it was before the update; what it held since is in %s", a.Name(), h.rel(aside))
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
