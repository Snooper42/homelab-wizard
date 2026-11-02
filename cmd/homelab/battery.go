package main

import (
	"context"
	"slices"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/battery"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// batterySaver pauses the heavy apps while a laptop runs on battery and
// starts them again on power (BATTERY_SAVER=false turns it off). The
// watchdog runs it every 15 minutes, and the awake job within a minute of
// the machine being plugged in (resumeOnPower).
func (h *homelab) batterySaver(ctx context.Context, client *docker.Client, containers []docker.Container) {
	path := battery.Path(h.root)
	st := battery.Load(path)
	onBattery, known := battery.Power()
	if strings.EqualFold(h.envMap()["BATTERY_SAVER"], "false") || !known {
		onBattery = false // resume anything paused before it was turned off
	}
	switch {
	case onBattery && len(st.Paused) == 0:
		report := detect.Analyze(h.catalog, containers)
		var apps []*catalog.App
		for _, id := range battery.Heavy {
			a, ok := h.catalog.Get(id)
			if st, _ := report.State(id); ok && st == detect.Running {
				apps = append(apps, a)
			}
		}
		if len(apps) == 0 {
			return
		}
		for _, pa := range h.byProject(apps) {
			if err := client.Compose(ctx, h.project(pa.file), pa.profiles, append([]string{"stop"}, pa.ids...)...); err != nil {
				h.ui.Warn("battery saver: stop %s: %v", strings.Join(pa.ids, ", "), err)
				continue
			}
			st.Paused = append(st.Paused, pa.ids...)
		}
		slices.Sort(st.Paused)
		st.Since = time.Now()
		h.ui.Info("on battery: paused %s until it is plugged in", names(apps))
	case !onBattery && len(st.Paused) > 0:
		// Only what is still stopped is started: an app started by hand
		// meanwhile, or removed, or gone from the catalog has nothing to start.
		report := detect.Analyze(h.catalog, containers)
		var apps []*catalog.App
		for _, id := range st.Paused {
			a, ok := h.catalog.Get(id)
			if s, _ := report.State(id); ok && s == detect.Stopped {
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
		var started []*catalog.App
		var still []string
		for _, a := range apps {
			if failed[a.ID] {
				still = append(still, a.ID)
			} else {
				started = append(started, a)
			}
		}
		if len(started) > 0 {
			h.ui.Info("on power again: started %s", names(started))
		}
		st = battery.State{Paused: still, Since: st.Since}
	default:
		return
	}
	if err := st.Save(path); err != nil {
		h.ui.Warn("battery saver: %v", err)
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
		if len(battery.Load(battery.Path(h.root)).Paused) == 0 {
			continue
		}
		if onBattery, known := battery.Power(); known && onBattery && !strings.EqualFold(h.envMap()["BATTERY_SAVER"], "false") {
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
