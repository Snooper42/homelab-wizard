package main

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"net"
	"net/http"
	"os"
	"os/user"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/diskhealth"
	"github.com/Snooper42/homelab-wizard/internal/diskspace"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/duplicati"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/notify"
	"github.com/Snooper42/homelab-wizard/internal/savings"
	"github.com/Snooper42/homelab-wizard/internal/schedule"
	"github.com/Snooper42/homelab-wizard/internal/storage"
	"github.com/Snooper42/homelab-wizard/internal/tailnet"
	"github.com/Snooper42/homelab-wizard/internal/updates"
	"github.com/Snooper42/homelab-wizard/internal/upgrade"
)

func (h *homelab) stagingDir(parts ...string) string {
	return filepath.Join(append([]string{h.root, "recovery-staging"}, parts...)...)
}

func (h *homelab) logsDir() string { return filepath.Join(h.root, "scripts", "logs") }

func (h *homelab) ntfy() *notify.Client {
	port := h.envMap()["NTFY_PORT"]
	if port == "" {
		port = "9293"
	}
	c := notify.New("http://127.0.0.1:" + port)
	c.Token = h.envMap()["NTFY_PUBLISH_TOKEN"]
	return c
}

// desktopNotify shows an alert on this machine's screen; tests replace it.
var desktopNotify = notify.Desktop

// alert publishes best-effort; failures are reported but never fatal. It
// also shows on this machine's screen (DESKTOP_ALERTS, on by default), so
// alerts reach someone before the phone is set up, or when ntfy is down.
func (h *homelab) alert(ctx context.Context, topic string, m notify.Message) {
	env := h.envMap()
	if !strings.EqualFold(env["DESKTOP_ALERTS"], "false") {
		_ = desktopNotify(ctx, m.Title, m.Body)
	}
	if env["NTFY_PUBLISH_TOKEN"] == "" {
		return // phone alerts are not set up yet (Set up the alert token)
	}
	if err := h.ntfy().Publish(ctx, topic, m); err != nil {
		h.ui.Warn("could not send the alert: %v", err)
	}
}

// backup dumps every running database marked `dump: postgres`, archives the
// named volumes listed under `archive`, and copies .env into
// recovery-staging, where Duplicati picks them up.
func (h *homelab) backup(ctx context.Context, args []string) error {
	fs := newFlags("backup")
	apply := applyFlag(fs)
	keep := fs.Int("keep", 7, "")
	// --apps: only these apps' dumps and archives (before an update).
	only := fs.String("apps", "", "")
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	selected := map[string]bool{}
	for _, id := range splitList(*only) {
		selected[id] = true
	}
	client, err := h.docker(ctx)
	if err != nil {
		return err
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return err
	}
	if *keep < 1 {
		return fmt.Errorf("--keep must be at least 1")
	}
	report := detect.Analyze(h.catalog, containers)
	u := h.ui
	u.Title("Backup")
	type job struct {
		app       *catalog.App
		container string
	}
	var jobs []job
	type volume struct{ name, full string } // compose name, Docker name (<project>_<name>)
	var volumes []volume
	var failures []string
	for _, a := range h.catalog.Apps {
		if a.Meta.Dump == "" && len(a.Meta.Archive) == 0 || len(selected) > 0 && !selected[a.ID] {
			continue
		}
		ctr, ok := runningContainer(report, a.ID)
		if !ok {
			// Not installed is a choice; installed but not running means
			// last night's dump silently stays the newest.
			switch st, _ := report.State(a.ID); st {
			case detect.NotInstalled:
				u.Info("%s %s", a.ID, u.Dim("(not installed, skipped)"))
			case detect.External:
				failures = append(failures, a.ID+" runs outside the homelab, so it was not backed up (homelab adopt "+a.ID+")")
				u.Warn("%s runs outside the homelab: not backed up (homelab adopt %s)", a.ID, a.ID)
			default:
				failures = append(failures, a.ID+" is not running, so it was not backed up")
				u.Warn("%s is not running: not backed up", a.ID)
			}
			continue
		}
		if a.Meta.Dump != "" {
			jobs = append(jobs, job{a, ctr.Name})
			u.Info("dump %s → %s", a.ID, h.rel(h.stagingDir("databases", a.ID)))
		}
		for _, v := range a.Meta.Archive {
			volumes = append(volumes, volume{v, a.Project() + "_" + v})
			u.Info("archive volume %s → %s", v, h.rel(h.stagingDir("volumes", v)))
		}
	}
	u.Info("copy .env → %s", h.rel(h.stagingDir("secrets", "homelab.env")))
	u.Info("keep the newest %d dumps of each database", *keep)
	if err := h.goAhead(*apply, "\nBack up now?"); err != nil {
		return err
	}
	now := time.Now()
	// The steps of a whole backup; the dump before an update (--apps)
	// is a part of that update's step, so it reports none.
	steps, n := len(jobs)+len(volumes)+1, 0
	step := func(format string, args ...any) {
		if n++; len(selected) == 0 {
			u.Step(n, steps, format, args...)
		}
	}
	for i, j := range jobs {
		step("Copying %s's database", j.app.Name())
		if strings.HasPrefix(j.app.Meta.Dump, "sqlite:") && !slices.ContainsFunc(jobs[:i], func(p job) bool { return strings.HasPrefix(p.app.Meta.Dump, "sqlite:") }) {
			if err := h.ensureSQLiteImage(ctx, client); err != nil {
				failures = append(failures, err.Error())
				u.Fail("%v", err)
			}
		}
		dir := h.stagingDir("databases", j.app.ID)
		// A dump that hangs (a lock it waits on forever) must not hold up
		// every later night.
		dctx, cancel := context.WithTimeout(ctx, 2*time.Hour)
		var path string
		var err error
		if db, ok := strings.CutPrefix(j.app.Meta.Dump, "sqlite:"); ok {
			path, err = backup.SQLiteDump(dctx, client, j.container, db, dir, j.app.ID, now)
		} else {
			path, err = backup.PostgresDump(dctx, client, j.container, dir, j.app.ID, now)
		}
		cancel()
		if errors.Is(err, backup.ErrNoDatabase) {
			u.Info("%s %s", j.app.ID, u.Dim("(no SQLite database yet, skipped)"))
			continue
		}
		if err != nil {
			failures = append(failures, err.Error())
			u.Fail("%v", err)
			continue
		}
		info, _ := os.Stat(path)
		removed, _ := backup.Rotate(dir, j.app.ID, *keep)
		u.OK("%s: %s (%s)%s", j.app.ID, filepath.Base(path), size(info.Size()), map[bool]string{true: fmt.Sprintf(", removed %d old", len(removed)), false: ""}[len(removed) > 0])
	}
	for _, vol := range volumes {
		name := vol.name
		step("Copying the %s volume", name)
		dir := h.stagingDir("volumes", name)
		vctx, cancel := context.WithTimeout(ctx, 2*time.Hour)
		path, entries, err := backup.VolumeArchive(vctx, client, vol.full, dir, name, now)
		cancel()
		if err != nil {
			failures = append(failures, err.Error())
			u.Fail("%v", err)
			continue
		}
		info, _ := os.Stat(path)
		_, _ = backup.Rotate(dir, name, *keep)
		u.OK("%s: %s (%d files, %s)", name, filepath.Base(path), entries, size(info.Size()))
	}
	step("Copying the settings (.env)")
	if _, err := os.Stat(h.envFile); err == nil {
		if _, err := backup.CopyVerified(h.envFile, h.stagingDir("secrets", "homelab.env")); err != nil {
			failures = append(failures, err.Error())
			u.Fail("%v", err)
		} else {
			u.OK(".env copied and verified")
		}
	}
	if len(selected) == 0 {
		// The copies made before updates, once their rollback window closed.
		if gone := backup.ExpireCopies(h.stagingDir(), now, updates.Keep); len(gone) > 0 {
			u.Info("removed %d copies made before updates, past the week a rollback can use them", len(gone))
		}
	}
	if len(selected) > 0 {
		if len(failures) > 0 {
			return fmt.Errorf("%s", strings.Join(failures, "; "))
		}
		return nil // the nightly extras below are for the nightly run
	}
	// The day's yearly saving, as Status shows it, for the app's trend.
	if err := savings.Record(savings.HistoryPath(h.root), time.Now(), api.StatusOf(ctx, h.catalog, containers, h.envMap(), false).Savings); err != nil {
		u.Warn("recording the savings: %v", err)
	}
	// What each person's photos and each app's folder take, for Status.
	rec := storage.Record{When: time.Now(), Photos: []storage.Person{}, Apps: storage.AppFolders(filepath.Join(h.root, "data", "appdata"), filepath.Join(h.root, "appdata"))}
	if ctr, ok := runningContainer(report, "immich-database"); ok {
		if photos, err := storage.ImmichPhotos(ctx, client, ctr.Name); err != nil {
			u.Warn("%v", err)
		} else {
			rec.Photos = photos
		}
	}
	if err := rec.Save(storage.Path(h.root)); err != nil {
		u.Warn("recording the storage: %v", err)
	}
	// Ask GitHub once a day, so the app and the menu bar know of updates.
	if c, err := upgrade.Inspect(ctx, h.root, true); err == nil && c.Behind > 0 {
		u.Info("%d change(s) waiting on GitHub: homelab upgrade (or Setup › Update) gets them", c.Behind)
	}
	if len(failures) > 0 {
		h.alert(ctx, "duplicati-alerts", notify.Message{Title: "Homelab backup failed", Body: strings.Join(failures, "\n"), Priority: 4, Tags: []string{"warning"}})
		return fmt.Errorf("%d backup step(s) failed", len(failures))
	}
	h.remindRestoreTest(ctx)
	h.remindVaultExport(ctx)
	h.sendWeekly(ctx)
	return nil
}

