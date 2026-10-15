package main

import (
	"context"
	"fmt"
	"os"

	"github.com/Snooper42/homelab-wizard/internal/wiring"
)

// wire connects the running apps to each other (internal/wiring).
func (h *homelab) wire(ctx context.Context, args []string) error {
	fs := newFlags("wire")
	apply := applyFlag(fs)
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	client, err := h.docker(ctx)
	if err != nil {
		return err
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return err
	}
	home, _ := os.UserHomeDir()
	w := wiring.New(h.catalog, containers, h.envMap(), home)
	u := h.ui
	plan := w.Plan()
	if u.JSON {
		emit(u, "wiring", plan)
	} else if len(plan) == 0 {
		u.Println("Nothing to connect: none of Prowlarr, Sonarr, Radarr, Lidarr, qBittorrent, Seerr, or Bazarr is running.")
		return nil
	} else {
		u.Title("Connect apps")
		for _, l := range plan {
			u.Info("%s", l.Text)
		}
	}
	if len(plan) == 0 {
		return nil
	}
	if err := h.goAhead(*apply, "\nConnect them?"); err != nil {
		return err
	}
	if !u.JSON {
		u.Println()
	}
	failed := 0
	w.Apply(ctx, func(l wiring.Link) {
		if l.State == "failed" {
			failed++
		}
		if u.JSON {
			emit(u, "link", l)
			return
		}
		switch l.State {
		case "done", "already":
			u.OK("%s%s", l.Text, u.Dim(map[string]string{"done": "", "already": " (already)"}[l.State]))
		case "manual":
			u.Warn("%s: %s", l.Text, l.Detail)
			return
		default:
			u.Fail("%s: %s", l.Text, l.Detail)
			return
		}
		if l.Detail != "" {
			u.Printf("    %s\n", u.Dim(l.Detail))
		}
	})
	if failed > 0 {
		return fmt.Errorf("%d link(s) failed", failed)
	}
	return nil
}
