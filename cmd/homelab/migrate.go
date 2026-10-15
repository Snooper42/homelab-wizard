package main

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// move is a container still in an old project, and where its app lives now.
type move struct {
	app       *catalog.App
	container docker.Container
}

// moves lists the containers to move into their apps' current projects.
func moves(c *catalog.Catalog, containers []docker.Container) []move {
	var out []move
	for _, ctr := range containers {
		if !catalog.LegacyProjects[ctr.Project()] {
			continue
		}
		a, ok := c.Get(ctr.Service())
		if !ok || a.ID != ctr.Service() || a.Native() != nil || a.Project() == ctr.Project() {
			continue
		}
		out = append(out, move{a, ctr})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].app.ID < out[j].app.ID })
	return out
}

// migrate moves apps from an old Compose project into the one they belong
// to now: a fresh backup first, then each old container is removed and the
// app started again in its category's project. Data stays where it is:
// the folders under data/ and the named volumes keep their names.
func (h *homelab) migrate(ctx context.Context, args []string) error {
	fs := newFlags("migrate")
	apply := applyFlag(fs)
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	u := h.ui
	client, err := h.docker(ctx)
	if err != nil {
		return err
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return err
	}
	ms := moves(h.catalog, containers)
	if len(ms) == 0 {
		u.OK("every app is in its category's project; nothing to move")
		return nil
	}
	u.Title("Move apps into their category projects")
	byProject := map[string][]string{}
	var start []string
	for _, m := range ms {
		byProject[m.app.Project()] = append(byProject[m.app.Project()], m.app.Name())
		if m.container.Running {
			start = append(start, m.app.ID)
		}
	}
	var projects []string
	for p := range byProject {
		projects = append(projects, p)
	}
	sort.Strings(projects)
	for _, p := range projects {
		u.Info("%s: %s", p, strings.Join(byProject[p], ", "))
	}
	u.Info("each app's container is recreated in its new project, %d of them started again; settings and data stay (data/ folders and volumes keep their names)", len(start))
	u.Info("a backup runs first, as the nightly one does")
	if err := h.goAhead(*apply, fmt.Sprintf("\nMove %d app(s)?", len(ms))); err != nil {
		return err
	}

	if err := h.backup(ctx, []string{"--apply"}); err != nil {
		return fmt.Errorf("the backup before moving failed, so nothing was moved: %w", err)
	}
	for _, m := range ms {
		if _, err := client.Runner.Output(ctx, client.Bin, "rm", "--force", m.container.Name); err != nil {
			return fmt.Errorf("removing %s: %w (the apps moved so far start with homelab up)", m.container.Name, err)
		}
		u.OK("removed %s (%s moves to %s)", m.container.Name, m.app.Name(), m.app.Project())
	}
	if len(start) > 0 {
		containers, err = client.Containers(ctx)
		if err != nil {
			return err
		}
		removed := map[string]bool{}
		for _, m := range ms {
			removed[m.container.Name] = true
		}
		var left []docker.Container
		for _, c := range containers {
			if !removed[c.Name] {
				left = append(left, c)
			}
		}
		if err := h.installApps(ctx, client, left, start); err != nil {
			return fmt.Errorf("starting the moved apps: %w (homelab up starts the baseline; homelab install <app> the others)", err)
		}
	}
	u.OK("moved %d app(s); OrbStack now shows them by category", len(ms))
	return nil
}