// ensureSQLiteImage builds the helper image for SQLite dumps once.
func (h *homelab) ensureSQLiteImage(ctx context.Context, client *docker.Client) error {
	if _, err := client.Runner.Output(ctx, client.Bin, "image", "inspect", backup.SQLiteImage); err == nil {
		return nil
	}
	h.ui.Info("building %s for SQLite dumps (once)", backup.SQLiteImage)
	if _, err := client.Runner.Output(ctx, client.Bin, "build", "-t", backup.SQLiteImage, filepath.Join(h.root, "dockerfiles", "sqlite")); err != nil {
		return fmt.Errorf("building the SQLite helper image: %w", err)
	}
	return nil
}

func size(n int64) string {
	switch {
	case n >= 1<<30:
		return fmt.Sprintf("%.1f GB", float64(n)/(1<<30))
	case n >= 1<<20:
		return fmt.Sprintf("%.1f MB", float64(n)/(1<<20))
	}
	return fmt.Sprintf("%d KB", n/1024)
}

// rel names a path for people: inside the homelab, as a repository path
// (forward slashes on every system); outside it, as the system writes it.
func (h *homelab) rel(p string) string {
	if r, err := filepath.Rel(h.root, p); err == nil && r != ".." && !strings.HasPrefix(r, ".."+string(filepath.Separator)) {
		return filepath.ToSlash(r)
	}
	return p
}

// restoreTest checks a Duplicati restore against the live files. With
// --auto it first asks Duplicati to restore a sample of settled files from
// the newest version of a job (Homelab AppData by default).
func (h *homelab) restoreTest(ctx context.Context, args []string) error {
	fs := newFlags("restore-test")
	sample := fs.Int("sample", 25, "")
	auto := fs.Bool("auto", false, "")
	job := fs.String("job", "Homelab AppData", "")
	pos, err := parseFlags(fs, args)
	if err != nil {
		return err
	}
	if *auto && len(pos) == 0 {
		return h.autoRestoreTest(ctx, *job)
	}
	if len(pos) != 2 {
		return fmt.Errorf("usage: homelab restore-test <restored-folder> <original-folder> [--sample 25]\n  e.g. homelab restore-test recovery-staging/restore-test data/appdata\n  or:  homelab restore-test --auto   (Duplicati restores a sample itself)")
	}
	for i, p := range pos {
		if !filepath.IsAbs(p) {
			pos[i] = filepath.Join(h.root, p)
		}
	}
	return h.checkRestore(pos[0], pos[1], *sample, time.Time{}, "")
}

