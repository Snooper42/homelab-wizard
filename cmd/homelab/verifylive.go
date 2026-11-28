package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"maps"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/diskspace"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
	"github.com/Snooper42/homelab-wizard/internal/schedule"
	"github.com/Snooper42/homelab-wizard/internal/wiring"
)

// verify-live (homelab doctor --live, scripts/verify-mac-live.sh) checks the
// real things the tests only fake, on the machine itself, in a workspace of
// its own (the reliability reset's Phase 4): the Docker engine and a
// container's whole life, a folder shared with a container, the scheduled
// job's plist and the PATH it runs with, a volume and a PostgreSQL database
// backed up and restored, a Duplicati backup restored with nothing but its
// files (as a new machine would), and each connected app's key and API.
//
// It never touches the household's own apps or data: what it makes is named
// homelab-verify-<random> and removed at the end, its files live in
// recovery-staging/verify-live-<random> (in no backup job's sources), and
// the apps it reads are only read. The output is a PASS/FAIL table to paste
// back, each FAIL with what to do.

// liveResult is one row of the table.
type liveResult struct {
	Check, State, Detail string // State: PASS, FAIL, or SKIP
}

// liveRun holds what one run made, so cleanup removes exactly that.
type liveRun struct {
	h          *homelab
	client     *docker.Client
	tag        string // homelab-verify-<random>
	ws         string // the workspace folder
	containers []string
	volumes    []string
	results    []liveResult
}

func (r *liveRun) add(check, state, detail string) {
	r.results = append(r.results, liveResult{check, state, detail})
}

func (r *liveRun) result(check string, err error, ok string) {
	if err != nil {
		r.add(check, "FAIL", err.Error())
		return
	}
	r.add(check, "PASS", ok)
}

// docker runs one docker command, for this run's own containers and volumes.
func (r *liveRun) docker(ctx context.Context, args ...string) (string, error) {
	out, err := r.client.Runner.Output(ctx, r.client.Bin, args...)
	return strings.TrimSpace(string(out)), err
}

// verifyPostgresImage is the database the rounds run: small, and the
// major version most of the catalog's databases use (Paperless-ngx,
// Nextcloud, Firefly III, Tandoor, Linkwarden: 18).
const verifyPostgresImage = "postgres:18-alpine"

func (h *homelab) verifyLive(ctx context.Context, args []string) error {
	fs := newFlags("verify-live")
	keep := fs.Bool("keep", false, "")
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	u := h.ui
	u.Title("Live check of this machine (nothing of the household's is changed)")
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	r := &liveRun{h: h, tag: "homelab-verify-" + hex.EncodeToString(b)}
	if err := os.MkdirAll(h.stagingDir(), 0o700); err != nil {
		return err
	}
	ws, err := os.MkdirTemp(h.stagingDir(), "verify-live-")
	if err != nil {
		return err
	}
	r.ws = ws
	defer func() {
		r.cleanup()
		if !*keep {
			_ = os.RemoveAll(ws)
		}
	}()

	client, err := h.docker(ctx)
	if err != nil {
		r.add("Docker engine", "FAIL", err.Error()+": start "+h.host.Runtime+", then run this again")
	} else {
		r.client = client
		r.engine(ctx)
	}
	engineUp := len(r.results) > 0 && r.results[0].State == "PASS"
	steps := []struct {
		name string
		run  func(context.Context) error
		ok   string
	}{
		{"Container start, stop, remove", r.lifecycle, "a throwaway container ran, stopped, and was removed"},
		{"A folder shared with a container", r.sharedFolder, "a container wrote into the homelab folder as this account"},
		{"A volume backed up and restored", r.volumeRoundTrip, "every file came back the same"},
		{"A database dumped and restored", r.postgresRoundTrip, "PostgreSQL 18's dump loaded cleanly into a new database: every row, its index, and the function it is built on"},
		{"A database put back after a schema change", r.postgresSchemaRollback, "the dump from before an update's migration put back over it, an app's session open: the database exactly as before"},
		{"Immich's database dumped and restored", r.immichRoundTrip, "Immich's own database image: its dump loaded cleanly, vectors included"},
		{"Duplicati: a blind restore", r.duplicatiRoundTrip, "a backup made with Duplicati came back from its files alone, every file the same"},
	}
	for _, s := range steps {
		if !engineUp {
			r.add(s.name, "SKIP", "needs the Docker engine")
			continue
		}
		sctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
		err := s.run(sctx)
		cancel()
		if errors.Is(err, errLiveSkip) {
			r.add(s.name, "SKIP", strings.TrimPrefix(err.Error(), errLiveSkip.Error()+": "))
			continue
		}
		r.result(s.name, err, s.ok)
	}
	r.launchd(ctx)
	if engineUp {
		r.wiring(ctx)
	}
	r.runway()

	var rows [][]string
	failed, passed, skipped := 0, 0, 0
	for _, x := range r.results {
		state := x.State
		switch x.State {
		case "PASS":
			passed++
			state = u.Green(state)
		case "FAIL":
			failed++
			state = u.Red(state)
		default:
			skipped++
			state = u.Dim(state)
		}
		rows = append(rows, []string{state, x.Check, x.Detail})
	}
	u.Printf("\n")
	u.Table([]string{"Result", "Check", "What it found"}, rows)
	u.Printf("\n  %d passed, %d failed, %d skipped. Paste everything from \"Live check\" down back to the reset's pull request.\n", passed, failed, skipped)
	if failed > 0 {
		return fmt.Errorf("%d live check(s) failed", failed)
	}
	return nil
}

