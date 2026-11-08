package main

import (
	"context"
	"maps"
	"slices"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/battery"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/stopped"
)

// batterySaver pauses the heavy apps while a laptop runs on battery and
// starts them again on power (BATTERY_SAVER=false turns it off). The
// watchdog runs it every 15 minutes, and the awake job within a minute of
// the machine being plugged in (resumeOnPower).
func (h *homelab) batterySaver(ctx context.Context, client *docker.Client, containers []docker.Container) {
	// A job changing the apps (an update) has them: next run.
	if h.jobRunning() {
		return
	}
	path := battery.Path(h.root)
	st := battery.Load(path)
	onBattery, known := battery.Power()
	if strings.EqualFold(h.envMap()["BATTERY_SAVER"], "false") || !known {
		onBattery = false // resume anything paused before it was turned off
	}
	// Tdarr left running to finish its video: paused too once it has.
	if onBattery && len(st.Finishing) > 0 {
		h.pauseFinished(ctx, client, containers, st.Finishing)
		st = battery.Load(path)
	}
	switch {
	case onBattery && len(st.Paused) == 0 && len(st.Finishing) == 0:
		report := detect.Analyze(h.catalog, containers)
		var apps []*catalog.App
		for _, id := range battery.Heavy {
			a, ok := h.catalog.Get(id)
			if st, _ := report.State(id); ok && st == detect.Running {
				apps = append(apps, a)
			}
		}
		// Tdarr in the middle of a video finishes it: stopped now, it would
		// leave its half-made copy in its cache, as large as the video. It
		// takes no new file meanwhile, and a later run pauses it once idle.
		var finishing []string
		var held map[string]int
		if i := slices.IndexFunc(apps, func(a *catalog.App) bool { return a.ID == "tdarr" }); i >= 0 {
			td := newTdarrAPI(ctx, h.envMap())
			if busy, ok := td.busy(ctx); ok && busy {
				held = td.hold(ctx)
				finishing = []string{"tdarr"}
				apps = slices.Delete(apps, i, i+1)
			}
		}
		if len(apps) == 0 && len(finishing) == 0 {
			return
		}
		var paused []string
		for _, pa := range h.byProject(apps) {
			if err := client.Compose(ctx, h.project(pa.file), pa.profiles, append([]string{"stop"}, pa.ids...)...); err != nil {
				h.ui.Warn("battery saver: stop %s: %v", strings.Join(pa.ids, ", "), err)
				continue
			}
			paused = append(paused, pa.ids...)
		}
		if len(apps) > 0 {
			h.ui.Info("on battery: paused %s until it is plugged in", names(apps))
		}
		if len(finishing) > 0 {
			h.ui.Info("on battery: Tdarr finishes the video it is on, then pauses too")
			if err := battery.Finish(path, finishing, held); err != nil {
				h.ui.Warn("battery saver: %v", err)
			}
		}
		// Added to what another run paused meanwhile, never over it.
		if len(paused) > 0 {
			if err := battery.Pause(path, paused, time.Now()); err != nil {
				h.ui.Warn("battery saver: %v", err)
			}
		}
	case !onBattery && len(st.Paused) == 0 && (len(st.Finishing) > 0 || len(st.Held) > 0):
		// Plugged in before Tdarr finished: it never stopped, and gets its
		// workers back.
		h.giveBackTdarr(ctx, path, st)
	case !onBattery && len(st.Paused) > 0:
		// Only what is still stopped is started: an app started by hand
		// meanwhile, or removed, or gone from the catalog has nothing to start.
		// One stopped on purpose meanwhile is no longer the saver's to start.
		report := detect.Analyze(h.catalog, containers)
		held := stopped.Load(stopped.Path(h.root))
		var apps []*catalog.App
		for _, id := range st.Paused {
			a, ok := h.catalog.Get(id)
			if s, _ := report.State(id); ok && s == detect.Stopped && !held.Has(id) {
				apps = append(apps, a)
			}
		}
		// One app that will not start never holds back the rest: a project
		// that fails is tried app by app, and only what still fails stays
		// paused, for the next run.
		failed := map[string]bool{}
		start := func(file *compose.File, profiles, ids []string) error {
			return client.Compose(ctx, h.project(file), profiles, append([]string{"start"}, ids...)...)
		}
		for _, pa := range h.byProject(apps) {
			if start(pa.file, pa.profiles, pa.ids) == nil {
				continue
			}
			for _, id := range pa.ids {
				if err := start(pa.file, pa.profiles, []string{id}); err != nil {
					h.ui.Warn("battery saver: start %s: %v", id, err)
					failed[id] = true
				}
			}
		}
		// What failed stays paused, for the next run; the rest leaves the
		// record, along with any no longer the saver's to start.
		var started []*catalog.App
		var done []string
		for _, id := range st.Paused {
			if !failed[id] {
				done = append(done, id)
			}
		}
		for _, a := range apps {
			if !failed[a.ID] {
				started = append(started, a)
			}
		}
		if len(started) > 0 {
			h.ui.Info("on power again: started %s", names(started))
			h.noteStarted(whyBattery, ids(started)...)
		}
		if err := battery.Resume(path, done); err != nil {
			h.ui.Warn("battery saver: %v", err)
		}
		h.giveBackTdarr(ctx, path, battery.Load(path))
	}
}