// autoRestoreTest has Duplicati restore a dozen settled files from data/appdata
// (spread across apps) into recovery-staging/restore-test, checks them
// against the live files, and removes the restore when it passes.
func (h *homelab) autoRestoreTest(ctx context.Context, job string) error {
	env := h.envMap()
	port := env["DUPLICATI_PORT"]
	if port == "" {
		port = "8200"
	}
	c, err := duplicati.Login(ctx, "http://127.0.0.1:"+port, env["DUPLICATI_PASSWORD"])
	if err != nil {
		return err
	}
	started := time.Now()
	h.ui.Step(1, 3, "Picking files to test")
	original := filepath.Join(h.root, "data", "appdata")
	files, err := backup.SampleFiles(original, 12, time.Now(), rand.New(rand.NewSource(time.Now().UnixNano())), "duplicati") // #nosec G404 -- picks which backed-up files to test, nothing secret
	if err != nil {
		return err
	}
	if len(files) < 2 {
		return fmt.Errorf("data/appdata has too few settled files to test a restore with yet")
	}
	paths := make([]string, len(files))
	for i, f := range files {
		paths[i] = "/source/appdata/" + f // data/appdata as Duplicati sees it
	}
	staging := h.stagingDir("restore-test")
	if err := os.RemoveAll(staging); err != nil {
		return err
	}
	if err := os.MkdirAll(staging, 0o755); err != nil {
		return err
	}
	h.ui.Step(2, 3, "Duplicati restores %d files", len(files))
	h.ui.Info("asking Duplicati to restore %d file(s) from %q into %s", len(files), job, h.rel(staging))
	if err := c.Restore(ctx, job, paths, "/staging/restore-test", 15*time.Minute); err != nil {
		h.recordRestore(backup.RestoreRun{When: started, Seconds: secondsSince(started), Summary: "Duplicati's restore failed: " + err.Error(), Job: job})
		return err
	}
	h.ui.Step(3, 3, "Comparing them with the originals")
	if err := h.checkRestore(staging, original, 0, started, job); err != nil {
		h.ui.Info("the restored files stay in %s for a look", h.rel(staging))
		return err
	}
	return os.RemoveAll(staging)
}

// checkRestore compares a restored folder with the original, reports, and
// records the test, timed from started when Duplicati's restore was part of
// it (zero for a restore made by hand).
func (h *homelab) checkRestore(restored, original string, sample int, started time.Time, job string) error {
	run := backup.RestoreRun{When: started, Job: job}
	if started.IsZero() {
		run.When = time.Now()
	}
	r, err := backup.VerifyRestore(restored, original, sample)
	if err != nil {
		run.Summary = err.Error()
		h.recordRestore(run)
		return err
	}
	u := h.ui
	u.Title("Restore test")
	u.Info("%d file(s) restored; checked %d", r.Restored, r.Checked)
	for _, f := range r.Different {
		u.Fail("different: %s", f)
	}
	if r.Prefix != "" {
		u.Info("the restore lines up with %s", filepath.Join(original, r.Prefix))
	}
	for _, f := range r.Changed {
		u.Info("changed since the backup (expected for live files): %s", f)
	}
	for _, f := range r.Missing {
		u.Warn("not at the original path: %s", f)
	}
	run.Summary = r.Summary()
	if !started.IsZero() {
		run.Seconds = secondsSince(started)
	}
	if len(r.Different) > 0 || r.Matched == 0 {
		h.recordRestore(run)
		return fmt.Errorf("%s", r.Summary())
	}
	run.Passed = true
	if run.Seconds > 0 {
		u.OK("%s, in %s", r.Summary(), took(time.Duration(run.Seconds)*time.Second))
	} else {
		u.OK("%s", r.Summary())
	}
	h.recordRestore(run)
	return nil
}

// checkDisks reads the disks; tests replace it.
var checkDisks = diskspace.Check

// checkDrives reads each drive's health report through smartctl (nil when
// it is not installed); tests replace it.
var checkDrives = func(ctx context.Context) ([]diskhealth.Disk, error) {
	run, err := diskhealth.Exec()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	return diskhealth.Check(ctx, run)
}

// driveChecks is one watchdog check per drive that reports its health,
// failing while the drive says it is failing.
func driveChecks(disks []diskhealth.Disk) []health.Result {
	var results []health.Result
	for _, d := range disks {
		if !d.Readable {
			continue
		}
		r := health.Result{Name: "drive health (" + d.Label() + ")", Status: 200}
		if d.Failing() {
			r.Err = fmt.Errorf("%s (%s) %s", d.Label(), d.Device, d.Describe())
		}
		results = append(results, r)
	}
	return results
}

// diskChecks is one watchdog check per disk the homelab writes to, failing
// while its free space is under the threshold.
func diskChecks(vols []diskspace.Volume, advice string) []health.Result {
	var results []health.Result
	for _, v := range vols {
		r := health.Result{Name: "disk space (" + v.Names[0] + ")", Status: 200}
		if v.Low() {
			r.Err = fmt.Errorf("%s holds %s, %s: %s", v.Path, v.Label(), v.Describe(), advice)
		}
		results = append(results, r)
	}
	return results
}

func anyLow(vols []diskspace.Volume) bool {
	for _, v := range vols {
		if v.Low() {
			return true
		}
	}
	return false
}

// unusedImages is how much the engine's unused images hold ("12.3GB"), or
// "" when nothing is to be gained.
func unusedImages(us []docker.Usage) string {
	for _, u := range us {
		if u.Type == "Images" && u.Unused() != "" && !strings.HasPrefix(u.Unused(), "0B") {
			return u.Unused()
		}
	}
	return ""
}

// dockerUsage is what the engine keeps on disk, for people: "images 24.1GB
// (12.3GB unused), build cache 1.1GB (1.1GB unused)".
func dockerUsage(us []docker.Usage) string {
	var parts []string
	for _, u := range us {
		if u.Size == "" || u.Size == "0B" {
			continue
		}
		part := strings.ToLower(u.Type) + " " + u.Size
		if unused := u.Unused(); unused != "" && unused != "0B" {
			part += " (" + unused + " unused)"
		}
		parts = append(parts, part)
	}
	if len(parts) == 0 {
		return "nothing yet"
	}
	return strings.Join(parts, ", ")
}

// recordRestore adds a restore test to the log the Backups screen, the
// reminder, and the weekly summary read.
func (h *homelab) recordRestore(run backup.RestoreRun) {
	l := backup.LoadRestoreLog(h.restoreLogPath())
	l.Record(run)
	if err := l.Save(h.restoreLogPath()); err != nil {
		h.ui.Warn("could not record the test: %v", err)
	}
}