// errLiveSkip marks a check that does not apply here, with why.
var errLiveSkip = errors.New("skip")

func skipLive(why string) error { return fmt.Errorf("%w: %s", errLiveSkip, why) }

func (r *liveRun) engine(ctx context.Context) {
	out, err := r.docker(ctx, "info", "--format", "{{.Name}} {{.ServerVersion}} {{.OperatingSystem}}")
	if err != nil {
		r.add("Docker engine", "FAIL", "docker info: "+err.Error()+": start "+r.h.host.Runtime+", then run this again")
		return
	}
	r.add("Docker engine", "PASS", "answers: "+out+" ("+r.client.Bin+")")
}

func (r *liveRun) lifecycle(ctx context.Context) error {
	name := r.tag + "-life"
	r.containers = append(r.containers, name)
	if _, err := r.docker(ctx, "run", "-d", "--name", name, "--label", "homelab.verify=1", "alpine:3", "sleep", "120"); err != nil {
		return fmt.Errorf("docker run: %w (can Docker pull alpine:3?)", err)
	}
	running, err := r.docker(ctx, "inspect", "--format", "{{.State.Running}}", name)
	if err != nil || running != "true" {
		return fmt.Errorf("the container did not keep running (%q, %v)", running, err)
	}
	if _, err := r.docker(ctx, "stop", "--time", "2", name); err != nil {
		return fmt.Errorf("docker stop: %w", err)
	}
	if _, err := r.docker(ctx, "rm", name); err != nil {
		return fmt.Errorf("docker rm: %w", err)
	}
	return nil
}

func (r *liveRun) sharedFolder(ctx context.Context) error {
	dir := filepath.Join(r.ws, "shared")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	user := []string{}
	if runtime.GOOS != "windows" {
		user = []string{"--user", strconv.Itoa(os.Getuid()) + ":" + strconv.Itoa(os.Getgid())}
	}
	args := append(append([]string{"-v", dir + ":/w"}, user...), "alpine:3", "sh", "-c", "echo homelab > /w/probe")
	if err := r.client.RunTo(ctx, io.Discard, args...); err != nil {
		return fmt.Errorf("a container could not write into %s: %w (is the homelab folder shared with Docker?)", r.h.rel(dir), err)
	}
	data, err := os.ReadFile(filepath.Join(dir, "probe"))
	if err != nil || strings.TrimSpace(string(data)) != "homelab" {
		return fmt.Errorf("what the container wrote is not here (%v): Docker is not sharing %s", err, r.h.rel(dir))
	}
	return nil
}

