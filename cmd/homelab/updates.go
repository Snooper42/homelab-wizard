package main

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/envfile"
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
		if days := updates.Days(h.envMap()); len(days) > 0 && !u.JSON {
			var on []string
			for _, a := range h.catalog.Apps {
				if d, ok := days[a.ID]; ok {
					on = append(on, a.Name()+" on "+updates.DaysText(d))
				}
			}
			u.Printf("On their own days: %s (homelab updates days <app> every).\n", strings.Join(on, ", "))
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
	case "days":
		// homelab updates days immich sun: the nightly update takes Immich
		// on Sundays only; every puts it back to every night.
		if len(rest) < 2 {
			return fmt.Errorf("usage: homelab updates days <app> [sun|sat+sun|weekend|every]")
		}
		a, ok := h.catalog.Get(rest[1])
		if !ok || a.Native() != nil {
			return fmt.Errorf("unknown container app %q", rest[1])
		}
		if len(rest) == 2 {
			u.Printf("%s is updated %s.\n", a.Name(), onDays(updates.Days(h.envMap())[a.ID]))
			return nil
		}
		days, err := updates.ParseDays(strings.Join(rest[2:], " "))
		if err != nil {
			return err
		}
		f, err := envfile.Load(h.envFile)
		if err != nil {
			return err
		}
		f.Set(updates.DaysKey, updates.SetDays(f.Map(), a.ID, days))
		if err := f.Save(); err != nil {
			return err
		}
		u.OK("%s is updated %s", a.Name(), onDays(days))
		return nil
	}
	return fmt.Errorf("unknown updates command %q (status, pause, resume, notes, hold, release, days)", action)
}

// onDays says when the nightly update takes an app: "every night", or "by
// the nightly update on Sundays only".
func onDays(days []time.Weekday) string {
	if len(days) == 0 {
		return "every night"
	}
	return "by the nightly update on " + updates.DaysText(days) + " only"
}