func secondsSince(t time.Time) int { return max(1, int(time.Since(t).Seconds())) }

// took is a duration for people: "45 seconds", "3 minutes".
func took(d time.Duration) string {
	if d < 2*time.Minute {
		return fmt.Sprintf("%d seconds", int(d.Seconds()))
	}
	return fmt.Sprintf("%d minutes", int(d.Round(time.Minute).Minutes()))
}

func (h *homelab) restoreLogPath() string { return filepath.Join(h.logsDir(), "restore-test.json") }

// remindRestoreTest sends the monthly restore-test reminder when one is due.
func (h *homelab) remindRestoreTest(ctx context.Context) {
	l := backup.LoadRestoreLog(h.restoreLogPath())
	if !l.ReminderDue(time.Now()) {
		return
	}
	last := "never"
	if !l.LastTest.IsZero() {
		last = l.LastTest.Format("2 January")
	}
	h.ui.Info("the monthly restore test is due (last: %s); sending a reminder", last)
	h.alert(ctx, "duplicati-alerts", notify.Message{
		Title: "Homelab: time for the monthly restore test",
		Body:  "Last test: " + last + ". In the app: Backups › Test a restore. Or run: homelab restore-test --auto",
		Tags:  []string{"floppy_disk"},
	})
	l.LastReminder = time.Now()
	_ = l.Save(h.restoreLogPath())
}

// remindVaultExport keeps an encrypted Bitwarden export next to the other
// secrets: a monthly reminder to make one, and an alert every night while a
// plain (readable) export sits in the backup. Only when Vaultwarden is set up.
func (h *homelab) remindVaultExport(ctx context.Context) {
	if _, err := os.Stat(filepath.Join(h.root, "data", "appdata", "vaultwarden")); err != nil {
		return
	}
	newest, plain := backup.VaultExports(h.stagingDir("secrets"))
	if len(plain) > 0 {
		h.ui.Warn("a plain vault export is in recovery-staging/secrets: %s", strings.Join(plain, ", "))
		h.alert(ctx, "duplicati-alerts", notify.Message{
			Title:    "Homelab: delete the plain vault export",
			Body:     strings.Join(plain, ", ") + " in recovery-staging/secrets holds every password readable. Delete it and export again as an encrypted .json.",
			Priority: 4,
			Tags:     []string{"warning"},
		})
	}
	l := backup.LoadRestoreLog(h.restoreLogPath())
	if !l.VaultReminderDue(newest, time.Now()) {
		return
	}
	last := "never"
	if !newest.IsZero() {
		last = newest.Format("2 January")
	}
	h.ui.Info("the monthly vault export is due (last: %s); sending a reminder", last)
	h.alert(ctx, "duplicati-alerts", notify.Message{
		Title: "Homelab: time to export the password vault",
		Body: "Last export: " + last + ". In the Bitwarden web vault: Tools > Export vault > .json (Encrypted) > Password protected " +
			"(keep that password outside the vault), then save it in recovery-staging/secrets in the homelab folder; the nightly Secrets job takes it off-site.",
		Tags: []string{"key"},
	})
	l.LastVaultReminder = time.Now()
	_ = l.Save(h.restoreLogPath())
}