// treeHash is a listing of every file in a volume with its SHA-256, read
// from inside a container, sorted: two equal listings are equal contents.
func (r *liveRun) treeHash(ctx context.Context, volume string) (string, error) {
	var out strings.Builder
	err := r.client.RunTo(ctx, &out, "-v", volume+":/v:ro", "alpine:3", "sh", "-c", "cd /v && find . -type f -exec sha256sum {} + | sort")
	return out.String(), err
}

func (r *liveRun) volumeRoundTrip(ctx context.Context) error {
	from, to := r.tag+"-from", r.tag+"-to"
	r.volumes = append(r.volumes, from, to)
	for _, v := range []string{from, to} {
		if _, err := r.docker(ctx, "volume", "create", "--label", "homelab.verify=1", v); err != nil {
			return fmt.Errorf("docker volume create: %w", err)
		}
	}
	fill := "mkdir -p /v/sub && echo receipt > /v/receipt.pdf && head -c 1048576 /dev/urandom > /v/sub/photo.heic && echo hidden > /v/.dotfile"
	if err := r.client.RunTo(ctx, io.Discard, "-v", from+":/v", "alpine:3", "sh", "-c", fill); err != nil {
		return fmt.Errorf("filling the test volume: %w", err)
	}
	archive, n, err := backup.VolumeArchive(ctx, r.client, from, filepath.Join(r.ws, "volumes"), "verify", time.Now())
	if err != nil {
		return err
	}
	if err := loadVolume(ctx, r.client, to, archive); err != nil {
		return err
	}
	a, err := r.treeHash(ctx, from)
	if err != nil {
		return err
	}
	b, err := r.treeHash(ctx, to)
	if err != nil {
		return err
	}
	if a == "" || a != b {
		return fmt.Errorf("the restored volume differs from the one backed up (%d entries archived)", n)
	}
	return nil
}

// pgSeedOf is the test database: 500 photos, and, as Immich's schema has,
// an index on a function that calls an extension's function. bare names
// that function as Immich's schema (made for PostgreSQL 14) does,
// unqualified: pg_dump writes an empty search_path before each database,
// under which that index can't be built again, and restoreDump relaxes it
// as Immich's restore instructions do, which the Immich round proves.
// PostgreSQL 17 and later build every index with a search path of their
// own (pg_catalog), so a schema made for them names it in full.
func pgSeedOf(bare bool) string {
	call := "public.unaccent('public.unaccent', $1)"
	if bare {
		call = "unaccent('unaccent', $1)"
	}
	return `create extension if not exists unaccent;
create function f_unaccent(text) returns text language sql immutable parallel safe as 'select ` + strings.ReplaceAll(call, "'", "''") + `';
create table photos (id int primary key, name text);
insert into photos select g, 'IMG_' || g from generate_series(1, 500) g;
create index photos_name on photos (f_unaccent(lower(name)));`
}

// pgStart starts a throwaway database of image, with a password of its own,
// and waits until it answers.
func (r *liveRun) pgStart(ctx context.Context, image, name string) error {
	if err := r.client.EnsureImage(ctx, image); err != nil {
		return fmt.Errorf("getting %s: %w", image, err)
	}
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	r.containers = append(r.containers, name)
	_, err := r.docker(ctx, "run", "-d", "--name", name, "--label", "homelab.verify=1",
		"-e", "POSTGRES_USER=verify", "-e", "POSTGRES_PASSWORD="+hex.EncodeToString(b), "-e", "POSTGRES_DB=household", image)
	if err != nil {
		return fmt.Errorf("starting %s: %w", image, err)
	}
	return pgReady(ctx, r.client, name, 2*time.Minute)
}

// psql runs sql in a throwaway database, with no shell between (the SQL has
// dollar signs and quotes), and returns what it printed, trimmed.
func (r *liveRun) psql(ctx context.Context, ctr, sql string) (string, error) {
	out, err := r.client.Exec(ctx, ctr, "psql", "-tA", "-v", "ON_ERROR_STOP=1", "-U", "verify", "-d", "household", "-c", sql)
	if err != nil {
		return "", fmt.Errorf("%w %s", err, strings.TrimSpace(string(out)))
	}
	return strings.TrimSpace(string(out)), nil
}

