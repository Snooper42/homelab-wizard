package main

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
)

// statusTiming reads Status the way the app does, one part at a time, and
// says how long each took: what makes a slow Status slow on this machine
// (each docker command costs more on Windows than on a Mac).
func (h *homelab) statusTiming(ctx context.Context) []string {
	var lines []string
	took := func(what string, since time.Time) {
		lines = append(lines, fmt.Sprintf("%-46s %6d ms", what, time.Since(since).Milliseconds()))
	}
	t := time.Now()
	client, err := h.docker(ctx)
	took("reaching the runtime (info)", t)
	if err != nil {
		return append(lines, "the runtime: "+err.Error())
	}
	lines = append([]string{"reading through " + client.Reads()}, lines...)
	t = time.Now()
	containers, err := client.Containers(ctx)
	took(fmt.Sprintf("the containers (list and inspect, %d)", len(containers)), t)
	if err != nil {
		return append(lines, "the containers: "+err.Error())
	}
	t = time.Now()
	st := api.StatusRemembered(ctx, h.catalog, containers, h.envMap(), false)
	took("each app's state", t)
	t = time.Now()
	api.Probe(ctx, st.Apps)
	asked := 0
	for _, s := range st.Apps {
		if api.Askable(s, time.Now()) {
			asked++
		}
	}
	took(fmt.Sprintf("asking the apps' pages (%d)", asked), t)
	t = time.Now()
	api.Changed(ctx, h.catalog, client, h.envFile, containers)
	took("settings not applied yet (docker compose config)", t)
	t = time.Now()
	_, err = client.Stats(ctx)
	took("what's using power (stats)", t)
	if err != nil {
		lines = append(lines, "docker stats: "+err.Error())
	}
	return lines
}

// printTiming prints statusTiming for homelab status --timing.
func (h *homelab) printTiming(ctx context.Context) {
	h.ui.Title("How long Status takes here")
	h.ui.Printf("  %s\n", strings.Join(h.statusTiming(ctx), "\n  "))
	h.ui.Printf("\n  %s\n", h.ui.Dim("The page answers and the settings check are kept for a while, so a second run is faster."))
}