// watchdog checks the engine, the tunnel, and every public app through
// Cloudflare (resolved with public DNS so the check takes the same path as
// someone outside), and alerts through ntfy when something breaks or recovers.
func (h *homelab) watchdog(ctx context.Context, args []string) error {
	fs := newFlags("watchdog")
	quiet := fs.Bool("quiet", false, "")
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	env := h.envMap()
	var results []health.Result
	var unwell []string  // running apps a restart may help
	var missing []string // apps whose container is gone
	engineUp := true
	client, err := h.docker(ctx)
	if err != nil {
		engineUp = false
		results = append(results, health.Result{Name: "docker engine", Err: fmt.Errorf("%s is not running", h.host.Runtime)})
	}
	if engineUp {
		// Apps Docker could not start because their drive was not mounted
		// yet start once it is.
		if started := h.startFailed(ctx, true); len(started) > 0 {
			h.ui.Info("started once their drive was there: %s", strings.Join(started, ", "))
		}
		containers, err := client.Containers(ctx)
		if err != nil {
			return err
		}
		// On battery, pause the heavy apps; on power, start them again.
		h.batterySaver(ctx, client, containers)
		if containers, err = client.Containers(ctx); err != nil {
			return err
		}
		// Updates: keep what each app ran before, and roll back one that
		// stays unwell after its update.
		if notes := h.trackUpdates(ctx, client, containers, true); len(notes) > 0 {
			for _, n := range notes {
				h.ui.Warn("%s", n)
			}
			h.alert(ctx, "watchtower", notify.Message{Title: "Homelab: an update was rolled back", Body: strings.Join(notes, "\n"), Priority: 4, Tags: []string{"rewind"}})
			if containers, err = client.Containers(ctx); err != nil {
				return err
			}
		}
		apps, sick, gone := h.appChecks(ctx, containers, env, health.LoadState(health.StatePath(h.root)))
		results, unwell, missing = append(results, apps...), sick, gone
		report := detect.Analyze(h.catalog, containers)
		results = append(results, h.dumpAgeChecks(report, time.Now())...)
		results = append(results, h.duplicatiChecks(ctx, report, env, time.Now())...)
		if checked, ok, msg := crowdsecBouncer(ctx, client, report, time.Now()); checked {
			r := health.Result{Name: "crowdsec bouncer", Status: 200}
			if !ok {
				r.Err = errors.New(msg)
			}
			results = append(results, r)
		}
		// Public names: only those domain setup published, for apps that
		// run. With the engine down the tunnel is down too, and that one
		// failure says enough.
		if dom := env["HOMELAB_DOMAIN"]; dom != "" && env["TUNNEL_TOKEN"] != "" {
			report := detect.Analyze(h.catalog, containers)
			hc := publicDNSClient()
			for _, a := range h.catalog.Apps {
				if st, _ := report.State(a.ID); st != detect.Running || !publishable(a.ID, a.Public(), env) {
					continue
				}
				host := a.Subdomain() + "." + dom
				results = append(results, health.Check(ctx, hc, host, "https://"+host+a.WebPath()))
			}
		}
	}
	// Disks fill whether or not the engine runs, and a full one stops it.
	home, _ := os.UserHomeDir()
	vols := checkDisks(diskspace.Locations(h.root, home, env))
	advice := diskspace.Advice
	if engineUp && anyLow(vols) {
		// Only then: sizing every image and volume takes a moment.
		dctx, cancel := context.WithTimeout(ctx, 30*time.Second)
		if us, err := client.DiskUsage(dctx); err == nil {
			if unused := unusedImages(us); unused != "" {
				advice = diskspace.AdviceWithImages(unused)
			}
		}
		cancel()
	}
	results = append(results, diskChecks(vols, advice)...)
	if drives, err := checkDrives(ctx); err == nil {
		results = append(results, driveChecks(drives)...)
	}
	statePath := health.StatePath(h.root)
	state := health.LoadState(statePath)
	failed, recovered := state.Update(results, time.Now())
	if err := state.Save(statePath); err != nil {
		h.ui.Warn("could not save watchdog state: %v", err)
	}
	if engineUp {
		if healed := h.heal(ctx, client, unwell, missing, state, env, time.Now()); len(healed) > 0 {
			h.alert(ctx, "tunnel-watchdog", notify.Message{Title: "Homelab: restarted an app that hung", Body: strings.Join(healed, "\n") + "\nUnwell on two checks in a row, so the watchdog restarted it (once in 6 hours at most; AUTO_HEAL=false turns this off).", Tags: []string{"arrows_counterclockwise"}})
		}
	}
	if url := env["HEARTBEAT_URL"]; url != "" {
		var failures []string
		for _, r := range results {
			if !r.OK() && state.Confirmed(r.Name) {
				failures = append(failures, r.Name+": "+r.Problem())
			}
		}
		hctx, cancel := context.WithTimeout(ctx, 15*time.Second)
		if err := health.Heartbeat(hctx, http.DefaultClient, url, failures); err != nil {
			h.ui.Warn("could not reach the external heartbeat: %v", err)
		}
		cancel()
	}
	failing := 0
	for _, r := range results {
		if !r.OK() {
			failing++
		}
		if !*quiet || !r.OK() {
			if r.OK() {
				h.ui.OK("%s", r.Name)
			} else {
				h.ui.Fail("%s: %s", r.Name, r.Problem())
			}
		}
	}
	if len(failed) > 0 && engineUp {
		var lines []string
		for _, r := range failed {
			lines = append(lines, r.Name+": "+r.Problem())
		}
		h.alert(ctx, "tunnel-watchdog", notify.Message{Title: "Homelab: something is down", Body: strings.Join(lines, "\n"), Priority: 4, Tags: []string{"warning"}})
	}
	if len(recovered) > 0 && engineUp {
		h.alert(ctx, "tunnel-watchdog", notify.Message{Title: "Homelab: recovered", Body: strings.Join(recovered, ", ") + " answering again", Tags: []string{"white_check_mark"}})
	}
	if failing > 0 {
		return fmt.Errorf("%d check(s) failing", failing)
	}
	if !*quiet {
		h.ui.Printf("\n  %s\n", h.ui.Green(fmt.Sprintf("All %d checks passed.", len(results))))
	}
	return nil
}

// appChecks covers every app the homelab runs, so alerts do not depend on
// Uptime Kuma: an unhealthy container, a baseline app that is not running,
// and, for apps without a health check, whether the web page answers on
// this machine. Apps stopped by hand, optional apps not installed,
// Watchtower while updates are paused, and the tunnel without a token are
// left alone. unwell are the running apps failing whose restart may help:
// unhealthy, or their page not answering; missing are those whose container
// is gone (removed outside the homelab, or by a prune). An optional app
// (every app a new household installs) is one of them when the watchdog saw
// it running this week (seen); one never installed is left alone.
func (h *homelab) appChecks(ctx context.Context, containers []docker.Container, env map[string]string, seen health.State) (out []health.Result, unwell, missing []string) {
	st := api.StatusOf(ctx, h.catalog, containers, env, true)
	local := &http.Client{Timeout: 10 * time.Second}
	for _, s := range st.Apps {
		a, ok := h.catalog.Get(s.ID)
		if !ok || a.Native() != nil {
			continue
		}
		r := health.Result{Name: s.ID, Status: 200}
		switch {
		case s.State == "running" && s.Health == "unhealthy":
			r.Err = fmt.Errorf("container unhealthy")
			unwell = append(unwell, s.ID)
		case s.State == "running" && s.Health == "restarting":
			r.Err = fmt.Errorf("keeps restarting (homelab logs %s says why)", s.ID)
		case s.State == "running" && s.Health == "" && s.URL != "" && !a.Internal():
			if r = health.Check(ctx, local, s.ID, s.URL); !r.OK() {
				unwell = append(unwell, s.ID)
			}
		case s.State == "running" || s.State == "elsewhere":
		case s.State == "stopped":
			continue // stopped by hand: every service restarts unless stopped
		case a.Optional() || a.Internal():
			continue // stopped or not installed: the user's choice
		case a.ID == updates.App && updates.Paused(env), a.ID == tunnelID && env["TUNNEL_TOKEN"] == "":
			continue
		default:
			r.Err = fmt.Errorf("not running")
			if s.State == "missing" {
				missing = append(missing, s.ID)
			}
		}
		out = append(out, r)
	}
	// Status leaves out an optional app without a container (not
	// installed); one the watchdog saw running this week lost it.
	listed := map[string]bool{}
	for _, s := range st.Apps {
		listed[s.ID] = true
	}
	for _, a := range h.catalog.Apps {
		if a.Optional() && !a.Internal() && a.Native() == nil && !listed[a.ID] && ranThisWeek(seen, a.ID) {
			out = append(out, health.Result{Name: a.ID, Status: 200, Err: fmt.Errorf("not running")})
			missing = append(missing, a.ID)
		}
	}
	return out, unwell, missing
}