// pgWant runs a query and says what it got when that is not want.
func (r *liveRun) pgWant(ctx context.Context, ctr, sql, want, what string) error {
	got, err := r.psql(ctx, ctr, sql)
	if err != nil || got != want {
		return fmt.Errorf("after the restore, %s: got %q, want %q (%v)", what, got, want, err)
	}
	return nil
}

// pgSeeded is the seed as the restore must give it back: every row, the
// index, and the function it is built on working.
func (r *liveRun) pgSeeded(ctx context.Context, ctr string) error {
	if err := r.pgWant(ctx, ctr, "select count(*) from photos", "500", "the photos"); err != nil {
		return err
	}
	if err := r.pgWant(ctx, ctr, "select count(*) from pg_indexes where indexname = 'photos_name'", "1", "the index on f_unaccent"); err != nil {
		return err
	}
	return r.pgWant(ctx, ctr, "select count(*) from photos where f_unaccent(name) = 'IMG_1'", "1", "the function the index is built on")
}

func (r *liveRun) postgresRoundTrip(ctx context.Context) error {
	from, to := r.tag+"-db-from", r.tag+"-db-to"
	if err := r.pgStart(ctx, verifyPostgresImage, from); err != nil {
		return err
	}
	if _, err := r.psql(ctx, from, pgSeedOf(false)); err != nil {
		return fmt.Errorf("making the test database: %w", err)
	}
	dump, err := backup.PostgresDump(ctx, r.client, from, filepath.Join(r.ws, "databases"), "verify", time.Now())
	if err != nil {
		return err
	}
	if err := r.pgStart(ctx, verifyPostgresImage, to); err != nil {
		return err
	}
	if out, err := restoreDump(ctx, r.client, to, dump); err != nil {
		return fmt.Errorf("%w\n%s", err, lastLines(out, 3))
	}
	return r.pgSeeded(ctx, to)
}

// postgresSchemaRollback is a rollback of an app whose update moved its
// schema on (SRE audit H1): the dump taken before the update, a migration
// (a new column, a new table, a new row), an app's session still open on
// the database, then the dump loaded back over it by the rollback's own
// loader. The database must be the one from before the update, exactly.
func (r *liveRun) postgresSchemaRollback(ctx context.Context) error {
	ctr := r.tag + "-db-rollback"
	if err := r.pgStart(ctx, verifyPostgresImage, ctr); err != nil {
		return err
	}
	if _, err := r.psql(ctx, ctr, pgSeedOf(false)); err != nil {
		return fmt.Errorf("making the test database: %w", err)
	}
	dump, err := backup.PostgresDump(ctx, r.client, ctr, filepath.Join(r.ws, "databases"), "verify-before", time.Now())
	if err != nil {
		return err
	}
	migrate := "alter table photos add column taken timestamptz; create table albums (id int primary key, title text); insert into photos values (501, 'IMG_501', now()); insert into albums values (1, 'Summer')"
	if _, err := r.psql(ctx, ctr, migrate); err != nil {
		return fmt.Errorf("the update's migration: %w", err)
	}
	// An app that still holds the database open, as one that was not
	// stopped would: its session would keep DROP DATABASE from going ahead.
	if _, err := r.docker(ctx, "exec", "-d", ctr, "psql", "-U", "verify", "-d", "household", "-c", "select pg_sleep(600)"); err != nil {
		return fmt.Errorf("holding a session open: %w", err)
	}
	if out, err := restoreDump(ctx, r.client, ctr, dump); err != nil {
		return fmt.Errorf("%w\n%s", err, lastLines(out, 3))
	}
	if err := r.pgSeeded(ctx, ctr); err != nil {
		return err
	}
	if err := r.pgWant(ctx, ctr, "select count(*) from information_schema.columns where table_name = 'photos' and column_name = 'taken'", "0", "the update's new column"); err != nil {
		return err
	}
	return r.pgWant(ctx, ctr, "select coalesce(to_regclass('albums')::text, 'gone')", "gone", "the update's new table")
}

