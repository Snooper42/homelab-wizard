package main

// homelab appdata: where the apps' data lives, and moving it (quality-loop D3 part 2, the owner's yes of Nov 26,
// "keep the old copy"). The move stops the apps, copies the folder, checks every file, points APPDATA_ROOT at the
// copy, recreates the apps on it, and runs a restore test; the old folder stays until homelab appdata remove-old.
//
//	homelab appdata                      where it is, and any old copy kept
//	homelab appdata move <folder> --apply
//	homelab appdata undo --apply         back to the old copy, while it's kept
//	homelab appdata remove-old --apply   delete the copy not in use

import (
	"context"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/appdata"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/diskspace"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/install"
)

func (h *homelab) appdataCmd(ctx context.Context, args []string) error {
	sub := ""
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		sub, args = args[0], args[1:]
	}
	switch sub {
	case "":
		return h.appdataShow()
	case "move":
		return h.appdataMove(ctx, args)
	case "undo":
		return h.appdataUndo(ctx, args)
	case "remove-old":
		return h.appdataRemoveOld(args)
	}
	return fmt.Errorf("homelab appdata: move <folder>, undo or remove-old")
}

func (h *homelab) appdataShow() error {
	u := h.ui
	dir := appdata.Dir(h.root)
	u.Printf("The apps' data: %s\n", dir)
	if m, ok := appdata.LoadMove(h.root); ok {
		u.Printf("Moved %s from %s; that copy is kept until you remove it (homelab appdata remove-old), or go back to it (homelab appdata undo).\n", m.At.Local().Format("Mon Jan 2 3:04 PM"), m.Old)
	}
	if h.ui.JSON {
		m, _ := appdata.LoadMove(h.root)
		emit(h.ui, "appdata", map[string]any{"dir": dir, "default": filepath.Clean(dir) == filepath.Join(h.root, appdata.Default), "old": m.Old, "movedAt": m.At})
	}
	return nil
}

// expandHome reads ~ as the home folder, and a relative folder against the homelab folder, as APPDATA_ROOT is read.
func (h *homelab) appdataTarget(v string) string {
	return appdata.Resolve(h.root, v)
}

// appdataRunning are the homelab's own containers, by Compose project: running, and stopped (an app stopped on
// purpose, or one the move itself stopped).
type projectServices struct {
	file             *compose.File
	running, stopped []string
	profiles         []string
}

func (h *homelab) appdataContainers(ctx context.Context) (*docker.Client, map[string]*projectServices, []string, error) {
	client, err := h.docker(ctx)
	if err != nil {
		return nil, nil, nil, err
	}
	cs, err := client.Containers(ctx)
	if err != nil {
		return nil, nil, nil, err
	}
	files := map[string]*compose.File{}
	for _, f := range h.catalog.Files {
		files[f.Name] = f
	}
	out := map[string]*projectServices{}
	var running []string
	for _, c := range cs {
		f, ok := files[c.Project()]
		if !ok || c.Service() == "" {
			continue
		}
		p := out[f.Name]
		if p == nil {
			p = &projectServices{file: f}
			out[f.Name] = p
		}
		if c.Running {
			p.running = append(p.running, c.Service())
			running = append(running, c.Name)
		} else {
			p.stopped = append(p.stopped, c.Service())
		}
		if a, ok := h.catalog.Get(c.Service()); ok {
			for _, pr := range a.Profiles {
				if !slices.Contains(p.profiles, pr) {
					p.profiles = append(p.profiles, pr)
				}
			}
		}
	}
	return client, out, running, nil
}

// recreateOnAppdata puts every homelab container on the folder APPDATA_ROOT names now: the ones that were running start
// again; one stopped stays stopped, made anew so it reads the new folder when it's started.
func (h *homelab) recreateOnAppdata(ctx context.Context, client *docker.Client, projects map[string]*projectServices) error {
	names := make([]string, 0, len(projects))
	for n := range projects {
		names = append(names, n)
	}
	sort.Strings(names)
	var failed []string
	for _, n := range names {
		p := projects[n]
		proj := install.ProjectFor(p.file, h.envFile)
		if len(p.running) > 0 {
			if err := client.Compose(ctx, proj, p.profiles, append([]string{"up", "--detach", "--force-recreate"}, p.running...)...); err != nil {
				failed = append(failed, fmt.Sprintf("%s (%v)", strings.Join(p.running, ", "), err))
				continue
			}
		}
		if len(p.stopped) > 0 {
			if err := client.Compose(ctx, proj, p.profiles, append([]string{"create", "--force-recreate"}, p.stopped...)...); err != nil {
				failed = append(failed, fmt.Sprintf("%s (%v)", strings.Join(p.stopped, ", "), err))
			}
		}
	}
	if len(failed) > 0 {
		return fmt.Errorf("these didn't start on the new folder: %s", strings.Join(failed, "; "))
	}
	return nil
}

