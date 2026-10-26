package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

// kopiaCmd is homelab kopia repository.
func (h *homelab) kopiaCmd(ctx context.Context, args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: homelab kopia repository <folder>")
	}
	switch args[0] {
	case "repository":
		return h.kopiaRepository(ctx, args[1:])
	}
	return fmt.Errorf("unknown kopia command %q (repository)", args[0])
}

// kopiaRepository sets KOPIA_REPOSITORY, the folder Kopia keeps its copies
// in, and starts Kopia again on it when it is installed. The folder is
// never inside Duplicati's backups or the folders Kopia backs up
// (ADR-0019): a second copy in the same place is no second copy.
func (h *homelab) kopiaRepository(ctx context.Context, args []string) error {
	fs := newFlags("kopia repository")
	apply := applyFlag(fs)
	pos, err := parseFlags(fs, args)
	if err != nil {
		return err
	}
	if len(pos) != 1 {
		return fmt.Errorf("usage: homelab kopia repository <folder> (best on another drive than Duplicati's backups)")
	}
	repo := h.hostPath(pos[0])
	env := h.envMap()
	if dup := env["BACKUP_DESTINATION"]; dup != "" {
		dup = h.hostPath(dup)
		if backup.Within(repo, dup) || backup.Within(dup, repo) {
			return fmt.Errorf("%s is where Duplicati's backups are (BACKUP_DESTINATION %s): Kopia's copy goes somewhere else, best another drive", repo, dup)
		}
	}
	for _, src := range []string{"data", "appdata", "stacks", "recovery-staging"} {
		if p := filepath.Join(h.root, src); backup.Within(repo, p) || backup.Within(p, repo) {
			return fmt.Errorf("%s is in the folders Kopia backs up (%s): choose a folder outside them, best on another drive", repo, p)
		}
	}
	u := h.ui
	u.Title("Kopia's repository")
	u.Info("KOPIA_REPOSITORY → %s", repo)
	switch {
	case isFile(filepath.Join(repo, "kopia.repository.f")):
		u.Info("a Kopia repository is already there: Kopia connects to it with KOPIA_PASSWORD")
	case dirExists(repo):
		u.Info("Kopia makes its repository there, encrypted with KOPIA_PASSWORD")
	default:
		u.Info("the folder is made now, and Kopia makes its repository there, encrypted with KOPIA_PASSWORD")
	}
	if old := env["KOPIA_REPOSITORY"]; old != "" && h.hostPath(old) != repo && isFile(filepath.Join(h.hostPath(old), "kopia.repository.f")) {
		u.Info("the copies already in %s stay there; new ones go to the new folder", h.hostPath(old))
	}
	if err := h.goAhead(*apply, "\nUse this folder?"); err != nil {
		return err
	}
	if err := os.MkdirAll(repo, 0o755); err != nil {
		return err
	}
	// Kopia runs as you (PUID), so you must be able to write there; a
	// drive formatted exFAT takes its owner from how it was mounted.
	probe, err := os.CreateTemp(repo, ".homelab-write-test-*")
	if err != nil {
		return fmt.Errorf("you cannot write to %s, and Kopia runs as you: %w (a drive formatted exFAT or FAT takes its owner from how it was mounted)", repo, err)
	}
	_ = probe.Close()
	_ = os.Remove(probe.Name())
	f, err := envfile.Load(h.envFile)
	if err != nil {
		return err
	}
	f.Set("KOPIA_REPOSITORY", repo)
	if err := f.Save(); err != nil {
		return err
	}
	u.OK("KOPIA_REPOSITORY is %s", repo)
	return h.restartKopia(ctx)
}

// restartKopia recreates Kopia's container, when there is one, so it
// mounts the new repository folder; without one, homelab install kopia
// uses it.
func (h *homelab) restartKopia(ctx context.Context) error {
	a, ok := h.catalog.Get("kopia")
	if !ok {
		return nil
	}
	client, err := h.docker(ctx)
	if err != nil {
		h.ui.Info("then homelab install kopia")
		return nil
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return err
	}
	for _, c := range containers {
		if c.Project() == h.project(a.File).Name && c.Service() == a.ID {
			if err := client.Compose(ctx, h.project(a.File), a.Profiles, "up", "--detach", "--force-recreate", a.ID); err != nil {
				return err
			}
			h.ui.OK("Kopia started again on the new folder")
			return nil
		}
	}
	h.ui.Info("Kopia is not installed yet: homelab install kopia")
	return nil
}

func isFile(p string) bool {
	st, err := os.Stat(p)
	return err == nil && st.Mode().IsRegular()
}

func dirExists(p string) bool {
	st, err := os.Stat(p)
	return err == nil && st.IsDir()
}