// dumpAgeChecks notices backups that quietly stopped: a running app whose
// newest database dump is over 26 hours old. Apps never dumped yet (backups
// not set up) are left alone.
func (h *homelab) dumpAgeChecks(report *detect.Report, now time.Time) []health.Result {
	var out []health.Result
	for _, a := range h.catalog.Apps {
		if a.Meta.Dump == "" {
			continue
		}
		if st, _ := report.State(a.ID); st != detect.Running {
			continue
		}
		files, _ := filepath.Glob(filepath.Join(h.stagingDir("databases", a.ID), a.ID+"-*.gz"))
		var newest time.Time
		for _, f := range files {
			if fi, err := os.Stat(f); err == nil && fi.ModTime().After(newest) {
				newest = fi.ModTime()
			}
		}
		if newest.IsZero() {
			continue
		}
		r := health.Result{Name: a.ID + " backup", Status: 200}
		if age := now.Sub(newest); age > backup.StaleAfter {
			r.Err = fmt.Errorf("the newest database dump is %.0f hours old; is the backup job running? (homelab schedule status)", age.Hours())
		}
		out = append(out, r)
	}
	return out
}

// duplicatiChecks notices off-site backups that failed or quietly stopped:
// each Duplicati job whose last run failed, or that has not run for over
// a week. Only with Duplicati running and DUPLICATI_PASSWORD set; a job
// never run yet (being set up) is left alone.
func (h *homelab) duplicatiChecks(ctx context.Context, report *detect.Report, env map[string]string, now time.Time) []health.Result {
	if st, _ := report.State("duplicati"); st != detect.Running || env["DUPLICATI_PASSWORD"] == "" {
		return nil
	}
	port := env["DUPLICATI_PORT"]
	if port == "" {
		port = "8200"
	}
	jobs, err := duplicati.Jobs(ctx, "http://127.0.0.1:"+port, env["DUPLICATI_PASSWORD"], now)
	if err != nil {
		return []health.Result{{Name: "duplicati jobs", Err: err}}
	}
	var out []health.Result
	for _, j := range jobs {
		r := health.Result{Name: "duplicati " + j.Name, Status: 200}
		switch j.State {
		case "failed":
			r.Err = fmt.Errorf("the last run failed: %s", j.ErrorMessage)
		case "stale":
			r.Err = fmt.Errorf("no successful run since %s", j.LastFinished.Local().Format("2 January"))
		case "never":
			continue
		}
		out = append(out, r)
	}
	return out
}

// lastingBinary is a path to this CLI that the scheduled jobs can still run
// later. A CLI inside an AppImage (its folder is mounted only while the app
// runs) or a macOS app started from the download folder (moved to a random
// read-only path) is copied to bin/ in the homelab folder first.
func (h *homelab) lastingBinary(bin string) (string, error) {
	if !transientPath(bin, os.Getenv("APPDIR")) {
		return bin, nil
	}
	dst := filepath.Join(h.root, "bin", filepath.Base(bin))
	data, err := os.ReadFile(bin)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return "", err
	}
	tmp := dst + ".new"
	if err := os.WriteFile(tmp, data, 0o755); err != nil {
		return "", err
	}
	if err := os.Rename(tmp, dst); err != nil {
		return "", err
	}
	h.ui.Info("copied the CLI to %s, so the jobs do not depend on the app being open", h.rel(dst))
	return dst, nil
}

// transientPath reports a path that goes away: inside the running
// AppImage (appDir, or its usual mount and extraction folders) or a
// translocated macOS app.
func transientPath(p, appDir string) bool {
	if appDir != "" && strings.HasPrefix(p, strings.TrimSuffix(appDir, "/")+"/") {
		return true
	}
	for _, s := range []string{"/.mount_", "/appimage_extracted_", "/AppTranslocation/"} {
		if strings.Contains(p, s) {
			return true
		}
	}
	return false
}

// publicDNSClient resolves names through Cloudflare's public resolver, so
// checks of public hostnames bypass AdGuard's LAN rewrite.
func publicDNSClient() *http.Client {
	resolver := &net.Resolver{PreferGo: true, Dial: func(ctx context.Context, network, _ string) (net.Conn, error) {
		return (&net.Dialer{Timeout: 5 * time.Second}).DialContext(ctx, network, "1.1.1.1:53")
	}}
	dialer := &net.Dialer{Timeout: 10 * time.Second, Resolver: resolver}
	tr := http.DefaultTransport.(*http.Transport).Clone()
	tr.DialContext = dialer.DialContext
	return &http.Client{Timeout: 20 * time.Second, Transport: tr}
}

// publisherUser is the ntfy account every alert source publishes as.
const publisherUser = "homelab"

// readerUser reads the alert topics for the desktop app's alert list.
const readerUser = "homelab-reader"

// phoneUser is the account the phone's ntfy app subscribes with.
const phoneUser = "phone"

var ntfyTokenRe = regexp.MustCompile(`tk_[A-Za-z0-9]+`)

// ntfyTokenAdd makes an access token for user: ntfy says the new token on
// stderr, which Exec does not keep, so the shell moves it to stdout. The
// label and user are this file's constants.
func ntfyTokenAdd(label, user string) string {
	return "exec ntfy token add --label=" + label + " " + user + " 2>&1"
}

