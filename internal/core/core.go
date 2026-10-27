// Package core is what the desktop app and its menu bar item share: the
// remembered homelab folder, and reading the catalog, containers, and status.
package core

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/awake"
	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/battery"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/crash"
	"github.com/Snooper42/homelab-wizard/internal/crowdsec"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/domain"
	"github.com/Snooper42/homelab-wizard/internal/duplicati"
	"github.com/Snooper42/homelab-wizard/internal/engine"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/host"
	"github.com/Snooper42/homelab-wizard/internal/kit"
	"github.com/Snooper42/homelab-wizard/internal/notify"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
	"github.com/Snooper42/homelab-wizard/internal/releases"
	"github.com/Snooper42/homelab-wizard/internal/schedule"
	"github.com/Snooper42/homelab-wizard/internal/setup"
	"github.com/Snooper42/homelab-wizard/internal/updates"
)

// config is what the app remembers between launches.
type config struct {
	Root string `json:"root"`
}

func configPath() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	return filepath.Join(dir, "Homelab Wizard", "config.json")
}

// Root is the homelab folder: the one chosen in Setup, $HOMELAB_ROOT, then
// ~/Homelab and ~/homelab-setup. "" when none is found.
func Root() string {
	var c config
	if data, err := os.ReadFile(configPath()); err == nil {
		_ = json.Unmarshal(data, &c)
	}
	home, _ := os.UserHomeDir()
	for _, dir := range []string{c.Root, os.Getenv("HOMELAB_ROOT"), filepath.Join(home, "Homelab"), filepath.Join(home, "homelab-setup")} {
		if IsRoot(dir) {
			return dir
		}
	}
	return ""
}

