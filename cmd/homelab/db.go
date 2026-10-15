package main

import (
	"compress/gzip"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
)

// dbCmd is homelab db upgrade: a PostgreSQL database to a new major
// version, the way the runbook did it by hand (dump, start the new
// version, restore, check), and back again if any step fails.
func (h *homelab) dbCmd(ctx context.Context, args []string) error {
	if len(args) == 0 || args[0] != "upgrade" {
		return fmt.Errorf("usage: homelab db upgrade <database> [--to <major>]")
	}
	fs := newFlags("db upgrade")
	apply := applyFlag(fs)
	to := fs.Int("to", 0, "")
	pos, err := parseFlags(fs, args[1:])
	if err != nil {
		return err
	}
	var can []string
	for _, a := range h.catalog.Apps {
		if a.Meta.Version != "" {
			can = append(can, a.ID)
		}
	}
	if len(pos) != 1 {
		return fmt.Errorf("usage: homelab db upgrade <database> [--to <major>] (one of %s)", strings.Join(can, ", "))
	}
	a, ok := h.catalog.Get(pos[0])
	if !ok || a.Meta.Version == "" {
		return fmt.Errorf("%s is not a database homelab db upgrade knows (%s)", pos[0], strings.Join(can, ", "))
	}
	key := a.Meta.Version
	cur, err := strconv.Atoi(strings.TrimSpace(h.envMap()[key]))
	if err != nil {
		return fmt.Errorf("%s in .env is not a major version number", key)
	}
	if *to == 0 {
		*to = cur + 1
	}
	if *to <= cur {
		return fmt.Errorf("%s runs PostgreSQL %d; --to must be a later major version (going back is a restore: docs/Disaster Recovery.md)", a.ID, cur)
	}
	image := versionRef.ReplaceAllString(a.Image, strconv.Itoa(*to))
	vol, layout := pgVolume(a)
	if vol == "" {
		return fmt.Errorf("%s has no named volume for its data", a.ID)
	}
	volume := a.Project() + "_" + vol

	client, err := h.docker(ctx)
	if err != nil {
		return err
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return err
	}
	report := detect.Analyze(h.catalog, containers)
	ctr, ok := runningContainer(report, a.ID)
	if !ok {
		return fmt.Errorf("%s is not running, so it cannot be dumped first: homelab start %s", a.ID, a.ID)
	}
	// The apps of the same project that run now: stopped while the
	// database moves, started again after.
	var others []*catalog.App
	for _, o := range h.catalog.Apps {
		if st, _ := report.State(o.ID); o.File == a.File && o.ID != a.ID && st == detect.Running {
			others = append(others, o)
		}
	}

	u := h.ui
	u.Title(fmt.Sprintf("%s: PostgreSQL %d → %d", a.Name(), cur, *to))
	u.Info("download %s first", image)
	u.Info("dump every database in %s → %s", a.ID, h.rel(h.stagingDir("databases", a.ID)))
	if layout == pgDataDir {
		u.Info("archive the %s volume → %s (to go back to)", volume, h.rel(h.stagingDir("volumes", a.ID+"-before-pg"+strconv.Itoa(*to))))
	} else {
		u.Info("PostgreSQL %d gets a folder of its own in %s; %d's stays there to go back to", *to, volume, cur)
	}
	u.Info("stop %s", strings.Join(append(ids(others), a.ID), ", "))
	if layout == pgDataDir {
		u.Info("empty the %s volume", volume)
	}
	u.Info("start %s on PostgreSQL %d (%s=%d in .env), load the dump, and check it", a.ID, *to, key, *to)
	if len(others) > 0 {
		u.Info("start %s again", strings.Join(ids(others), ", "))
	}
	u.Info("if a step fails, go back to PostgreSQL %d as it was", cur)
	if err := h.goAhead(*apply, "\nUpgrade the database?"); err != nil {
		return err
	}

	if _, err := client.Runner.Output(ctx, client.Bin, "pull", "--quiet", image); err != nil {
		// Already here (offline, or the registry's rate limit): use it.
		if _, ierr := client.Runner.Output(ctx, client.Bin, "image", "inspect", image); ierr != nil {
			return fmt.Errorf("downloading %s (nothing was changed): %w", image, err)
		}
		u.Warn("could not download %s again, so the copy already here is used: %v", image, err)
	}
	now := time.Now()
	dump, err := backup.PostgresDump(ctx, client, ctr.Name, h.stagingDir("databases", a.ID), a.ID, now)
	if err != nil {
		return fmt.Errorf("%w (nothing was changed)", err)
	}
	u.OK("dumped to %s", h.rel(dump))
	archive := ""
	if layout == pgDataDir {
		dir := h.stagingDir("volumes", a.ID+"-before-pg"+strconv.Itoa(*to))
		if archive, _, err = backup.VolumeArchive(ctx, client, volume, dir, vol, now); err != nil {
			return fmt.Errorf("%w (nothing was changed)", err)
		}
		u.OK("archived %s to %s", volume, h.rel(archive))
	}

	p := h.project(a.File)
	profiles := a.Profiles
	for _, o := range others {
		profiles = append(profiles, o.Profiles...)
	}
	if err := client.Compose(ctx, p, profiles, append([]string{"stop"}, append(ids(others), a.ID)...)...); err != nil {
		return err
	}
	step := func() error {
		if layout == pgDataDir {
			if err := client.RunTo(ctx, io.Discard, "-v", volume+":/v", "alpine:3", "sh", "-c", "rm -rf /v/* /v/.[!.]* /v/..?*"); err != nil {
				return fmt.Errorf("emptying %s: %w", volume, err)
			}
		}
		if err := h.setEnv(key, strconv.Itoa(*to)); err != nil {
			return err
		}
		if err := client.Compose(ctx, p, a.Profiles, "up", "--detach", "--no-deps", a.ID); err != nil {
			return err
		}
		if err := pgReady(ctx, client, ctr.Name, 3*time.Minute); err != nil {
			return err
		}
		if out, err := restoreDump(ctx, client, ctr.Name, dump); err != nil {
			return fmt.Errorf("loading the dump: %w\n%s", err, lastLines(out, 5))
		}
		n, err := client.Exec(ctx, ctr.Name, "sh", "-c", `psql -tA -U "$POSTGRES_USER" -d postgres -c "select count(*) from pg_database where not datistemplate and datname <> 'postgres'"`)
		if err != nil || strings.TrimSpace(string(n)) == "0" {
			return fmt.Errorf("after loading the dump the database is empty (%s)", strings.TrimSpace(string(n)))
		}
		return nil
	}
	if err := step(); err != nil {
		u.Fail("%v", err)
		u.Info("going back to PostgreSQL %d", cur)
		if berr := h.pgBack(ctx, client, a, key, cur, volume, archive); berr != nil {
			return fmt.Errorf("the upgrade failed (%v), and going back failed too: %w; the dump is %s and the archive %s (docs/Disaster Recovery.md)", err, berr, h.rel(dump), h.rel(archive))
		}
		if len(others) > 0 {
			_ = client.Compose(ctx, p, profiles, append([]string{"up", "--detach"}, ids(others)...)...)
		}
		return fmt.Errorf("the upgrade failed and %s is back on PostgreSQL %d: %w", a.ID, cur, err)
	}
	u.OK("%s runs PostgreSQL %d with the data loaded", a.ID, *to)
	if len(others) > 0 {
		if err := client.Compose(ctx, p, profiles, append([]string{"up", "--detach"}, ids(others)...)...); err != nil {
			return err
		}
		u.OK("started %s again", strings.Join(ids(others), ", "))
	}
	u.Info("check the app works; the dump (%s) stays in recovery-staging until the nightly backup rotates it", h.rel(dump))
	return nil
}