// notify manages ntfy: write grants for the alert topics, and a test message.
func (h *homelab) notify(ctx context.Context, args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: homelab notify setup | homelab notify test [topic]")
	}
	switch args[0] {
	case "setup":
		fs := newFlags("notify setup")
		apply := applyFlag(fs)
		if _, err := parseFlags(fs, args[1:]); err != nil {
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
		ctr, ok := runningContainer(detect.Analyze(h.catalog, containers), "ntfy")
		if !ok {
			return fmt.Errorf("ntfy is not running (homelab up starts it)")
		}
		env := h.envMap()
		u := h.ui
		u.Title("ntfy publishers")
		u.Info("user %s may publish to these topics, and nobody else (anonymous write access is removed):", publisherUser)
		for _, t := range notify.Topics {
			u.Info("%s", t)
		}
		if env["NTFY_PUBLISH_TOKEN"] == "" {
			u.Info("create its access token and keep it in .env (NTFY_PUBLISH_TOKEN, NTFY_PUBLISH_AUTH)")
		} else {
			u.Info("keep the access token already in .env")
		}
		u.Info("user %s may read them, for the app's list of recent alerts (NTFY_READ_TOKEN)", readerUser)
		u.Info("user %s may read them, for the phone's ntfy app; its password goes in .env (NTFY_PHONE_PASSWORD)", phoneUser)
		u.Info("recreate Watchtower so its alerts use the token")
		if err := h.goAhead(*apply, "\nSet up the publishers?"); err != nil {
			return err
		}
		// The password is never used (the token is), so it is made inside
		// the container and never seen; an existing user is fine.
		addUser := `NTFY_PASSWORD="$(head -c 24 /dev/urandom | base64)" exec ntfy user add ` + publisherUser
		if _, err := client.Exec(ctx, ctr.Name, "sh", "-c", addUser); err != nil && !strings.Contains(err.Error(), "exists") {
			return fmt.Errorf("adding the %s user: %w", publisherUser, err)
		}
		for _, t := range notify.Topics {
			if _, err := client.Exec(ctx, ctr.Name, "ntfy", "access", publisherUser, t, "write-only"); err != nil {
				return fmt.Errorf("granting %s: %w", t, err)
			}
			_, _ = client.Exec(ctx, ctr.Name, "ntfy", "access", "--reset", "*", t)
		}
		u.OK("%s may publish to %d topic(s); anonymous write access removed", publisherUser, len(notify.Topics))
		addReader := `NTFY_PASSWORD="$(head -c 24 /dev/urandom | base64)" exec ntfy user add ` + readerUser
		if _, err := client.Exec(ctx, ctr.Name, "sh", "-c", addReader); err != nil && !strings.Contains(err.Error(), "exists") {
			return fmt.Errorf("adding the %s user: %w", readerUser, err)
		}
		for _, t := range notify.Topics {
			if _, err := client.Exec(ctx, ctr.Name, "ntfy", "access", readerUser, t, "read-only"); err != nil {
				return fmt.Errorf("granting %s read access to %s: %w", readerUser, t, err)
			}
		}
		if env["NTFY_READ_TOKEN"] == "" {
			out, err := client.Exec(ctx, ctr.Name, "sh", "-c", ntfyTokenAdd("homelab-app", readerUser))
			readToken := ntfyTokenRe.FindString(string(out))
			if err != nil || readToken == "" {
				return fmt.Errorf("creating the reader's access token: %v", err)
			}
			f, err := envfile.Load(h.envFile)
			if err != nil {
				return err
			}
			f.Set("NTFY_READ_TOKEN", readToken)
			if err := f.Save(); err != nil {
				return err
			}
		}
		u.OK("%s may read the alert topics (NTFY_READ_TOKEN)", readerUser)
		if err := h.ntfyPhoneUser(ctx, client, ctr.Name, env["NTFY_PHONE_PASSWORD"]); err != nil {
			return err
		}
		token := env["NTFY_PUBLISH_TOKEN"]
		if token == "" {
			out, err := client.Exec(ctx, ctr.Name, "sh", "-c", ntfyTokenAdd("homelab", publisherUser))
			if token = ntfyTokenRe.FindString(string(out)); err != nil || token == "" {
				return fmt.Errorf("creating the access token: %v", err)
			}
			f, err := envfile.Load(h.envFile)
			if err != nil {
				return err
			}
			f.Set("NTFY_PUBLISH_TOKEN", token)
			f.Set("NTFY_PUBLISH_AUTH", notify.AuthParam(token))
			if err := f.Save(); err != nil {
				return err
			}
			u.OK("access token saved in .env (NTFY_PUBLISH_TOKEN, NTFY_PUBLISH_AUTH)")
		}
		if a, ok := h.catalog.Get("watchtower"); ok {
			// Paused updates stay paused: recreate it without starting it.
			start := "--detach"
			if updates.Paused(env) {
				start = "--no-start"
			}
			if err := client.Compose(ctx, h.project(a.File), a.Profiles, "up", start, a.ID); err != nil {
				return fmt.Errorf("recreating Watchtower: %w", err)
			}
			u.OK("Watchtower uses the token")
		}
		if c, err := h.duplicatiLogin(ctx); err == nil {
			if err := h.duplicatiAlerts(ctx, c, h.envMap(), true); err != nil {
				u.Warn("Duplicati alerts: %v", err)
			}
		} else {
			u.Info("Duplicati alerts: not now (%v); homelab duplicati setup adds them", err)
		}
		kuma := "Give Uptime Kuma the token too (docs/Monitoring.md)."
		if env["HOMELAB_DOMAIN"] != "" {
			kuma = "Give Uptime Kuma the token too (docs/Monitoring.md); then homelab domain setup publishes ntfy."
		}
		u.Printf("\n  %s\n  %s\n", u.Dim("On the phone: the ntfy app › Settings › Users › add "+h.ntfyPhoneAddress(env)+", user "+phoneUser+", and the password from the app's Settings › ntfy phone password › Copy; then subscribe to the topics."),
			u.Dim(kuma))
		return nil
	case "test":
		topic := "tunnel-watchdog"
		if len(args) > 1 {
			topic = args[1]
		}
		if err := h.ntfy().Publish(ctx, topic, notify.Message{Title: "Homelab test", Body: "If you can read this, alerts on " + topic + " work."}); err != nil {
			return err
		}
		h.ui.OK("sent a test message to %s", topic)
		return nil
	}
	return fmt.Errorf("unknown notify command %q (setup, test)", args[0])
}

func jobs() []schedule.Job { return schedule.Jobs() }

func (h *homelab) scheduler() (schedule.Scheduler, error) { return schedule.For(h.host) }

func lingering() bool { return schedule.Lingering() }

// ntfyPhoneAddress is where a phone's ntfy app finds the homelab's ntfy: its
// name on the domain, else its address on the tailnet (Home mode), else
// where to find that once the tailnet addresses are set up.
func (h *homelab) ntfyPhoneAddress(env map[string]string) string {
	a, ok := h.catalog.Get("ntfy")
	if !ok {
		return "ntfy's address"
	}
	if dom := env["HOMELAB_DOMAIN"]; dom != "" {
		return "https://" + a.Subdomain() + "." + dom
	}
	if host := env["TAILSCALE_HOST"]; host != "" {
		for _, r := range tailnet.Routes([]*catalog.App{a}, compose.MapLookup(env)) {
			return "https://" + tailnet.Address(host, r.Port)
		}
	}
	return "ntfy's address on your tailnet (Status shows it once Setup › Addresses on your tailnet is done)"
}