// immichRoundTrip is the same round on Immich's own database image, with its
// vector extensions where the image has them: where a restore is most likely
// to trip. Only where the image is already on this machine (Immich is
// installed, or the nightly run fetched it): it is large to fetch for a check.
func (r *liveRun) immichRoundTrip(ctx context.Context) error {
	a, ok := r.h.catalog.Get("immich-database")
	if !ok {
		return skipLive("the catalog has no Immich database")
	}
	image, err := compose.Interpolate(a.Image, compose.MapLookup(r.h.envMap()))
	if err != nil || image == "" {
		return skipLive("Immich's database image can't be named")
	}
	if _, err := r.client.ImageID(ctx, image); err != nil {
		return skipLive("Immich's database image isn't on this machine (Immich isn't installed)")
	}
	from, to := r.tag+"-immich-from", r.tag+"-immich-to"
	if err := r.pgStart(ctx, image, from); err != nil {
		return err
	}
	if _, err := r.psql(ctx, from, pgSeedOf(true)); err != nil {
		return fmt.Errorf("making the test database: %w", err)
	}
	vectors, _ := r.psql(ctx, from, "select count(*) from pg_available_extensions where name = 'vector'")
	if vectors == "1" {
		faces := "create extension if not exists vector; create table faces (id int primary key, embedding vector(3)); insert into faces select g, ('[' || g || ',1,0]')::vector from generate_series(1, 50) g; create index faces_embedding on faces using hnsw (embedding vector_cosine_ops)"
		if _, err := r.psql(ctx, from, faces); err != nil {
			return fmt.Errorf("making the test faces: %w", err)
		}
	}
	dump, err := backup.PostgresDump(ctx, r.client, from, filepath.Join(r.ws, "databases"), "verify-immich", time.Now())
	if err != nil {
		return err
	}
	if err := r.pgStart(ctx, image, to); err != nil {
		return err
	}
	if out, err := restoreDump(ctx, r.client, to, dump); err != nil {
		return fmt.Errorf("%w\n%s", err, lastLines(out, 3))
	}
	if err := r.pgSeeded(ctx, to); err != nil {
		return err
	}
	if vectors == "1" {
		return r.pgWant(ctx, to, "select count(*) from faces", "50", "the faces' vectors")
	}
	return nil
}

func (r *liveRun) duplicatiRoundTrip(ctx context.Context) error {
	image := r.h.duplicatiImage()
	if _, err := r.client.ImageID(ctx, image); err != nil {
		return skipLive("Duplicati's image is not on this machine (install Duplicati first)")
	}
	src, dest, into := filepath.Join(r.ws, "dup-source"), filepath.Join(r.ws, "dup-backup"), filepath.Join(r.ws, "dup-restore")
	for _, d := range []string{filepath.Join(src, "documents"), dest} {
		if err := os.MkdirAll(d, 0o755); err != nil {
			return err
		}
	}
	files := map[string]string{"documents/tax-2025.pdf": "a tax return", "documents/passport.jpg": strings.Repeat("photo", 2000), "notes.txt": "the household's notes"}
	for rel, body := range files {
		if err := os.WriteFile(filepath.Join(src, filepath.FromSlash(rel)), []byte(body), 0o600); err != nil {
			return err
		}
	}
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	pass := hex.EncodeToString(b)
	args := []string{"run", "--rm", "-e", "PASSPHRASE", "-e", "HOME=/tmp/duplicati", "-e", "DUPLICATI__SERVER_DATAFOLDER=/tmp/duplicati", "-e", "TMPDIR=/tmp",
		"-v", src + ":/source:ro", "-v", dest + ":/destination"}
	if runtime.GOOS != "windows" {
		args = append(args, "--user", strconv.Itoa(os.Getuid())+":"+strconv.Itoa(os.Getgid()))
	}
	args = append(args, "--entrypoint", "/app/duplicati/duplicati-cli", image, "backup", "file:///destination/verify", "/source/")
	cmd := procattr.Hide(exec.CommandContext(ctx, r.client.Bin, args...))
	cmd.Env = append(os.Environ(), "PASSPHRASE="+pass)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("Duplicati's backup: %w\n%s", err, lastLines(withoutTrace(out), 3))
	}
	if err := r.h.hydrateBackup(ctx, filepath.Join(dest, "verify")); err != nil {
		return err
	}
	if err := restoreJob(ctx, r.client, image, dest, "verify", into, pass); err != nil {
		return fmt.Errorf("the blind restore: %w", err)
	}
	for rel, body := range files {
		got, err := findRestored(into, filepath.FromSlash(rel))
		if err != nil || string(got) != body {
			return fmt.Errorf("%s did not come back the same (%v)", rel, err)
		}
	}
	return nil
}