// pauseAgent keeps the background agent from starting apps again mid-move; the returned func resumes it.
func (h *homelab) pauseAgent() func() {
	l, err := h.scheduler()
	if err != nil {
		return func() {}
	}
	var paused []string
	for _, j := range jobs() {
		if l.Pause(j.Label) == nil {
			paused = append(paused, j.Label)
		}
	}
	return func() {
		for _, label := range paused {
			_ = l.Resume(label)
		}
	}
}

// setAppdataRoot writes APPDATA_ROOT, or takes it out for the default folder.
func (h *homelab) setAppdataRoot(v string) error {
	f, err := envfile.Load(h.envFile)
	if err != nil {
		return err
	}
	if !f.Exists() {
		return errors.New(".env does not exist yet: homelab up makes it")
	}
	if v == "" {
		f.Delete(appdata.Key)
	} else {
		f.Set(appdata.Key, v)
	}
	return f.Save()
}

func (h *homelab) appdataMove(ctx context.Context, args []string) error {
	fs := newFlags("appdata move")
	apply := applyFlag(fs)
	rest, err := parseFlags(fs, args)
	if err != nil {
		return err
	}
	if len(rest) != 1 {
		return errors.New("homelab appdata move <folder>: the folder to move the apps' data to")
	}
	u := h.ui
	from := appdata.Dir(h.root)
	to := h.appdataTarget(rest[0])
	if m, ok := appdata.LoadMove(h.root); ok {
		return fmt.Errorf("the last move's other copy is still kept (%s): remove it (homelab appdata remove-old) or go back to it (homelab appdata undo) first", m.Old)
	}
	if filepath.Clean(to) == filepath.Clean(from) {
		return fmt.Errorf("the apps' data is in %s already", from)
	}
	env := h.envMap()
	for _, k := range []string{"BACKUP_DESTINATION", "KOPIA_REPOSITORY"} {
		if v := strings.TrimSpace(env[k]); v != "" {
			b := appdata.Resolve(h.root, v)
			if appdataOverlap(b, to) {
				return fmt.Errorf("%s is where the backups go (%s): the apps' data goes somewhere else", to, k)
			}
		}
	}
	files, total, err := appdata.Size(from)
	if err != nil {
		return err
	}
	// Room for the copy, and the threshold the disk check warns at, on the drive the folder will be on.
	at := to
	for {
		if _, err := os.Stat(at); err == nil {
			break
		}
		up := filepath.Dir(at)
		if up == at {
			break
		}
		at = up
	}
	if vols := diskspace.Check([]diskspace.Location{{Name: "to", Path: at}}); len(vols) > 0 {
		free, spare := vols[0].Free, diskspace.Threshold(vols[0].Total)
		if need := uint64(max(total, 0)) + spare; free < need { // #nosec G115 -- a folder's size in bytes, never negative
			return fmt.Errorf("%s has %s free; the apps' data is %s, and the drive should keep %s to spare", at, size(int64(min(free, math.MaxInt64))), size(total), size(int64(min(spare, math.MaxInt64)))) // #nosec G115 -- capped to int64's range
		}
	}
	u.Title("Move the apps' data")
	u.Info("from %s (%d files, %s)", from, files, size(total))
	u.Info("to %s", to)
	u.Info("the apps stop while it's copied, every file is checked, then they start on the new folder")
	u.Info("the old folder is kept: homelab appdata undo goes back to it, homelab appdata remove-old deletes it")
	if err := h.goAhead(*apply, "\nMove?"); err != nil {
		return err
	}
	resume := h.pauseAgent()
	defer resume()
	client, projects, running, err := h.appdataContainers(ctx)
	if err != nil {
		return fmt.Errorf("the apps can't be stopped for the move (%w), so nothing was moved", err)
	}
	u.Step(1, 4, "Stopping the apps")
	if len(running) > 0 {
		if _, err := client.Runner.Output(ctx, client.Bin, append([]string{"stop"}, running...)...); err != nil {
			return fmt.Errorf("stopping the apps: %w", err)
		}
	}
	startAgain := func() {
		if len(running) > 0 {
			_, _ = client.Runner.Output(context.WithoutCancel(ctx), client.Bin, append([]string{"start"}, running...)...)
		}
	}
	u.Step(2, 4, "Copying the apps' data")
	last := time.Now()
	n, copied, err := appdata.Copy(from, to, func(done int, b int64) {
		if time.Since(last) > 5*time.Second {
			last = time.Now()
			u.Info("%d of %d files, %s of %s", done, files, size(b), size(total))
		}
	})
	if err == nil {
		u.Step(3, 4, "Checking every file")
		_, err = appdata.Check(from, to)
	}
	if err != nil {
		// Nothing points at the copy yet: it goes, and the apps start where they were.
		os.RemoveAll(to)
		startAgain()
		return fmt.Errorf("the move stopped and was undone, the apps are back on %s: %w", from, err)
	}
	was := env[appdata.Key]
	if err := h.setAppdataRoot(to); err != nil {
		os.RemoveAll(to)
		startAgain()
		return fmt.Errorf("writing APPDATA_ROOT, so the move was undone: %w", err)
	}
	if err := appdata.SaveMove(h.root, appdata.Move{Old: from, New: to, Was: was, At: time.Now(), Files: n, Bytes: copied}); err != nil {
		u.Warn("keeping the move's record: %v", err)
	}
	u.OK("copied and checked %d files (%s)", n, size(copied))
	u.Step(4, 4, "Starting the apps on the new folder")
	if err := h.recreateOnAppdata(ctx, client, projects); err != nil {
		u.Warn("%v; homelab appdata undo goes back to %s", err, from)
		return err
	}
	u.OK("the apps run on %s; the old folder is kept at %s", to, from)
	// The restore test, now from the new place (a sample of files against the last backup).
	if err := h.restoreTest(ctx, []string{"--auto"}); err != nil {
		u.Warn("the restore test after the move: %v", err)
	}
	return nil
}