// loginName is the account loginctl enable-linger needs: $USER, else the
// account the homelab runs as (USER is unset under sudo -i and some shells).
func loginName() string {
	if name := os.Getenv("USER"); name != "" {
		return name
	}
	if me, err := user.Current(); err == nil {
		return me.Username
	}
	return "$USER"
}

// schedule installs, shows, or removes the scheduled jobs.
func (h *homelab) schedule(_ context.Context, args []string) error {
	if len(args) == 0 {
		args = []string{"status"}
	}
	fs := newFlags("schedule")
	apply := applyFlag(fs)
	if _, err := parseFlags(fs, args[1:]); err != nil {
		return err
	}
	l, err := h.scheduler()
	if err != nil {
		return err
	}
	u := h.ui
	switch args[0] {
	case "status":
		u.Title("Scheduled jobs")
		var rows [][]string
		for _, j := range jobs() {
			s := l.Status(j.Label)
			state := u.Yellow("not installed")
			switch {
			case s.Loaded:
				state = u.Green("installed")
				if s.LastExit != "" && s.LastExit != "0" && !strings.Contains(s.LastExit, "never") {
					state = u.Red("last run failed (" + s.LastExit + ")")
				}
			case s.Installed:
				state = u.Yellow("present, not loaded")
			}
			rows = append(rows, []string{j.Label, j.When(), state, u.Dim(j.Description)})
		}
		u.Table(nil, rows)
		u.Printf("\n  %s\n", u.Dim("Logs: "+h.rel(h.logsDir())+"/<job>.log"))
		if h.host.Scheduler == "systemd" && !lingering() {
			u.Printf("  %s\n", u.Yellow("Jobs run only while you are logged in: loginctl enable-linger "+loginName()))
		}
		return nil
	case "install":
		bin, err := os.Executable()
		if err != nil {
			return err
		}
		bin, _ = filepath.EvalSymlinks(bin)
		if bin, err = h.lastingBinary(bin); err != nil {
			return err
		}
		// On a Mac with Homelab Wizard installed, the agent runs from the
		// app's own agent bundle, whichever homelab ran this (a git
		// checkout's ./homelab too), so Login Items shows it as Homelab
		// Wizard with the app's icon.
		if agent := schedule.AgentBinary(); agent != "" {
			bin = agent
		}
		home, _ := os.UserHomeDir()
		path := h.host.JobPath(home)
		u.Title("Install scheduled jobs")
		for _, j := range jobs() {
			u.Info("%s: %s, %s", j.Label, j.When(), j.Description)
		}
		u.Info("runs %s from %s", h.rel(bin), h.root)
		if err := h.goAhead(*apply, "\nInstall?"); err != nil {
			return err
		}
		if err := os.MkdirAll(h.logsDir(), 0o755); err != nil {
			return err
		}
		for _, j := range jobs() {
			if err := l.InstallJob(j, bin, h.root, h.logsDir(), path); err != nil {
				return err
			}
			u.OK("%s", j.Label)
		}
		// The separate jobs older versions installed, now the agent's work.
		for _, label := range schedule.Legacy {
			if l.Status(label).Installed {
				if err := l.Remove(label); err == nil {
					u.OK("removed %s (the agent does its work now)", label)
				}
			}
		}
		// Jobs an older version installed under names no longer used.
		if ld, ok := l.(schedule.Launchd); ok {
			for _, label := range ld.Stale(jobs()) {
				if err := ld.Remove(label); err == nil {
					u.OK("removed the old job %s", label)
				}
			}
		}
		if h.host.Scheduler == "systemd" && !lingering() {
			u.Warn("to run the jobs at boot and after you log out: loginctl enable-linger %s", loginName())
		}
		return nil
	case "remove":
		u.Title("Remove scheduled jobs")
		for _, j := range jobs() {
			u.Info("%s: %s", j.Label, j.Description)
		}
		u.Info("the apps keep running; they just won't start after a restart, be backed up nightly, or be watched (homelab schedule install puts the jobs back)")
		if err := h.goAhead(*apply, "\nRemove?"); err != nil {
			return err
		}
		for _, j := range jobs() {
			if err := l.Remove(j.Label); err != nil {
				return err
			}
			u.OK("removed %s", j.Label)
		}
		for _, label := range schedule.Legacy {
			if l.Status(label).Installed {
				_ = l.Remove(label)
			}
		}
		return nil
	}
	return fmt.Errorf("unknown schedule command %q (install, status, remove)", args[0])
}

// ntfyPhoneUser makes the phone's ntfy account, read-only on the alert
// topics. A new password is generated and kept in .env; it reaches ntfy
// through docker's environment, never a command line. An account made by
// hand before gets the generated password.
func (h *homelab) ntfyPhoneUser(ctx context.Context, client *docker.Client, ctr, password string) error {
	isNew := password == ""
	if isNew {
		var err error
		if password, err = envfile.NewSecret("NTFY_PHONE_PASSWORD"); err != nil {
			return err
		}
	}
	os.Setenv("NTFY_PASSWORD", password)
	defer os.Unsetenv("NTFY_PASSWORD")
	if _, err := client.ExecEnv(ctx, ctr, []string{"NTFY_PASSWORD"}, "ntfy", "user", "add", phoneUser); err != nil {
		if !strings.Contains(err.Error(), "exists") {
			return fmt.Errorf("adding the %s user: %w", phoneUser, err)
		}
		if isNew {
			if _, err := client.ExecEnv(ctx, ctr, []string{"NTFY_PASSWORD"}, "ntfy", "user", "change-pass", phoneUser); err != nil {
				return fmt.Errorf("setting the %s user's password: %w", phoneUser, err)
			}
		}
	}
	for _, t := range notify.Topics {
		if _, err := client.Exec(ctx, ctr, "ntfy", "access", phoneUser, t, "read-only"); err != nil {
			return fmt.Errorf("granting %s read access to %s: %w", phoneUser, t, err)
		}
	}
	if isNew {
		f, err := envfile.Load(h.envFile)
		if err != nil {
			return err
		}
		f.Set("NTFY_PHONE_PASSWORD", password)
		if err := f.Save(); err != nil {
			return err
		}
	}
	h.ui.OK("%s may read the alert topics; its password is in .env (NTFY_PHONE_PASSWORD)", phoneUser)
	return nil
}