// findRestored reads rel from a Duplicati restore, which keeps the source's
// own folders (/source/...) under the restore folder.
func findRestored(into, rel string) ([]byte, error) {
	for _, p := range []string{filepath.Join(into, rel), filepath.Join(into, "source", rel)} {
		if data, err := os.ReadFile(p); err == nil {
			return data, nil
		}
	}
	return nil, os.ErrNotExist
}

// plistPathRe is the PATH a plist gives its job.
var plistPathRe = regexp.MustCompile(`<key>PATH</key>\s*<string>([^<]*)</string>`)

// liveOS is the system verify-live checks as: tests take one path on every
// machine, as a CI runner's own LaunchAgents are not the test's.
var liveOS = runtime.GOOS

func (r *liveRun) launchd(ctx context.Context) {
	const check = "The scheduled agent (launchd)"
	if liveOS != "darwin" {
		r.add(check, "SKIP", "not a Mac")
		return
	}
	home, _ := os.UserHomeDir()
	job := schedule.Jobs()[0]
	installed := filepath.Join(home, "Library", "LaunchAgents", job.Label+".plist")
	info, err := os.Stat(installed)
	if err != nil {
		r.add(check, "FAIL", "not installed: ./homelab schedule install --apply")
		return
	}
	// A plist as homelab schedule install writes it, checked by macOS's own
	// parser; then the one installed.
	fresh := filepath.Join(r.ws, job.Label+".plist")
	if err := os.WriteFile(fresh, job.Plist("/Applications/Homelab Wizard.app/Contents/MacOS/homelab", r.h.root, r.h.logsDir(), r.h.host.JobPath(home)), 0o644); err != nil {
		r.add(check, "FAIL", err.Error())
		return
	}
	if out, err := exec.CommandContext(ctx, "plutil", "-lint", fresh).CombinedOutput(); err != nil {
		r.add(check, "FAIL", "the plist homelab writes does not parse: "+strings.TrimSpace(string(out)))
		return
	}
	if out, err := exec.CommandContext(ctx, "plutil", "-lint", installed).CombinedOutput(); err != nil {
		r.add(check, "FAIL", "the installed plist does not parse: "+strings.TrimSpace(string(out))+": ./homelab schedule install --apply")
		return
	}
	// launchd refuses a plist others may change.
	if info.Mode().Perm()&0o022 != 0 {
		r.add(check, "FAIL", fmt.Sprintf("%s may be changed by others (%v), which launchd refuses: chmod 644 it", installed, info.Mode().Perm()))
		return
	}
	data, _ := os.ReadFile(installed)
	path := ""
	if m := plistPathRe.FindSubmatch(data); m != nil {
		path = string(m[1])
	}
	// The agent adds JobPath's folders to an older plist's (mergePath).
	dirs := filepath.SplitList(mergePath(path, r.h.host.JobPath(home)))
	found := func(name string) string {
		for _, d := range dirs {
			if st, err := os.Stat(filepath.Join(d, name)); err == nil && !st.IsDir() {
				return filepath.Join(d, name)
			}
		}
		return ""
	}
	docker := found("docker")
	if docker == "" {
		r.add(check, "FAIL", "the agent's PATH has no docker: "+strings.Join(dirs, ":"))
		return
	}
	var cfg struct {
		CredsStore string `json:"credsStore"`
	}
	if data, err := os.ReadFile(filepath.Join(home, ".docker", "config.json")); err == nil {
		_ = json.Unmarshal(data, &cfg)
	}
	if cfg.CredsStore != "" && found("docker-credential-"+cfg.CredsStore) == "" {
		r.add(check, "FAIL", "the agent's PATH has no docker-credential-"+cfg.CredsStore+", which every image download asks: ./homelab schedule install --apply")
		return
	}
	out, err := exec.CommandContext(ctx, "launchctl", "print", "gui/"+strconv.Itoa(os.Getuid())+"/"+job.Label).CombinedOutput()
	if err != nil || !strings.Contains(string(out), "state = running") {
		r.add(check, "FAIL", "installed but not running (launchctl print): log out and back in, or ./homelab schedule install --apply")
		return
	}
	r.add(check, "PASS", "the plist parses, only you can change it, it runs, and its PATH finds "+docker)
}