// pauseFinished stops the apps left running on battery to finish their
// work, once Tdarr is converting nothing (or doesn't answer, and so can't
// be); one no longer running drops off the list.
func (h *homelab) pauseFinished(ctx context.Context, client *docker.Client, containers []docker.Container, finishing []string) {
	if busy, ok := newTdarrAPI(ctx, h.envMap()).busy(ctx); ok && busy {
		return
	}
	path := battery.Path(h.root)
	report := detect.Analyze(h.catalog, containers)
	var apps []*catalog.App
	var done []string
	for _, id := range finishing {
		a, ok := h.catalog.Get(id)
		if s, _ := report.State(id); ok && s == detect.Running {
			apps = append(apps, a)
		} else {
			done = append(done, id)
		}
	}
	var paused []string
	for _, pa := range h.byProject(apps) {
		if err := client.Compose(ctx, h.project(pa.file), pa.profiles, append([]string{"stop"}, pa.ids...)...); err != nil {
			h.ui.Warn("battery saver: stop %s: %v", strings.Join(pa.ids, ", "), err)
			continue
		}
		paused = append(paused, pa.ids...)
	}
	if len(paused) > 0 {
		h.ui.Info("on battery: Tdarr finished its video; paused until it is plugged in")
		if err := battery.Pause(path, paused, time.Now()); err != nil {
			h.ui.Warn("battery saver: %v", err)
		}
	}
	if err := battery.Finished(path, append(done, paused...)); err != nil {
		h.ui.Warn("battery saver: %v", err)
	}
}

// giveBackTdarr, on power, gives Tdarr back the workers the saver held
// from it, and forgets the apps it left finishing (they never stopped). A
// Tdarr just started may not answer yet: what is still held stays for the
// next run (the awake job looks each minute).
func (h *homelab) giveBackTdarr(ctx context.Context, path string, st battery.State) {
	if len(st.Finishing) > 0 {
		if err := battery.Finished(path, st.Finishing); err != nil {
			h.ui.Warn("battery saver: %v", err)
		}
	}
	if len(st.Held) == 0 {
		return
	}
	left := maps.Clone(st.Held)
	gave := newTdarrAPI(ctx, h.envMap()).giveBack(ctx, left)
	if err := battery.Update(path, func(s *battery.State) bool {
		s.Held = left
		if len(left) == 0 {
			s.Held = nil
		}
		return true
	}); err != nil {
		h.ui.Warn("battery saver: %v", err)
	}
	if gave {
		h.ui.Info("on power again: Tdarr converts again")
	}
}

// resumeOnPower starts what the battery saver paused within a minute of
// the machine being plugged in, rather than at the watchdog's next run (up
// to 15 minutes later): the awake job runs it beside the hold on sleep. It
// asks Docker only while something is paused and the machine is on power.
func (h *homelab) resumeOnPower(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(powerEvery):
		}
		st := battery.Load(battery.Path(h.root))
		if len(st.Paused) == 0 && len(st.Finishing) == 0 && len(st.Held) == 0 {
			continue
		}
		// On battery, it looks only while Tdarr finishes its video, to
		// pause it within a minute of it being done.
		if onBattery, known := battery.Power(); known && onBattery && !strings.EqualFold(h.envMap()["BATTERY_SAVER"], "false") && len(st.Finishing) == 0 {
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
		h.batterySaver(ctx, client, containers)
	}
}
