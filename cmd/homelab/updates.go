package main

import (
	"context"
	"fmt"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/detect"

	"github.com/Snooper42/homelab-wizard/internal/updates"
)

// updates shows, pauses, or resumes nightly image updates.
func (h *homelab) updates(ctx context.Context, args []string) error {
	fs := newFlags("updates")
	apply := applyFlag(fs)
	rest, err := parseFlags(fs, args)
	if err != nil {
		return err
	}
	action := "status"
	if len(rest) > 0 {
		action = rest[0]
	}
	u := h.ui
	show := func(s updates.State) {
		switch {
		case u.JSON:
			emit(u, "updates", s)
		case s.Paused:
			u.Printf("Nightly updates are paused (homelab updates resume).\n")
		default:
			u.Printf("Nightly updates run %s.\n", s.Schedule)
		}
		if held := updates.Held(h.envMap()); len(held) > 0 && !u.JSON {
			u.Printf("Held (not updated): %s (homelab updates release <app>).\n", strings.Join(held, ", "))
		}
	}
	switch action {
	case "status":
		show(updates.Get(h.envMap()))
		return nil
	case "pause", "resume":
		paused := action == "pause"
		question := "Stop Watchtower until updates are resumed?"
		if !paused {
			question = "Start Watchtower again?"
		}
		if err := h.goAhead(*apply, question); err != nil {
			return err
		}
		client, err := h.docker(ctx)
		if err != nil {
			return err
		}
		s, err := updates.SetPaused(ctx, h.catalog, client, h.envFile, paused)
		if err != nil {
			return err
		}
		show(s)
		return nil
	case "hold", "release":
		if len(rest) != 2 {
			return fmt.Errorf("usage: homelab updates %s <app>", action)
		}
		a, ok := h.catalog.Get(rest[1])
		if !ok || a.Native() != nil {
			return fmt.Errorf("unknown container app %q", rest[1])
		}
		client, err := h.docker(ctx)
		if err != nil {
			return err
		}
		containers, err := client.Containers(ctx)
		if err != nil {
			return err
		}
		name := ""
		if ctr, ok := runningContainer(detect.Analyze(h.catalog, containers), a.ID); ok {
			name = ctr.Name
		}
		if action == "hold" && name == "" {
			return fmt.Errorf("%s is not running", a.ID)
		}
		path := updates.HistoryPath(h.root)
		hist := updates.LoadHistory(path)
		r := hist.Apps[a.ID]
		if err := h.holdUpdates(ctx, client, a.ID, name, r, action == "hold"); err != nil {
			return err
		}
		if err := hist.Save(path); err != nil {
			return err
		}
		if action == "hold" {
			u.OK("%s is left out of nightly updates (homelab updates release %s)", a.Name(), a.ID)
		} else {
			u.OK("%s is updated nightly again", a.Name())
		}
		return nil
	}
	return fmt.Errorf("unknown updates command %q (status, pause, resume, hold, release)", action)
}
