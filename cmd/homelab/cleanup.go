package main

import (
	"context"
	"fmt"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/detect"
)

// cleanup removes the stopped containers an older setup left behind once
// their apps run in the homelab (after homelab adopt). Volumes go only with
// --volumes, and only when no other container uses them; folders are
// never touched.
func (h *homelab) cleanup(ctx context.Context, args []string) error {
	fs := newFlags("cleanup")
	apply := applyFlag(fs)
	withVolumes := fs.Bool("volumes", false, "")
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
	report := detect.Analyze(h.catalog, containers)
	ours := map[string]bool{}
	for _, f := range h.catalog.Files {
		ours[f.Name] = true
	}
	type old struct{ name, image, app string }
	var olds []old
	seen := map[string]bool{}
	for _, a := range h.catalog.Apps {
		if st, _ := report.State(a.ID); st != detect.Running {
			continue // only apps the homelab runs itself
		}
		for _, c := range containers {
			if c.Running || ours[c.Project()] || seen[c.Name] {
				continue
			}
			matched := c.Name == a.ID
			for _, m := range report.Matches(a.ID) {
				matched = matched || m.Container.Name == c.Name
			}
			if matched {
				seen[c.Name] = true
				olds = append(olds, old{c.Name, c.Image, a.ID})
			}
		}
	}
	var volumes, kept []string
	if *withVolumes {
		for _, o := range olds {
			info, _, err := inspectOld(ctx, client, o.name)
			if err != nil {
				return err
			}
			for _, m := range info.Mounts {
				if m.Type != "volume" || m.Name == "" {
					continue
				}
				out, _ := client.Runner.Output(ctx, client.Bin, "ps", "--all", "--filter", "volume="+m.Name, "--format", "{{.Names}}")
				shared := false
				for _, user := range strings.Fields(string(out)) {
					shared = shared || !seen[user]
				}
				if shared {
					kept = append(kept, m.Name)
				} else {
					volumes = append(volumes, m.Name)
				}
			}
		}
	}

	u := h.ui
	u.Title("Clean up")
	if len(olds) == 0 {
		u.Println("Nothing to clean up: no stopped container belongs to an app the homelab now runs.")
		return nil
	}
	for _, o := range olds {
		u.Info("remove container %s %s", o.name, u.Dim("("+o.image+"; the homelab runs "+o.app+")"))
	}
	for _, v := range volumes {
		u.Info("remove volume %s", v)
	}
	for _, v := range kept {
		u.Info("keep volume %s %s", v, u.Dim("(another container uses it)"))
	}
	if !*withVolumes {
		u.Printf("  %s\n", u.Dim("Their volumes stay; add --volumes to remove them too (only after checking the apps in the homelab)."))
	}
	u.Printf("  %s\n", u.Dim("Folders the old containers used are never touched; delete them yourself when sure."))
	if err := h.goAhead(*apply, fmt.Sprintf("\nRemove %d container(s) and %d volume(s)?", len(olds), len(volumes))); err != nil {
		return err
	}
	names := make([]string, len(olds))
	for i, o := range olds {
		names[i] = o.name
	}
	if _, err := client.Runner.Output(ctx, client.Bin, append([]string{"rm"}, names...)...); err != nil {
		return fmt.Errorf("removing containers: %w", err)
	}
	u.OK("removed %d container(s)", len(names))
	if len(volumes) > 0 {
		if _, err := client.Runner.Output(ctx, client.Bin, append([]string{"volume", "rm"}, volumes...)...); err != nil {
			return fmt.Errorf("removing volumes: %w", err)
		}
		u.OK("removed %d volume(s)", len(volumes))
	}
	return nil
}
