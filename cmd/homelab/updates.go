package main

import (
	"context"
	"fmt"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/updates"
)

// updates shows, pauses, or resumes nightly image updates, and shows
// what updating an app brings.
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
		question := "Pause the nightly updates until they are resumed?"
		if !paused {
			question = "Run the nightly updates again?"
		}
		if err := h.goAhead(*apply, question); err != nil {
			return err
		}
		s, err := updates.SetPaused(h.envFile, paused)
		if err != nil {
			return err
		}
		show(s)
		return nil
	case "notes":
		if len(rest) != 2 {
			return fmt.Errorf("usage: homelab updates notes <app>")
		}
		return h.releaseNotes(ctx, rest[1])
	case "hold", "release":
		if len(rest) != 2 {
			return fmt.Errorf("usage: homelab updates %s <app>", action)
		}
		a, ok := h.catalog.Get(rest[1])
		if !ok || a.Native() != nil {
			return fmt.Errorf("unknown container app %q", rest[1])
		}
		if err := h.holdUpdates(a.ID, action == "hold"); err != nil {
			return err
		}
		if action == "hold" {
			u.OK("%s is left out of nightly updates (homelab updates release %s)", a.Name(), a.ID)
		} else {
			u.OK("%s is updated nightly again", a.Name())
		}
		return nil
	}
	return fmt.Errorf("unknown updates command %q (status, pause, resume, notes, hold, release)", action)
}