func (r *liveRun) wiring(ctx context.Context) {
	containers, err := r.client.Containers(ctx)
	if err != nil {
		r.add("Connected apps", "FAIL", err.Error())
		return
	}
	report := detect.Analyze(r.h.catalog, containers)
	home, _ := os.UserHomeDir()
	env := r.h.envMap()
	apps := wiring.AppsFrom(r.h.catalog, func(id string) bool { _, ok := runningContainer(report, id); return ok }, env, home)
	hc := &http.Client{Timeout: 10 * time.Second}
	var checked []string
	for _, id := range slices.Sorted(maps.Keys(apps)) {
		a, ok := r.h.catalog.Get(id)
		if !ok || a.Meta.KeyFile == "" || apps[id].URL == "" {
			continue
		}
		check := "Connected app: " + a.Name()
		if _, err := wiring.KeptKey(apps[id].ConfigDir, a.Meta.KeyFile); err != nil {
			r.add(check, "FAIL", "its API key: "+err.Error())
			continue
		}
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, apps[id].URL, nil)
		resp, err := hc.Do(req)
		if err != nil {
			r.add(check, "FAIL", "does not answer at "+apps[id].URL+": "+err.Error())
			continue
		}
		_ = resp.Body.Close()
		if resp.StatusCode >= 500 {
			r.add(check, "FAIL", "answers "+resp.Status+" at "+apps[id].URL)
			continue
		}
		r.add(check, "PASS", "its key is readable and it answers at "+apps[id].URL)
		checked = append(checked, id)
	}
	if len(checked) == 0 && !slices.ContainsFunc(r.results, func(x liveResult) bool { return strings.HasPrefix(x.Check, "Connected app: ") }) {
		r.add("Connected apps", "SKIP", "none of the apps homelab wire connects is running")
	}
}

func (r *liveRun) runway() {
	home, _ := os.UserHomeDir()
	hist := diskspace.LoadHistory(diskspace.HistoryPath(r.h.root))
	for _, v := range diskspace.Check(diskspace.Locations(r.h.root, home, r.h.envMap())) {
		check := "Disk space: " + v.Label()
		switch days, per, ok := diskspace.Runway(hist[v.Names[0]], time.Now()); {
		case v.Low():
			r.add(check, "FAIL", v.Describe()+", under "+diskspace.Size(diskspace.Threshold(v.Total))+": "+diskspace.Advice)
		case ok && days <= diskspace.RunwayNoteDays:
			r.add(check, "FAIL", v.Describe()+"; "+diskspace.RunwayWords(v.Label(), days, per, time.Now()))
		case ok:
			r.add(check, "PASS", fmt.Sprintf("%s; full in about %d days at the rate it fills", v.Describe(), int(days)))
		default:
			r.add(check, "PASS", v.Describe()+"; not filling (or too few days kept yet to tell)")
		}
	}
}

// cleanup removes exactly what this run made, whatever became of it.
func (r *liveRun) cleanup() {
	if r.client == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	for _, c := range r.containers {
		if strings.HasPrefix(c, r.tag) {
			_, _ = r.docker(ctx, "rm", "-f", "-v", c)
		}
	}
	for _, v := range r.volumes {
		if strings.HasPrefix(v, r.tag) {
			_, _ = r.docker(ctx, "volume", "rm", "-f", v)
		}
	}
}