func appdataOverlap(a, b string) bool {
	rel1, err1 := filepath.Rel(a, b)
	rel2, err2 := filepath.Rel(b, a)
	inside := func(rel string, err error) bool {
		return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)) && !filepath.IsAbs(rel)
	}
	return inside(rel1, err1) || inside(rel2, err2)
}

func (h *homelab) appdataUndo(ctx context.Context, args []string) error {
	fs := newFlags("appdata undo")
	apply := applyFlag(fs)
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	m, ok := appdata.LoadMove(h.root)
	if !ok {
		return errors.New("there's no move to undo: no other copy of the apps' data is kept")
	}
	if _, err := os.Stat(m.Old); err != nil {
		return fmt.Errorf("the old copy isn't at %s any more", m.Old)
	}
	u := h.ui
	u.Title("Go back to the old copy of the apps' data")
	u.Info("the apps stop, then start on %s again", m.Old)
	u.Info("what changed since the move stays in %s, kept until homelab appdata remove-old", m.New)
	if err := h.goAhead(*apply, "\nGo back?"); err != nil {
		return err
	}
	resume := h.pauseAgent()
	defer resume()
	client, projects, running, err := h.appdataContainers(ctx)
	if err != nil {
		return err
	}
	if len(running) > 0 {
		if _, err := client.Runner.Output(ctx, client.Bin, append([]string{"stop"}, running...)...); err != nil {
			return fmt.Errorf("stopping the apps: %w", err)
		}
	}
	if err := h.setAppdataRoot(m.Was); err != nil {
		return err
	}
	// The copy not in use now is the moved one.
	if err := appdata.SaveMove(h.root, appdata.Move{Old: m.New, New: m.Old, Was: m.New, At: time.Now(), Files: m.Files, Bytes: m.Bytes}); err != nil {
		u.Warn("keeping the record: %v", err)
	}
	if err := h.recreateOnAppdata(ctx, client, projects); err != nil {
		return err
	}
	u.OK("the apps run on %s again; the other copy is kept at %s", m.Old, m.New)
	return nil
}

func (h *homelab) appdataRemoveOld(args []string) error {
	fs := newFlags("appdata remove-old")
	apply := applyFlag(fs)
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	m, ok := appdata.LoadMove(h.root)
	if !ok {
		return errors.New("no other copy of the apps' data is kept")
	}
	inUse := appdata.Dir(h.root)
	if appdataOverlap(m.Old, inUse) {
		return fmt.Errorf("%s is the folder the apps use (%s), so it wasn't removed", m.Old, inUse)
	}
	if appdataOverlap(m.Old, h.root) && !appdataOverlap(m.Old, filepath.Join(h.root, "data", "appdata")) {
		return fmt.Errorf("%s holds the homelab folder, so it wasn't removed", m.Old)
	}
	u := h.ui
	u.Title("Remove the old copy of the apps' data")
	u.Info("delete %s (the apps use %s)", m.Old, inUse)
	if err := h.goAhead(*apply, "\nRemove it?"); err != nil {
		return err
	}
	if err := os.RemoveAll(m.Old); err != nil {
		return err
	}
	if err := appdata.ForgetMove(h.root); err != nil {
		return err
	}
	u.OK("removed %s", m.Old)
	return nil
}
