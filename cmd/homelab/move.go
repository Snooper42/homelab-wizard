package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/domain"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	moving "github.com/Snooper42/homelab-wizard/internal/move"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
)

// machinePaths are settings that name folders on this machine, which a
// move to another machine may need changed.
var machinePaths = []struct{ key, what string }{
	{"MEDIA_ROOT", "the media drive"},
	{"DOWNLOADS_ROOT", "downloads"},
	{"IMMICH_UPLOAD_LOCATION", "the photos"},
	{"SYNC_ROOT", "the synced folders"},
	{"JELLYFIN_DATA_DIR", "Jellyfin's data"},
}

// moveCmd moves the homelab to another machine: move out packs it on the
// old one (a fresh backup first, then the apps stopped), move in unpacks it
// on the new one, loads the databases, and starts what ran before.
func (h *homelab) moveCmd(ctx context.Context, args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: homelab move out [--to <file>] | homelab move in [<file>]")
	}
	switch args[0] {
	case "out":
		return h.moveOut(ctx, args[1:])
	case "in":
		return h.moveIn(ctx, args[1:])
	}
	return fmt.Errorf("unknown move command %q (out, in)", args[0])
}

func (h *homelab) moveOut(ctx context.Context, args []string) error {
	fs := newFlags("move out")
	apply := applyFlag(fs)
	to := fs.String("to", "", "")
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	u := h.ui
	out := *to
	if out == "" {
		home, _ := os.UserHomeDir()
		out = filepath.Join(home, "homelab-move-"+time.Now().Format("2006-01-02")+".tar")
	}
	out, _ = filepath.Abs(out)
	if rel, err := filepath.Rel(h.root, out); err == nil && filepath.IsLocal(rel) {
		return fmt.Errorf("put the move file outside the homelab folder (--to), or it would pack itself")
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
	var running []string
	for _, a := range h.catalog.Apps {
		if st, _ := report.State(a.ID); st == detect.Running && !a.Internal() && a.Native() == nil {
			running = append(running, a.ID)
		}
	}
	u.Title("Move out")
	u.Info("back up now (fresh database dumps, as the nightly job)")
	u.Info("stop every app, so nothing changes while it is packed")
	u.Info("pack .env, the apps' data, and the newest dumps into %s", out)
	u.Info("remove the scheduled jobs, so this machine stays stopped")
	u.Info("%s", u.Dim(fmt.Sprintf("the photos and media stay on their drive (%s); %d apps start again on the new machine", h.envMap()["MEDIA_ROOT"], len(running))))
	if err := h.goAhead(*apply, "\nMove out?"); err != nil {
		return err
	}
	if err := h.backup(ctx, []string{"--apply"}); err != nil {
		return fmt.Errorf("the backup before moving failed, so nothing was stopped: %w", err)
	}
	stop := func(verb string) {
		for _, f := range h.catalog.Files {
			_ = client.Compose(ctx, h.project(f), []string{"optional"}, verb)
		}
	}
	stop("stop")
	u.OK("stopped the apps")
	m := moving.Manifest{Made: time.Now(), From: h.host.Name, Version: h.repoVersion(), Apps: running}
	tmp := out + ".partial"
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		stop("start")
		return err
	}
	r, err := moving.Pack(h.root, m, f)
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err == nil {
		err = os.Rename(tmp, out)
	}
	if err != nil {
		os.Remove(tmp)
		stop("start")
		return fmt.Errorf("packing (the apps are started again): %w", err)
	}
	u.OK("packed %d files (%s) into %s", r.Files, size(r.Size), out)
	if len(r.Skipped) > 0 {
		u.Warn("%d file(s) could not be read and were left out: %s", len(r.Skipped), strings.Join(first(r.Skipped, 5), ", "))
	}
	if err := h.schedule(ctx, []string{"remove", "--apply"}); err != nil {
		u.Warn("removing the scheduled jobs: %v", err)
	}
	u.Printf("\n  %s\n", u.Bold("On the new machine"))
	for i, step := range []string{
		"Install the container runtime (OrbStack on a Mac) and Homelab Wizard; on Setup choose Set it up for me (or git clone the homelab).",
		"Move the drive with the photos and media over, and copy " + filepath.Base(out) + " there (a drive, AirDrop, or the cloud).",
		"./homelab move in " + filepath.Base(out) + "   (from the new homelab folder, with the file's path)",
	} {
		u.Printf("  %d. %s\n", i+1, step)
	}
	u.Printf("  %s\n", u.Dim("Until then this machine stays stopped. To go back instead: ./homelab up, then ./homelab schedule install."))
	return nil
}

