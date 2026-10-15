package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/adopt"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/selector"
)

// copyImage runs the copies; small, and pulled once.
const copyImage = "alpine:3.20"

// adopt moves apps that run outside the homelab into it (internal/adopt).
func (h *homelab) adopt(ctx context.Context, args []string) error {
	fs := newFlags("adopt")
	apply := applyFlag(fs)
	tokens, err := parseFlags(fs, args)
	if err != nil {
		return err
	}
	if len(tokens) == 0 {
		return fmt.Errorf("name the apps to adopt (homelab status lists them as elsewhere)")
	}
	env := h.envMap()
	if len(env) == 0 {
		return fmt.Errorf(".env does not exist yet; run homelab up first")
	}
	example, err := envfile.Load(filepath.Join(h.root, ".env.example"))
	if err != nil {
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
	sel, err := selector.Resolve(h.catalog, tokens, nil)
	if err != nil {
		return err
	}
	report := detect.Analyze(h.catalog, containers)
	ours := map[string]bool{}
	for _, f := range h.catalog.Files {
		ours[f.Name] = true
	}
	home, _ := os.UserHomeDir()
	var steps []adopt.Step
	var problems, ids []string
	running := map[string]bool{}
	for _, a := range sel.Apps {
		ids = append(ids, a.ID)
		state, m := report.State(a.ID)
		if state == detect.Running {
			problems = append(problems, a.ID+" already runs in the homelab")
			continue
		}
		name := ""
		if state == detect.External {
			name = m.Container.Name
		} else {
			// Helpers (databases, caches) are found by their container name.
			for _, c := range containers {
				if c.Name == a.ID && !ours[c.Project()] {
					name = c.Name
				}
			}
		}
		if name == "" {
			continue // nothing old to adopt; it starts fresh
		}
		old, isRunning, err := inspectOld(ctx, client, name)
		if err != nil {
			return err
		}
		running[name] = isRunning
		step, err := adopt.Plan(h.catalog, a, old, env, example.Map(), home)
		if err != nil {
			problems = append(problems, a.ID+": "+err.Error())
			continue
		}
		for _, cp := range step.Copies {
			if why := occupied(ctx, client, cp); why != "" {
				problems = append(problems, a.ID+": "+why+"; move it aside first")
			}
		}
		steps = append(steps, step)
	}

	u := h.ui
	u.Title("Adopt")
	for _, s := range steps {
		u.Printf("  %s %s\n", u.Bold(s.App.ID), u.Dim("from container "+s.Old.Name))
		for _, cp := range s.Copies {
			u.Info("copy %s → %s", describe(h, cp.From, cp.FromVolume), describe(h, cp.To, cp.ToVolume))
		}
		keys := make([]string, 0, len(s.Settings))
		for k := range s.Settings {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			u.Info("carry %s over from the old container (into .env)", k)
		}
	}
	for _, p := range problems {
		u.Fail("%s", p)
	}
	if len(problems) > 0 {
		return fmt.Errorf("nothing was changed")
	}
	if len(steps) == 0 {
		u.Println("Nothing to adopt: none of these run outside the homelab.")
		return nil
	}
	u.Printf("\n  %s\n", u.Dim("The old containers are stopped, not removed, and their data stays where it is."))
	if err := h.goAhead(*apply, "\nStop the old containers, copy their data, and start the apps in the homelab?"); err != nil {
		return err
	}

	u.Println()
	// Apps before the databases they use, so nothing loses its database
	// while it is still running.
	for i := len(steps) - 1; i >= 0; i-- {
		s := steps[i]
		if running[s.Old.Name] {
			u.Info("stopping %s (can take up to 10 seconds)…", s.Old.Name)
			if _, err := client.Runner.Output(ctx, client.Bin, "stop", s.Old.Name); err != nil {
				return fmt.Errorf("stopping %s: %w", s.Old.Name, err)
			}
			u.OK("stopped %s", s.Old.Name)
		}
	}
	settings := map[string]string{}
	for _, s := range steps {
		for _, cp := range s.Copies {
			if err := copyData(ctx, client, s.App.Project(), cp); err != nil {
				return fmt.Errorf("copying %s for %s: %w", cp.Target, s.App.ID, err)
			}
			u.OK("copied %s → %s", describe(h, cp.From, cp.FromVolume), describe(h, cp.To, cp.ToVolume))
		}
		for k, v := range s.Settings {
			settings[k] = v
		}
	}
	if len(settings) > 0 {
		f, err := envfile.Load(h.envFile)
		if err != nil {
			return err
		}
		for k, v := range settings {
			f.Set(k, v)
		}
		if err := f.Save(); err != nil {
			return err
		}
		u.OK("carried %d setting(s) into .env", len(settings))
	}
	if err := h.runInstall(ctx, ids, installOptions{apply: true}, "Start in the homelab"); err != nil {
		return err
	}
	var names []string
	for _, s := range steps {
		names = append(names, s.Old.Name)
	}
	u.Printf("\n  %s\n", u.Dim(fmt.Sprintf("To go back: homelab remove %s --apply, then docker start %s", strings.Join(ids, " "), strings.Join(names, " "))))
	return nil
}

// inspectOld reads an old container's image, mounts, and environment.
func inspectOld(ctx context.Context, client *docker.Client, name string) (adopt.Old, bool, error) {
	out, err := client.Runner.Output(ctx, client.Bin, "inspect", name)
	if err != nil {
		return adopt.Old{}, false, fmt.Errorf("inspecting %s: %w", name, err)
	}
	var info []struct {
		Config struct {
			Image string
			Env   []string
		}
		State  struct{ Running bool }
		Mounts []adopt.Mount
	}
	if err := json.Unmarshal(out, &info); err != nil || len(info) == 0 {
		return adopt.Old{}, false, fmt.Errorf("reading docker inspect %s: %v", name, err)
	}
	old := adopt.Old{Name: name, Image: info[0].Config.Image, Mounts: info[0].Mounts, Env: map[string]string{}}
	for _, kv := range info[0].Config.Env {
		if k, v, ok := strings.Cut(kv, "="); ok {
			old.Env[k] = v
		}
	}
	return old, info[0].State.Running, nil
}

// occupied explains why a copy's destination cannot take the data, or "".
func occupied(ctx context.Context, client *docker.Client, cp adopt.Copy) string {
	if cp.ToVolume {
		if _, err := client.Runner.Output(ctx, client.Bin, "volume", "inspect", cp.To); err == nil {
			return "the volume " + cp.To + " already exists"
		}
		return ""
	}
	if entries, err := os.ReadDir(cp.To); err == nil && len(entries) > 0 {
		return cp.To + " already has files"
	}
	return ""
}

// copyData copies a folder or volume into the homelab's, with cp -a in a
// throwaway container so ownership and permissions survive.
func copyData(ctx context.Context, client *docker.Client, project string, cp adopt.Copy) error {
	if cp.ToVolume {
		key := strings.TrimPrefix(cp.To, project+"_")
		if _, err := client.Runner.Output(ctx, client.Bin, "volume", "create",
			"--label", "com.docker.compose.project="+project, "--label", "com.docker.compose.volume="+key, cp.To); err != nil {
			return err
		}
	} else if err := os.MkdirAll(cp.To, 0o755); err != nil {
		return err
	}
	mount := func(src string, volume bool, dst string, readonly bool) string {
		kind := "bind"
		if volume {
			kind = "volume"
		}
		s := "type=" + kind + ",src=" + src + ",dst=" + dst
		if readonly {
			s += ",readonly"
		}
		return s
	}
	_, err := client.Runner.Output(ctx, client.Bin, "run", "--rm",
		"--mount", mount(cp.From, cp.FromVolume, "/from", true),
		"--mount", mount(cp.To, cp.ToVolume, "/to", false),
		copyImage, "cp", "-a", "/from/.", "/to/")
	return err
}

// describe names a copy end for people: a volume, or a folder (relative
// to the homelab when inside it).
func describe(h *homelab, path string, volume bool) string {
	if volume {
		return "volume " + path
	}
	return h.rel(path)
}