// versionRef is the version in a database image, ${KEY:-N}.
var versionRef = regexp.MustCompile(`\$\{[A-Z0-9_]+:-[^}]*\}`)

// The two places a PostgreSQL volume is mounted: the data folder itself
// (PGDATA, images up to 17 and ours with PGDATA set), or its parent, where
// 18 and later keep one folder per major version.
const (
	pgDataDir = "/var/lib/postgresql/data"
	pgParent  = "/var/lib/postgresql"
)

// pgVolume is the database's named data volume and where it is mounted.
func pgVolume(a *catalog.App) (string, string) {
	for _, v := range a.Volumes {
		if v.Source != "" && (v.Target == pgDataDir || v.Target == pgParent) && !strings.ContainsAny(v.Source, "/.~$") {
			return v.Source, v.Target
		}
	}
	return "", ""
}

func ids(apps []*catalog.App) []string {
	var out []string
	for _, a := range apps {
		out = append(out, a.ID)
	}
	return slices.Clip(out)
}

// pgReady waits until PostgreSQL answers on TCP: during first start it
// answers only on its socket, while it initialises the cluster.
func pgReady(ctx context.Context, client *docker.Client, ctr string, limit time.Duration) error {
	deadline := time.Now().Add(limit)
	for {
		if _, err := client.Exec(ctx, ctr, "sh", "-c", `pg_isready -q -h 127.0.0.1 -U "$POSTGRES_USER"`); err == nil {
			return nil
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("PostgreSQL did not start within %s (homelab logs %s)", limit, ctr)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}
}

// restoreDump loads a gzipped pg_dumpall into the database's container.
// The dump drops and recreates what it holds; the errors about the role
// psql connects as (it cannot drop itself) are expected.
func restoreDump(ctx context.Context, client *docker.Client, ctr, dump string) ([]byte, error) {
	f, err := os.Open(dump)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	zr, err := gzip.NewReader(f)
	if err != nil {
		return nil, err
	}
	return client.ExecStdin(ctx, zr, ctr, "sh", "-c", `psql -q -U "$POSTGRES_USER" -d postgres`)
}

// pgBack returns a database to the major version it had: the setting,
// and, when its volume was emptied, the archive made before.
func (h *homelab) pgBack(ctx context.Context, client *docker.Client, a *catalog.App, key string, version int, volume, archive string) error {
	p := h.project(a.File)
	_ = client.Compose(ctx, p, a.Profiles, "stop", a.ID)
	if archive != "" {
		f, err := os.Open(archive)
		if err != nil {
			return err
		}
		defer f.Close()
		cmd := procattr.Hide(exec.CommandContext(ctx, client.Bin, "run", "--rm", "-i", "-v", volume+":/v", "alpine:3", "sh", "-c", "rm -rf /v/* /v/.[!.]* /v/..?*; tar xzf - -C /v"))
		cmd.Stdin = f
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("restoring %s: %w\n%s", volume, err, lastLines(out, 3))
		}
	}
	if err := h.setEnv(key, strconv.Itoa(version)); err != nil {
		return err
	}
	return client.Compose(ctx, p, a.Profiles, "up", "--detach", "--no-deps", a.ID)
}

// setEnv writes one setting to .env.
func (h *homelab) setEnv(key, value string) error {
	f, err := envfile.Load(h.envFile)
	if err != nil {
		return err
	}
	if !f.Exists() {
		return errors.New(".env does not exist yet: homelab up makes it")
	}
	f.Set(key, value)
	return f.Save()
}

func lastLines(out []byte, n int) string {
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	if len(lines) > n {
		lines = lines[len(lines)-n:]
	}
	return strings.Join(lines, "\n")
}