func (h *homelab) moveIn(ctx context.Context, args []string) error {
	fs := newFlags("move in")
	apply := applyFlag(fs)
	force := fs.Bool("force", false, "")
	pos, err := parseFlags(fs, args)
	if err != nil {
		return err
	}
	u := h.ui
	kept := filepath.Join(h.root, "data", moving.ManifestName)
	var m moving.Manifest
	bundle := ""
	if len(pos) > 0 {
		bundle, _ = filepath.Abs(pos[0])
		if m, err = moving.ReadManifest(bundle); err != nil {
			return err
		}
		if !*force && hasFiles(filepath.Join(h.root, "data", "appdata")) {
			return fmt.Errorf("this homelab folder already has apps' data (data/appdata); move into a new one, or add --force to replace it")
		}
	} else if m, err = moving.LoadKept(kept); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("usage: homelab move in <file from homelab move out>")
		}
		return err
	}
	u.Title("Move in")
	u.Info("from %s, packed %s", m.From, m.Made.Local().Format("2 January 15:04"))
	if bundle != "" {
		u.Info("unpack .env and the apps' data into %s", h.root)
	}
	u.Info("check this machine's folders: the media drive, the photos, downloads")
	u.Info("load each database from its dump")
	u.Info("start the homelab and the %d apps that ran there, and install the scheduled jobs", len(m.Apps))
	if err := h.goAhead(*apply, "\nMove in?"); err != nil {
		return err
	}
	if bundle != "" {
		_, n, err := moving.Unpack(bundle, h.root)
		if err != nil {
			return fmt.Errorf("unpacking: %w", err)
		}
		u.OK("unpacked %d files", n)
		changes, err := envfile.Rehome(h.envFile, domain.HostIdentity())
		if err != nil {
			return fmt.Errorf("the settings for this machine: %w", err)
		}
		for _, c := range changes {
			u.OK("%s %s %s", c.Key, c.Reason, c.Value)
		}
		// Your own apps came in with stacks/custom.
		if cat, err := catalog.Load(h.root); err == nil {
			h.catalog = cat
		}
	}

	env := h.envMap()
	var missing []string
	for _, p := range machinePaths {
		v := env[p.key]
		if v == "" || !filepath.IsAbs(v) && !absElsewhere(v) {
			continue
		}
		if _, err := os.Stat(v); err != nil {
			missing = append(missing, fmt.Sprintf("%s (%s) is %s, which is not on this machine", p.key, p.what, v))
		}
	}
	if len(missing) > 0 {
		for _, m := range missing {
			u.Fail("%s", m)
		}
		return fmt.Errorf("plug in the drive, or set these in Settings (or .env) to this machine's folders, then run homelab move in again to carry on")
	}
	u.OK("this machine's folders are there")

	client, err := h.docker(ctx)
	if err != nil {
		return err
	}
	if err := h.restoreVolumes(ctx, client); err != nil {
		return err
	}
	if err := h.restoreDatabases(ctx, client); err != nil {
		return err
	}
	ids := h.baselineIDs()
	for _, id := range m.Apps {
		if _, ok := h.catalog.Get(id); ok {
			ids = append(ids, id)
		}
	}
	if err := h.runInstall(ctx, ids, installOptions{apply: true}, "Start the homelab"); err != nil {
		return fmt.Errorf("starting the apps: %w (homelab move in again carries on)", err)
	}
	if err := h.schedule(ctx, []string{"install", "--apply"}); err != nil {
		u.Warn("the scheduled jobs: %v", err)
	}
	if err := os.Rename(kept, filepath.Join(h.root, "data", "homelab-move-done.json")); err != nil {
		u.Warn("%v", err)
	}
	u.OK("moved in from %s", m.From)
	u.Printf("\n  %s\n", u.Bold("Left to do"))
	steps := []string{"Check Status: every app green, and a photo, a password, and a document open."}
	if env["HOMELAB_DOMAIN"] != "" {
		steps = append(steps, "Move the router's address reservation to this machine, then ./homelab domain setup (Setup › Set up the domain).")
	}
	if env["TAILSCALE_HOST"] != "" || env["TS_AUTHKEY"] != "" {
		steps = append(steps, "Tailscale: remove the old machine in the admin console if this one shows up as a new device.")
	}
	steps = append(steps, "Setup › Create the backup jobs, to check Duplicati sees the backup folder here.",
		"On the old machine, once all is well here: ./homelab uninstall.")
	for i, s := range steps {
		u.Printf("  %d. %s\n", i+1, s)
	}
	return nil
}