// SaveRoot remembers the homelab folder.
func SaveRoot(dir string) error {
	path := configPath()
	if path == "" {
		return errors.New("no config folder on this machine")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(config{Root: dir}, "", "  ")
	return os.WriteFile(path, data, 0o644)
}

// IsRoot reports whether dir holds a homelab (compose.yaml and .env.example).
func IsRoot(dir string) bool {
	if dir == "" {
		return false
	}
	_, err := os.Stat(filepath.Join(dir, "compose.yaml"))
	_, err2 := os.Stat(filepath.Join(dir, ".env.example"))
	return err == nil && err2 == nil
}

// Catalog loads the homelab's catalog.
func Catalog(root string) (*catalog.Catalog, error) {
	if !IsRoot(root) {
		return nil, errors.New("choose the homelab folder in Setup first")
	}
	return catalog.Load(root)
}

// Env reads the homelab's .env (empty when it does not exist yet).
func Env(root string) map[string]string {
	env, err := envfile.Load(filepath.Join(root, ".env"))
	if err != nil {
		return map[string]string{}
	}
	return env.Map()
}

// Containers lists the containers, with a hint when the runtime is not up.
func Containers(ctx context.Context) (*docker.Client, []docker.Container, error) {
	p := host.Current()
	client, err := NewClient()
	if err != nil {
		return nil, nil, fmt.Errorf("%w: %s", err, p.InstallRuntime)
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return nil, nil, docker.Explained{Msg: p.Unreachable(err), Err: err}
	}
	return client, containers, nil
}

// NewClient is the container runtime's client. Tests replace it, the
// desktop app's too.
var NewClient = docker.New

// What else core reaches on this machine, which tests replace: the system,
// this program, and how an app or folder is opened.
var (
	goos       = runtime.GOOS
	executable = os.Executable
	start      = (*exec.Cmd).Start
)

// SetUpdatesPaused pauses or resumes nightly image updates.
func SetUpdatesPaused(ctx context.Context, root string, paused bool) (updates.State, error) {
	c, err := Catalog(root)
	if err != nil {
		return updates.State{}, err
	}
	client, _, err := Containers(ctx)
	if err != nil {
		return updates.State{}, err
	}
	return updates.SetPaused(ctx, c, client, filepath.Join(root, ".env"), paused)
}

// Setup is the first-time setup checklist for the homelab at root.
func Setup(ctx context.Context, root string) []setup.Step {
	p := host.Current()
	env := Env(root)
	in := setup.Inputs{Env: env, Host: p, Done: setup.LoadDone(root), Since: setup.FirstSeen(root), Probe: setup.NetProbe{}, Backups: setup.DuplicatiJobs(ctx, env), Power: battery.Power,
		Ollama: func() bool { return api.NativeUp(ctx, 11434) }, AwakeRefused: func() bool { return awake.Refused(ctx) }}
	in.ThisMac = domain.FindsByName
	restore := backup.LoadRestoreLog(filepath.Join(root, "scripts", "logs", "restore-test.json"))
	in.Restore = &restore
	in.OnTailnet = func(name string) bool {
		ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
		defer cancel()
		_, err := net.DefaultResolver.LookupHost(ctx, name)
		return err == nil
	}
	if goos == "darwin" {
		in.ThisMac = setup.MacFinds
	}
	if st, err := Status(ctx, root); err == nil {
		in.Status = &st
	} else {
		in.RuntimeErr = err
		// Before the homelab folder exists, the runtime is checked on its own.
		if in.NoFolder = !IsRoot(root); in.NoFolder {
			if _, _, err := Containers(ctx); err == nil {
				in.RuntimeUp, in.RuntimeErr = true, nil
			}
		}
	}
	if l, err := schedule.For(p); err == nil {
		in.Jobs = func() (int, int) {
			n := 0
			for _, j := range schedule.Jobs() {
				if l.Status(j.Label).Loaded {
					n++
				}
			}
			return n, len(schedule.Jobs())
		}
	}
	return setup.Steps(ctx, in)
}

// CLI is how the app runs a homelab command: the repository's launcher,
// which builds the CLI when its sources changed, or, in a folder the app
// made or on a machine without Go, the CLI that ships with the app.
func CLI(root string, args ...string) *exec.Cmd {
	return CLIContext(context.Background(), root, args...)
}

// CLIContext is CLI with a context that stops the command when it ends.
func CLIContext(ctx context.Context, root string, args ...string) *exec.Cmd {
	args = append(args, "--no-color")
	launcher := filepath.Join(root, "homelab")
	if goos == "windows" {
		launcher += ".cmd"
	}
	// A folder the app made runs the CLI the app ships, which matches it;
	// a checkout with Go builds its own, so it matches the checkout.
	_, made := kit.Installed(root)
	_, noLauncher := os.Stat(launcher) // no folder yet: Setup's first steps
	if _, err := exec.LookPath("go"); err != nil || made || noLauncher != nil {
		if bundled := bundledCLI(); bundled != "" {
			launcher, args = bundled, append([]string{"--root", root}, args...)
		}
	}
	c := procattr.Hide(exec.CommandContext(ctx, launcher, args...))
	c.Dir = root
	return c
}

// bundledCLI is the homelab CLI shipped with the app: in the bundle's
// Helpers folder on macOS, next to the app elsewhere. "" when there is none.
func bundledCLI() string {
	exe, err := executable()
	if err != nil {
		return ""
	}
	name := "homelab"
	if goos == "windows" {
		name += ".exe"
	}
	dir := filepath.Dir(exe)
	for _, p := range []string{filepath.Join(dir, "..", "Helpers", name), filepath.Join(dir, name)} {
		if fi, err := os.Stat(p); err == nil && !fi.IsDir() && p != exe {
			return p
		}
	}
	return ""
}

// JobsCLIBehind reports a homelab folder the app made whose scheduled jobs
// run a copy of the CLI that is not the one this app ships: bin/homelab,
// copied there by schedule install when the app's own lives where it goes
// away (inside an AppImage). The app replaced itself with a newer build,
// the copy stayed, and the jobs would run the previous release's CLI until
// schedule install copies it again.
func JobsCLIBehind(root string) bool {
	if _, made := kit.Installed(root); !made {
		return false
	}
	bundled := bundledCLI()
	if bundled == "" {
		return false
	}
	copied := filepath.Join(root, "bin", filepath.Base(bundled))
	a, err := os.Stat(copied)
	if err != nil {
		return false
	}
	b, err := os.Stat(bundled)
	if err != nil {
		return false
	}
	if a.Size() != b.Size() {
		return true
	}
	x, err1 := os.ReadFile(copied)
	y, err2 := os.ReadFile(bundled)
	return err1 == nil && err2 == nil && !bytes.Equal(x, y)
}

// FixPath adds the folders docker, its credential helpers, and Go live in
// to PATH. An app opened from Finder gets only /usr/bin:/bin:/usr/sbin:/sbin,
// where image pulls fail ("docker-credential-osxkeychain not found").
func FixPath() {
	home, _ := os.UserHomeDir()
	extra := host.Current().JobPath(home)
	if goos == "darwin" {
		extra += ":/Applications/Docker.app/Contents/Resources/bin:/usr/local/go/bin"
	}
	if extra == "" {
		return
	}
	have := filepath.SplitList(os.Getenv("PATH"))
	dirs := slices.Clone(have)
	for _, d := range filepath.SplitList(extra) {
		if !slices.Contains(have, d) {
			dirs = append(dirs, d)
		}
	}
	_ = os.Setenv("PATH", strings.Join(dirs, string(os.PathListSeparator)))
}

// Status is the state of every app in the homelab at root.
func Status(ctx context.Context, root string) (api.Status, error) {
	return status(ctx, root, api.StatusOf)
}

// StatusNow is Status without waiting for the apps' pages (Checking says
// some are still to be asked; api.Probe asks them), for a screen to show
// at once. It asks the agent when it runs, so the window, the menu bar
// item, and the phone share one reading of the runtime per change.
func StatusNow(ctx context.Context, root string) (api.Status, error) {
	if c, err := engine.Dial(ctx, root); err == nil {
		return c.StatusNow(ctx)
	}
	return StatusHere(ctx, root)
}

// StatusHere is StatusNow read by this process, for the agent itself.
func StatusHere(ctx context.Context, root string) (api.Status, error) {
	return status(ctx, root, api.StatusRemembered)
}

func status(ctx context.Context, root string, of func(context.Context, *catalog.Catalog, []docker.Container, map[string]string, bool) api.Status) (api.Status, error) {
	c, err := Catalog(root)
	if err != nil {
		return api.Status{}, err
	}
	client, containers, err := Containers(ctx)
	if err != nil {
		return api.Status{}, err
	}
	st := of(ctx, c, containers, Env(root), false)
	st.MarkChanged(api.Changed(ctx, c, client, filepath.Join(root, ".env"), containers))
	st.BatteryPaused = battery.Load(battery.Path(root)).Paused
	return st, nil
}

// Backups is the state of the nightly backups: each installed app's newest
// database dump or volume archive, the .env copy, the destination folder,
// and the last restore test.
func Backups(ctx context.Context, root string) (backup.Overview, error) {
	c, err := Catalog(root)
	if err != nil {
		return backup.Overview{}, err
	}
	// Installed means a container exists, running or stopped. With the
	// runtime down, the baseline is listed.
	installed := func(app *catalog.App) bool { return !app.Optional() }
	if _, containers, err := Containers(ctx); err == nil {
		report := detect.Analyze(c, containers)
		installed = func(app *catalog.App) bool {
			st, _ := report.State(app.ID)
			return st == detect.Running || st == detect.Stopped
		}
	}
	return backup.Read(root, backup.SourcesFor(c, installed), Env(root), time.Now()), nil
}

// DuplicatiJobs is each Duplicati backup job's last run, read with
// DUPLICATI_PASSWORD from Duplicati's API.
func DuplicatiJobs(ctx context.Context, root string) ([]duplicati.Job, error) {
	env := Env(root)
	port := env["DUPLICATI_PORT"]
	if port == "" {
		port = "8200"
	}
	return duplicati.Jobs(ctx, "http://127.0.0.1:"+port, env["DUPLICATI_PASSWORD"], time.Now())
}

// ErrNoCrowdSec means CrowdSec or the proxy is not running, so there is no
// protection to show.
var ErrNoCrowdSec = errors.New("CrowdSec and the proxy are not both running")

// Protection is CrowdSec's view: whether the proxy enforces its bans, and
// what it caught over the last week.
func Protection(ctx context.Context, root string) (crowdsec.Protection, error) {
	c, err := Catalog(root)
	if err != nil {
		return crowdsec.Protection{}, err
	}
	client, containers, err := Containers(ctx)
	if err != nil {
		return crowdsec.Protection{}, err
	}
	report := detect.Analyze(c, containers)
	csState, cs := report.State(crowdsec.App)
	proxyState, _ := report.State(crowdsec.Proxy)
	if csState != detect.Running || proxyState != detect.Running || cs == nil {
		return crowdsec.Protection{}, ErrNoCrowdSec
	}
	run := func(ctx context.Context, args ...string) ([]byte, error) {
		return client.Exec(ctx, cs.Container.Name, args...)
	}
	return crowdsec.Read(ctx, run, time.Now())
}

// ErrNoReadToken means alerts cannot be read yet: notify setup has not made
// the reader's token.
var ErrNoReadToken = errors.New("no NTFY_READ_TOKEN yet: run Setup › Alerts on the phone › Set up the alert token")

// RecentAlerts is what the alert topics carried over the last day (ntfy
// keeps 12 hours of messages), newest first.
func RecentAlerts(ctx context.Context, root string) ([]notify.Event, error) {
	env := Env(root)
	if env["NTFY_READ_TOKEN"] == "" {
		return nil, ErrNoReadToken
	}
	port := env["NTFY_PORT"]
	if port == "" {
		port = "9293"
	}
	c := notify.New("http://127.0.0.1:" + port)
	c.Token = env["NTFY_READ_TOKEN"]
	return c.Recent(ctx, notify.Topics, 24*time.Hour)
}

// OpenFile opens a file in its default app (a page in the browser).
func OpenFile(path string) error {
	var c *exec.Cmd
	switch goos {
	case "darwin":
		c = exec.Command("open", path)
	case "windows":
		c = exec.Command("rundll32", "url.dll,FileProtocolHandler", path)
	default:
		c = exec.Command("xdg-open", path)
	}
	return start(c)
}

// Reveal shows a file in the platform's file manager: selected in Finder or
// Explorer, or its folder elsewhere.
func Reveal(path string) error {
	var c *exec.Cmd
	switch goos {
	case "darwin":
		c = exec.Command("open", "-R", path)
	case "windows":
		c = exec.Command("explorer", "/select,"+path)
	default:
		c = exec.Command("xdg-open", filepath.Dir(path))
	}
	return start(c)
}

// Usage is what each running app takes from the machine right now, busiest
// first: the compose service names the app, so Immich's helpers show as
// themselves rather than as Immich.
func Usage(ctx context.Context) ([]docker.Stat, error) {
	client, containers, err := Containers(ctx)
	if err != nil {
		return nil, err
	}
	stats, err := client.Stats(ctx)
	if err != nil {
		return nil, err
	}
	service := map[string]string{}
	for _, c := range containers {
		if s := c.Service(); s != "" {
			service[c.Name] = s
		}
	}
	for i, s := range stats {
		if id := service[s.Name]; id != "" {
			stats[i].Name = id
		}
	}
	return stats, nil
}

// ReleaseNotes is what updating app id brings: the releases newer than the
// version it runs, from the project its image is built from.
func ReleaseNotes(ctx context.Context, root, id string) (releases.Preview, error) {
	c, err := Catalog(root)
	if err != nil {
		return releases.Preview{}, err
	}
	a, ok := c.Get(id)
	if !ok || a.Native() != nil {
		return releases.Preview{}, fmt.Errorf("unknown container app %q", id)
	}
	_, containers, err := Containers(ctx)
	if err != nil {
		return releases.Preview{}, err
	}
	st, m := detect.Analyze(c, containers).State(id)
	if st != detect.Running || m == nil {
		return releases.Preview{}, fmt.Errorf("%s is not running", a.Name())
	}
	return releases.For(ctx, releases.CachePath(root), id, a.Meta.Releases, m.Container.Image, m.Container.Labels)
}

// crashSeen is the crash log, and the time in it, the person last waved
// away on Status, so the same crash is not shown again.
func crashSeen(root string) string { return filepath.Join(root, "scripts", "logs", "crash-seen") }

// LastCrash is the newest crash of the app, the menu bar item, or the
// background agent in the last two weeks that Status has not shown and
// been told to leave; nil when there is none.
func LastCrash(root string) *crash.Crash {
	c, ok := crash.Newest(filepath.Join(root, "scripts", "logs"))
	if !ok || time.Since(c.When) > 14*24*time.Hour {
		return nil
	}
	if seen, err := os.ReadFile(crashSeen(root)); err == nil && strings.TrimSpace(string(seen)) == c.When.Format(time.RFC3339) {
		return nil
	}
	return &c
}

// CrashSeen remembers that the newest crash was shown and waved away.
func CrashSeen(root string) error {
	c, ok := crash.Newest(filepath.Join(root, "scripts", "logs"))
	if !ok {
		return nil
	}
	return os.WriteFile(crashSeen(root), []byte(c.When.Format(time.RFC3339)+"\n"), 0o644)
}
