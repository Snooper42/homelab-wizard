package main

import (
	"context"
	"fmt"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/custom"
	"github.com/Snooper42/homelab-wizard/internal/detect"
)

// custom lists, adds, or removes your own apps (internal/custom).
func (h *homelab) custom(ctx context.Context, args []string) error {
	action := "list"
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		action, args = args[0], args[1:]
	}
	u := h.ui
	switch action {
	case "list":
		apps := custom.Apps(h.catalog)
		if len(apps) == 0 {
			u.Println("No apps of your own yet: homelab custom add <id> --image <image> --port <web port>")
			return nil
		}
		u.Title("Your own apps")
		var rows [][]string
		for _, a := range apps {
			rows = append(rows, []string{a.ID, u.Dim(a.Image), a.Meta.Description})
		}
		u.Table(nil, rows)
		return nil

	case "add":
		fs := newFlags("custom add")
		apply := applyFlag(fs)
		spec := custom.Spec{Env: map[string]string{}}
		fs.StringVar(&spec.Image, "image", "", "")
		fs.IntVar(&spec.Port, "port", 0, "")
		fs.StringVar(&spec.Name, "name", "", "")
		fs.StringVar(&spec.Category, "category", "documents", "")
		fs.StringVar(&spec.Description, "description", "", "")
		fs.Func("volume", "", func(v string) error { spec.Volumes = append(spec.Volumes, v); return nil })
		fs.Func("env", "", func(kv string) error {
			k, v, ok := strings.Cut(kv, "=")
			if !ok {
				return fmt.Errorf("--env wants KEY=value")
			}
			spec.Env[k] = v
			return nil
		})
		install := fs.Bool("install", false, "")
		rest, err := parseFlags(fs, args)
		if err != nil {
			return err
		}
		if len(rest) != 1 {
			return fmt.Errorf("usage: homelab custom add <id> --image <image> [--port <web port>] [--name <name>] [--category <id>] [--description <text>] [--volume /path]... [--env KEY=value]... [--install]")
		}
		spec.ID = rest[0]
		if spec.Name == "" {
			spec.Name = spec.ID
		}
		if err := spec.Check(h.catalog); err != nil {
			return err
		}
		env := h.envMap()
		port := custom.FreePort(h.catalog, env)
		u.Title("Add " + spec.Name)
		u.Info("service %s in %s, optional (it starts with homelab install %s)", spec.ID, custom.File, spec.ID)
		u.Info("image %s, category %s", spec.Image, h.catalog.CategoryLabel(spec.Category))
		if spec.Port > 0 {
			u.Info("web port %d: http://localhost:%d on %s, https://%s.%s after domain setup", spec.Port, port, h.host.Machine, spec.ID, env["HOMELAB_DOMAIN"])
		}
		for _, v := range spec.Volumes {
			u.Info("keep %s in data/appdata/%s (backed up with the other apps' data)", v, spec.ID)
		}
		if err := h.goAhead(*apply, "\nAdd it?"); err != nil {
			return err
		}
		next, _, err := custom.Add(h.root, h.catalog, spec, env)
		if err != nil {
			return err
		}
		h.catalog = next
		u.OK("added %s to %s (yours alone, like .env: git ignores it)", spec.ID, custom.File)
		if *install {
			return h.runInstall(ctx, []string{spec.ID}, installOptions{apply: *apply}, "Install plan")
		}
		u.Printf("\n  Install it with %s; %s gives it its address.\n", u.Bold("homelab install "+spec.ID), u.Bold("homelab domain setup"))
		return nil

	case "remove":
		fs := newFlags("custom remove")
		apply := applyFlag(fs)
		rest, err := parseFlags(fs, args)
		if err != nil {
			return err
		}
		if len(rest) != 1 {
			return fmt.Errorf("usage: homelab custom remove <id>")
		}
		id := rest[0]
		if client, err := h.docker(ctx); err == nil {
			if containers, err := client.Containers(ctx); err == nil {
				if st, _ := detect.Analyze(h.catalog, containers).State(id); st == detect.Running {
					return fmt.Errorf("%s is running; remove its container first: homelab remove %s", id, id)
				}
			}
		}
		u.Title("Remove " + id)
		u.Info("take %s out of %s", id, custom.File)
		u.Info("its data in data/appdata/%s stays", id)
		if err := h.goAhead(*apply, "\nRemove it?"); err != nil {
			return err
		}
		if err := custom.Remove(h.root, id); err != nil {
			return err
		}
		u.OK("removed %s", id)
		return nil
	}
	return fmt.Errorf("unknown custom command %q (list, add, remove)", action)
}