// restoreVolumes loads the named volumes the backup archives (each app's
// `archive` list) from their newest archive, before the apps first start.
func (h *homelab) restoreVolumes(ctx context.Context, client *docker.Client) error {
	for _, a := range h.catalog.Apps {
		for _, v := range a.Meta.Archive {
			archive := newestIn(h.stagingDir("volumes", v))
			if archive == "" {
				continue
			}
			full := a.Project() + "_" + v
			if _, err := client.Runner.Output(ctx, client.Bin, "volume", "create", "--label", "com.docker.compose.project="+a.Project(), "--label", "com.docker.compose.volume="+v, full); err != nil {
				return fmt.Errorf("making the volume %s: %w", full, err)
			}
			if err := loadVolume(ctx, client, full, archive); err != nil {
				return err
			}
			h.ui.OK("%s loaded from %s", v, filepath.Base(archive))
		}
	}
	return nil
}

// loadVolume replaces a volume's contents with a gzipped tar.
func loadVolume(ctx context.Context, client *docker.Client, volume, archive string) error {
	f, err := os.Open(archive)
	if err != nil {
		return err
	}
	defer f.Close()
	cmd := procattr.Hide(exec.CommandContext(ctx, client.Bin, "run", "--rm", "-i", "-v", volume+":/v", "alpine:3", "sh", "-c", "rm -rf /v/* /v/.[!.]* /v/..?*; tar xzf - -C /v"))
	cmd.Stdin = f
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("loading %s: %w\n%s", volume, err, lastLines(out, 3))
	}
	return nil
}

// restoreDatabases starts each PostgreSQL database that has a dump on its
// own, before its app, and loads the dump.
func (h *homelab) restoreDatabases(ctx context.Context, client *docker.Client) error {
	for _, a := range h.catalog.Apps {
		if a.Meta.Dump != "postgres" {
			continue
		}
		dump := newestIn(h.stagingDir("databases", a.ID))
		if dump == "" {
			continue
		}
		if err := client.Compose(ctx, h.project(a.File), a.Profiles, "up", "--detach", "--no-deps", a.ID); err != nil {
			return err
		}
		ctr, err := h.containerOf(ctx, client, a)
		if err != nil {
			return err
		}
		if err := pgReady(ctx, client, ctr, 3*time.Minute); err != nil {
			return err
		}
		if out, err := restoreDump(ctx, client, ctr, dump); err != nil {
			return fmt.Errorf("%s: loading %s: %w\n%s", a.ID, filepath.Base(dump), err, lastLines(out, 5))
		}
		h.ui.OK("%s loaded from %s", a.ID, filepath.Base(dump))
	}
	return nil
}

// containerOf is the running container of an app just started.
func (h *homelab) containerOf(ctx context.Context, client *docker.Client, a *catalog.App) (string, error) {
	containers, err := client.Containers(ctx)
	if err != nil {
		return "", err
	}
	if ctr, ok := runningContainer(detect.Analyze(h.catalog, containers), a.ID); ok {
		return ctr.Name, nil
	}
	return "", fmt.Errorf("%s did not start (homelab logs %s)", a.ID, a.ID)
}

// newestIn is the newest file in dir, as the backup names them.
func newestIn(dir string) string {
	entries, _ := os.ReadDir(dir)
	newest, when := "", time.Time{}
	for _, e := range entries {
		info, err := e.Info()
		if err != nil || !info.Mode().IsRegular() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		if info.ModTime().After(when) {
			newest, when = filepath.Join(dir, e.Name()), info.ModTime()
		}
	}
	return newest
}

func hasFiles(dir string) bool {
	entries, err := os.ReadDir(dir)
	return err == nil && len(entries) > 0
}

func first(list []string, n int) []string {
	if len(list) > n {
		return append(list[:n:n], "…")
	}
	return list
}

// absElsewhere reports whether a folder is absolute on another system: a
// Mac or Linux path on Windows, or a Windows drive path elsewhere. Moved
// from there, it is not a folder on this machine.
func absElsewhere(v string) bool {
	if strings.HasPrefix(v, "/") {
		return true
	}
	return len(v) >= 3 && v[1] == ':' && (v[2] == '\\' || v[2] == '/') && ('A' <= v[0] && v[0] <= 'Z' || 'a' <= v[0] && v[0] <= 'z')
}
