package main

import (
	"context"
	"slices"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/battery"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// batterySaver pauses the heavy apps while a laptop runs on battery and
// starts them again on power (BATTERY_SAVER=false turns it off). The
// watchdog runs it every 15 minutes.
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
		var apps []*catalog.App
		for _, id := range st.Paused {
			if a, ok := h.catalog.Get(id); ok {
				apps = append(apps, a)
			}
		}
		for _, pa := range h.byProject(apps) {
			if err := client.Compose(ctx, h.project(pa.file), pa.profiles, append([]string{"start"}, pa.ids...)...); err != nil {
				h.ui.Warn("battery saver: start %s: %v", strings.Join(pa.ids, ", "), err)
				return // try again next run
			}
		}
		h.ui.Info("on power again: started %s", names(apps))
		st = battery.State{}
	default:
		return
	}
	if err := st.Save(path); err != nil {
		h.ui.Warn("battery saver: %v", err)
	}
}
