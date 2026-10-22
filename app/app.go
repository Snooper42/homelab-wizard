package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	goruntime "runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/crowdsec"
	"github.com/Snooper42/homelab-wizard/internal/custom"
	"github.com/Snooper42/homelab-wizard/internal/diskspace"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/domain"
	"github.com/Snooper42/homelab-wizard/internal/duplicati"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/host"
	"github.com/Snooper42/homelab-wizard/internal/install"
	"github.com/Snooper42/homelab-wizard/internal/kit"
	"github.com/Snooper42/homelab-wizard/internal/notify"
	"github.com/Snooper42/homelab-wizard/internal/people"
	"github.com/Snooper42/homelab-wizard/internal/ports"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
	"github.com/Snooper42/homelab-wizard/internal/savings"
	"github.com/Snooper42/homelab-wizard/internal/schedule"
	"github.com/Snooper42/homelab-wizard/internal/selector"
	"github.com/Snooper42/homelab-wizard/internal/selfupdate"
	"github.com/Snooper42/homelab-wizard/internal/settings"
	"github.com/Snooper42/homelab-wizard/internal/setup"
	"github.com/Snooper42/homelab-wizard/internal/storage"
	"github.com/Snooper42/homelab-wizard/internal/updates"
	"github.com/Snooper42/homelab-wizard/internal/upgrade"
	"github.com/Snooper42/homelab-wizard/internal/wiring"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// version and commit are set at build time with -ldflags
// "-X main.version=... -X main.commit=...". commit is the git commit a
// release was built from, for telling when the homelab folder has a newer
// app; it is empty in a local build. repo ("owner/name") is where its
// builds are published, for updating itself.
var (
	version = "dev"
	commit  = ""
	repo    = ""
)

// App is bound to the frontend: each exported method is callable from
// JavaScript as window.go.main.App.<Method>.
type App struct {
	ctx     context.Context
	root    string
	install sync.Mutex // one install at a time

	upgradeMu   sync.Mutex // the last check against GitHub, kept 10 minutes
	lastUpgrade *upgrade.Check
	lastApp     *selfupdate.Release

	update pending // a newer build found in the background
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.root = core.Root()
	followAppImage()
	startTray()
	go a.watchUpdates()
	go a.moveToAgent()
}

// onSecondInstance brings the window forward when the app is opened again
// (for example from the menu bar) and shows the screen it asked for.
func (a *App) onSecondInstance(data options.SecondInstanceData) {
	runtime.WindowUnminimise(a.ctx)
	runtime.Show(a.ctx)
	if s := screenArg(data.Args); s != "" {
		runtime.EventsEmit(a.ctx, "navigate", s)
	}
}

// Screen is the screen the app was opened with (--screen NAME), or "".
func (a *App) Screen() string { return screenArg(os.Args[1:]) }

func screenArg(args []string) string {
	for i, arg := range args {
		if arg == "--screen" && i+1 < len(args) {
			return args[i+1]
		}
	}
	return ""
}

// HostInfo is what the Setup screen shows.
type HostInfo struct {
	OS           string `json:"os"`
	Machine      string `json:"machine"`
	Runtime      string `json:"runtime"`
	Scheduler    string `json:"scheduler"`
	Supported    bool   `json:"supported"`
	Root         string `json:"root"`
	RootOK       bool   `json:"rootOK"`
	RuntimeOK    bool   `json:"runtimeOK"`
	RuntimeHint  string `json:"runtimeHint,omitempty"`
	RuntimeFound string `json:"runtimeFound,omitempty"` // e.g. "OrbStack, engine 27.0.0"
	Version      string `json:"version"`
	Disks        []Disk `json:"disks,omitempty"`
	// Backdrop: Windows draws Mica behind the window (style.css).
	Backdrop bool `json:"backdrop,omitempty"`
	// Kit: this build carries the homelab files, so Setup can make the
	// folder itself (at NewRoot) when there is none.
	Kit     bool   `json:"kit,omitempty"`
	NewRoot string `json:"newRoot,omitempty"`
	// The runtime's app and download page, for the card that walks
	// through installing and starting it.
	RuntimeInstalled bool   `json:"runtimeInstalled"`
	RuntimeDownload  string `json:"runtimeDownload,omitempty"`
}

// Disk is one disk the homelab writes to and its free space.
type Disk struct {
	Label string `json:"label"` // its folders: "homelab folder, BACKUP_DESTINATION"
	Space string `json:"space"` // "412 GB free of 994 GB (41%)"
	Low   bool   `json:"low"`
	Hint  string `json:"hint,omitempty"`
	// Name is the drive's ("Hobbies"), "" for the internal disk; Free and
	// Total are in bytes, for the storage bar.
	Name  string `json:"name,omitempty"`
	Free  uint64 `json:"free"`
	Total uint64 `json:"total"`
}

// disks reads the disks under the homelab folder and its folder settings.
func disks(root string) []Disk {
	home, _ := os.UserHomeDir()
	var out []Disk
	for _, v := range diskspace.Check(diskspace.Locations(root, home, core.Env(root))) {
		d := Disk{Label: v.Label(), Space: v.Describe(), Low: v.Low(), Free: v.Free, Total: v.Total}
		if drive := diskspace.ExternalDrive(v.Path); drive != "" {
			d.Name = filepath.Base(drive)
			if len(drive) == 3 && drive[1] == ':' {
				d.Name = "Drive " + drive[:2] // a Windows drive letter
			}
		}
		if d.Low {
			d.Hint = "Under " + diskspace.Size(diskspace.Threshold(v.Total)) + ": " + diskspace.Advice
		}
		out = append(out, d)
	}
	return out
}

// OpenNativeApp opens a native app installed as a Mac app (Jellyfin), by
// its name or its name with "Server".
func (a *App) OpenNativeApp(id string) error {
	if goruntime.GOOS != "darwin" {
		return errors.New("open it from your system's app menu")
	}
	c, err := a.catalog()
	if err != nil {
		return err
	}
	app, ok := c.Get(id)
	if !ok || app.Native() == nil {
		return fmt.Errorf("%q is not a native app", id)
	}
	for _, name := range []string{app.Name(), app.Name() + " Server"} {
		if exec.Command("open", "-g", "-a", name).Run() == nil {
			return nil
		}
	}
	return fmt.Errorf("%s is not installed: %s", app.Name(), app.Native().Install)
}

// BackgroundJob is one thing the homelab runs in the background, in plain
// words, for Setup's "Runs in the background" list.
type BackgroundJob struct {
	Name      string `json:"name"`
	What      string `json:"what"`
	When      string `json:"when"`
	Label     string `json:"label"` // as Login Items and launchctl name it
	Installed bool   `json:"installed"`
}

// agentParts are what the homelab's one background job (homelab agent)
// does, in plain words, for Setup's "Runs in the background" list.
var agentParts = []BackgroundJob{
	{Name: "Start the apps after a restart", What: "Waits for the container runtime and your drives, then starts the apps.", When: "at login"},
	{Name: "Nightly backup", What: "Copies the databases and settings for the encrypted off-site backup.", When: "daily at 03:30"},
	{Name: "Watchdog", What: "Checks every app, backup, and disk, alerts you when one fails, and runs the battery saver.", When: "every 15 minutes"},
	{Name: "Keep awake while plugged in", What: "Stops this computer sleeping on power, so the apps stay reachable. Never on battery.", When: "always"},
	{Name: "Phone companion", What: "Lets your paired phones see Status and Backups, on the home network and tailnet only.", When: "always"},
}

// Background lists what the homelab runs in the background: the parts of
// its one background job, and the menu bar item when it starts at login.
func (a *App) Background() []BackgroundJob {
	out := []BackgroundJob{}
	installed := false
	if l, err := schedule.For(host.Current()); err == nil {
		for _, j := range schedule.Jobs() {
			installed = installed || l.Status(j.Label).Installed
		}
	}
	for _, p := range agentParts {
		p.Label, p.Installed = "com.homelab.agent", installed
		out = append(out, p)
	}
	tray := "Menu bar icon"
	if goruntime.GOOS != "darwin" {
		tray = "Tray icon"
	}
	out = append(out, BackgroundJob{Name: tray, What: "Shows how the homelab is doing and opens this app.", When: "at login", Label: autostartID, Installed: trayAtLogin()})
	return out
}

// moveToAgent replaces the five jobs older versions installed with the one
// agent, and lets it start the menu bar item: the system's login items then
// list one homelab entry instead of six. Run once at startup, in the
// background; nothing happens when the old jobs are not there.
func (a *App) moveToAgent() {
	l, err := schedule.For(host.Current())
	if err != nil || !core.IsRoot(a.root) {
		return
	}
	old := false
	for _, label := range schedule.Legacy {
		old = old || l.Status(label).Installed
	}
	// Also when the agent still runs the CLI from outside its own bundle,
	// so Login Items names it Homelab Wizard, with the app's icon.
	if old || agentOutsideBundle() {
		_ = core.CLI(a.root, "schedule", "install", "--apply").Run()
	}
	foldTrayIntoAgent()
}

// Host describes this machine, the homelab folder, and the runtime.
func (a *App) Host() HostInfo {
	p := host.Current()
	info := HostInfo{OS: p.Name, Machine: p.Machine, Runtime: p.Runtime, Scheduler: p.Scheduler, Supported: p.Supported, Root: a.root, RootOK: core.IsRoot(a.root), Version: version, Backdrop: micaSupported()}
	if info.RootOK {
		info.Disks = disks(a.root)
	} else if kit.Bundled() != "" {
		home, _ := os.UserHomeDir()
		info.Kit, info.NewRoot = true, filepath.Join(home, "Homelab")
	}
	info.RuntimeDownload, info.RuntimeInstalled = p.RuntimeDownload, runtimeInstalled(p)
	client, err := docker.New()
	if err != nil {
		info.RuntimeHint = p.InstallRuntime
		return info
	}
	ctx, cancel := a.timed()
	defer cancel()
	if di, err := client.Info(ctx); err != nil {
		info.RuntimeHint = p.StartRuntime
	} else {
		info.RuntimeOK = true
		info.RuntimeFound = fmt.Sprintf("%s, engine %s", di.Runtime(), di.ServerVersion)
	}
	return info
}

// ChooseRoot asks for the homelab folder and remembers it.
func (a *App) ChooseRoot() (HostInfo, error) {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{Title: "Choose the homelab folder (the one with compose.yaml)", DefaultDirectory: a.root})
	if err != nil || dir == "" {
		return a.Host(), err
	}
	if !core.IsRoot(dir) {
		return a.Host(), fmt.Errorf("%s has no compose.yaml and .env.example", dir)
	}
	a.root = dir
	return a.Host(), core.SaveRoot(dir)
}

// runtimeInstalled reports whether the container runtime's app (or, on
// Linux, docker itself) is on this machine.
func runtimeInstalled(p host.Profile) bool {
	switch p.OS {
	case "darwin":
		home, _ := os.UserHomeDir()
		for _, dir := range []string{"/Applications", filepath.Join(home, "Applications")} {
			if _, err := os.Stat(filepath.Join(dir, p.RuntimeApp+".app")); err == nil {
				return true
			}
		}
		_, err := exec.LookPath("docker")
		return err == nil
	case "windows":
		_, err := os.Stat(p.RuntimeApp)
		return err == nil
	}
	_, err := exec.LookPath("docker")
	return err == nil
}

// StartRuntime opens the container runtime's app (OrbStack, Docker
// Desktop). On Linux the engine is a system service, started with sudo.
func (a *App) StartRuntime() error {
	p := host.Current()
	switch p.OS {
	case "darwin":
		return exec.Command("open", "-a", p.RuntimeApp).Run()
	case "windows":
		return procattr.Hide(exec.Command(p.RuntimeApp)).Start()
	}
	return fmt.Errorf("start it in Terminal: %s", p.StartRuntime)
}

// CreateHomelab makes the homelab folder (~/Homelab) from the files this
// build carries and remembers it: the first run on a machine without git.
// An existing homelab there is chosen as it is.
func (a *App) CreateHomelab() (HostInfo, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return a.Host(), err
	}
	dest := filepath.Join(home, "Homelab")
	if !core.IsRoot(dest) {
		archive := kit.Bundled()
		if archive == "" {
			return a.Host(), errors.New("this build does not carry the homelab files; use Choose homelab folder")
		}
		if _, err := kit.Extract(archive, dest); err != nil {
			return a.Host(), err
		}
	}
	a.root = dest
	return a.Host(), core.SaveRoot(dest)
}

// ChooseFolder opens the system folder picker for a folder setting
// (BACKUP_DESTINATION, MEDIA_ROOT, ...), starting at its current value,
// and returns the chosen path ("" when cancelled). Saving stays with the
// Settings screen.
func (a *App) ChooseFolder(key string) (string, error) {
	start := core.Env(a.root)[key]
	if strings.HasPrefix(start, "~/") {
		if home, err := os.UserHomeDir(); err == nil {
			start = filepath.Join(home, start[2:])
		}
	} else if start != "" && !filepath.IsAbs(start) {
		start = filepath.Join(a.root, start)
	}
	if st, err := os.Stat(start); err != nil || !st.IsDir() {
		start = ""
	}
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{Title: "Choose the folder for " + key, DefaultDirectory: start, CanCreateDirectories: true})
}

// Catalog lists categories, apps, and presets.
func (a *App) Catalog() (api.Catalog, error) {
	c, err := a.catalog()
	if err != nil {
		return api.Catalog{}, err
	}
	return api.CatalogOf(c), nil
}

// Plan previews installing the selection (app IDs or preset tokens) with
// the settings entered in the form. Nothing changes.
func (a *App) Plan(tokens []string, settings map[string]string) (api.Plan, error) {
	_, _, p, err := a.plan(tokens, settings)
	if err != nil {
		return api.Plan{}, err
	}
	return api.PlanOf(p), nil
}

// Install applies the plan, sending "progress" events (install.Event) as
// each step begins and ends.
func (a *App) Install(tokens []string, settings map[string]string) ([]api.Started, error) {
	if !a.install.TryLock() {
		return nil, errors.New("an install is already running")
	}
	defer a.install.Unlock()
	c, client, p, err := a.plan(tokens, settings)
	if err != nil {
		return nil, err
	}
	if !p.Ready() {
		return nil, errors.New("the plan has problems; fix them first")
	}
	if len(p.Start) == 0 {
		return []api.Started{}, p.Env.Save()
	}
	progress := func(ev install.Event) { runtime.EventsEmit(a.ctx, "progress", ev) }
	// Compose's own output (image pulls, container starts) goes to the
	// screen too; from Finder the app has no terminal to show it.
	w := &lineWriter{emit: func(line string) { runtime.EventsEmit(a.ctx, "install:log", line) }}
	client.Runner = docker.ExecRunner{Stdout: w, Stderr: w}
	err = install.ApplyWithProgress(a.ctx, p, client, c, filepath.Join(a.root, ".env"), progress)
	w.Flush()
	if err != nil {
		if tail := w.Tail(); tail != "" {
			return nil, fmt.Errorf("%w\n%s", err, tail)
		}
		return nil, err
	}
	// Their https addresses, as Set up the domain would (once it has run).
	var ids []string
	for _, app := range p.Start {
		ids = append(ids, app.ID)
	}
	runtime.EventsEmit(a.ctx, "install:log", "$ homelab domain setup --auto")
	if err := a.stream(core.CLI(a.root, "domain", "setup", "--auto", "--apps", strings.Join(ids, ",")), "install:log"); err != nil {
		runtime.EventsEmit(a.ctx, "install:log", "could not give the new apps their addresses: "+err.Error()+" (Setup › Set up the domain tries again)")
	}
	return api.StartedOf(p), nil
}

// Status is the state of every app.
func (a *App) Status() (api.Status, error) {
	ctx, cancel := a.timed()
	defer cancel()
	return core.Status(ctx, a.root)
}

// SetUpdatesPaused pauses or resumes nightly image updates.
func (a *App) SetUpdatesPaused(paused bool) (updates.State, error) {
	return core.SetUpdatesPaused(a.ctx, a.root, paused)
}

// Settings lists the .env settings; secrets only say whether they are set.
func (a *App) Settings() ([]settings.Setting, error) {
	if !core.IsRoot(a.root) {
		return nil, errors.New("choose the homelab folder in Setup first")
	}
	return settings.List(a.root)
}

// CopySetting puts a saved password or token on the clipboard, for keeping
// it in the password manager, without it ever reaching the page. The
// clipboard is cleared after copyClearAfter unless something else was
// copied since.
func (a *App) CopySetting(key string) error {
	list, err := a.Settings()
	if err != nil {
		return err
	}
	for _, s := range list {
		if s.Key != key {
			continue
		}
		v := core.Env(a.root)[key]
		if !s.Secret || v == "" {
			return fmt.Errorf("%s is not a saved secret", key)
		}
		if err := runtime.ClipboardSetText(a.ctx, v); err != nil {
			return err
		}
		go func() {
			time.Sleep(copyClearAfter)
			if now, err := runtime.ClipboardGetText(a.ctx); err == nil && now == v {
				_ = runtime.ClipboardSetText(a.ctx, "")
			}
		}()
		return nil
	}
	return fmt.Errorf("unknown setting %q", key)
}

// copyClearAfter is how long a copied secret stays on the clipboard.
const copyClearAfter = 90 * time.Second

// SaveSettings writes the changed settings into .env.
func (a *App) SaveSettings(values map[string]string) ([]settings.Setting, error) {
	if err := settings.Save(a.root, values); err != nil {
		return nil, err
	}
	return settings.List(a.root)
}

// Backups is the state of the nightly backups: each installed app's newest
// database dump or volume archive, the .env copy, the destination folder,
// and the last restore test.
func (a *App) Backups() (backup.Overview, error) {
	ctx, cancel := a.timed()
	defer cancel()
	return core.Backups(ctx, a.root)
}

// Alerts is what the alert topics carried recently, newest first. Without
// the reader's token it says how to make one.
func (a *App) Alerts() ([]notify.Event, error) {
	ctx, cancel := a.timed()
	defer cancel()
	return core.RecentAlerts(ctx, a.root)
}

// Watchdog is the watchdog's last run (every 15 minutes once the jobs are
// installed): how many checks ran, and those failing with what they said.
func (a *App) Watchdog() health.Summary {
	return health.LoadState(health.StatePath(a.root)).Summary()
}

// Protection is CrowdSec's view: whether the proxy enforces its bans, and
// the attacks it caught this week. It fails with "not both running" until
// CrowdSec and the proxy run.
func (a *App) Protection() (crowdsec.Protection, error) {
	ctx, cancel := a.timed()
	defer cancel()
	return core.Protection(ctx, a.root)
}

// RevealReport shows the newest diagnostics report (scripts/logs/report-*)
// in Finder, Explorer, or the file manager, so it can be shared.
func (a *App) RevealReport() error {
	files, _ := filepath.Glob(filepath.Join(a.root, "scripts", "logs", "report-*.txt"))
	if len(files) == 0 {
		return errors.New("no diagnostics report yet")
	}
	newest := files[0]
	for _, f := range files[1:] {
		if fi, err := os.Stat(f); err == nil {
			if cur, err := os.Stat(newest); err == nil && fi.ModTime().After(cur.ModTime()) {
				newest = f
			}
		}
	}
	return core.Reveal(newest)
}

// EmailReport starts an email to the helper in HELPER_EMAIL about the
// newest diagnostics report, and shows the file to attach (a mail link
// cannot carry an attachment).
func (a *App) EmailReport() error {
	to := strings.TrimSpace(core.Env(a.root)["HELPER_EMAIL"])
	if to == "" {
		return errors.New("put your helper's address in Settings › HELPER_EMAIL first")
	}
	body := "Hi, my homelab needs a look. The diagnostics report is attached (Homelab Wizard removed every password and token from it).\n\nWhat I was doing:\n"
	link := "mailto:" + url.PathEscape(to) + "?subject=" + url.QueryEscape("Homelab report") + "&body=" + url.QueryEscape(body)
	runtime.BrowserOpenURL(a.ctx, strings.ReplaceAll(link, "+", "%20"))
	return a.RevealReport()
}

// DuplicatiJobs is each Duplicati backup job's last run, read with
// DUPLICATI_PASSWORD from Duplicati's API.
func (a *App) DuplicatiJobs() ([]duplicati.Job, error) {
	ctx, cancel := a.timed()
	defer cancel()
	return core.DuplicatiJobs(ctx, a.root)
}

// UpgradeInfo is the homelab folder against GitHub, and this app against
// the folder.
type UpgradeInfo struct {
	upgrade.Check
	AppCommit string `json:"appCommit,omitempty"` // what this build was made from
	AppBehind int    `json:"appBehind"`           // later commits in the folder that changed the app
	// SelfUpdates: this app replaces itself with a newer build once one
	// is published, so it never asks for a download by hand.
	SelfUpdates bool `json:"selfUpdates,omitempty"`
	// Previous is the version before the last upgrade, to go back to.
	Previous *upgrade.Point `json:"previous,omitempty"`
	// AppUpdate is a newer build of this app on GitHub, nil when there is none.
	AppUpdate *AppUpdate `json:"appUpdate,omitempty"`
}

// AppUpdate is the newest published build of the app.
type AppUpdate struct {
	Commit     string `json:"commit"`
	Version    string `json:"version,omitempty"` // the release on the stable channel
	Page       string `json:"page"`
	CanInstall bool   `json:"canInstall"` // Update replaces this app and opens it again
}

// UpgradeCheck compares the homelab folder with GitHub (the changes
// waiting, whether the app or the settings changed, and local edits) and
// this app with the folder. It fetches at most every 10 minutes unless
// force is set.
func (a *App) UpgradeCheck(force bool) (UpgradeInfo, error) {
	a.upgradeMu.Lock()
	defer a.upgradeMu.Unlock()
	if force || a.lastUpgrade == nil || time.Since(a.lastUpgrade.Checked) >= 10*time.Minute {
		ctx, cancel := context.WithTimeout(a.ctx, 2*time.Minute)
		defer cancel()
		c, err := upgrade.Inspect(ctx, a.root, true)
		if err != nil {
			return UpgradeInfo{Check: c}, err
		}
		a.lastUpgrade = &c
		a.lastApp = nil
		if r, err := selfupdate.For(ctx, a.appRepo(), c.Channel); err == nil {
			a.lastApp = &r
		}
	}
	info := UpgradeInfo{Check: *a.lastUpgrade, AppCommit: commit}
	if p, ok := upgrade.LoadPoint(a.root); ok {
		info.Previous = &p
	}
	// An installed app that replaces itself waits for the newer build to be
	// published and offers it then; only a copy that cannot (a local build)
	// is told to fetch one by hand.
	info.SelfUpdates = selfupdate.Current().Kind != "" && a.appRepo() != ""
	if !info.SelfUpdates {
		info.AppBehind, _ = upgrade.AppBehind(a.ctx, a.root, commit)
	}
	if r := a.lastApp; r != nil && r.Newer(commit) {
		info.AppUpdate = &AppUpdate{Commit: r.Commit, Version: r.Version, Page: r.Page, CanInstall: selfupdate.CanInstall(*r)}
	}
	return info, nil
}

// appRepo is where this app's builds are published: the repository it was
// built in, else the homelab folder's.
func (a *App) appRepo() string {
	if repo != "" {
		return repo
	}
	if a.lastUpgrade != nil {
		return selfupdate.Repo(a.lastUpgrade.Web)
	}
	return ""
}

// InstallAppUpdate downloads the newest build of the app, puts it in place
// of this one, and quits; the new one opens by itself a moment later.
func (a *App) InstallAppUpdate() error {
	a.upgradeMu.Lock()
	repo := a.appRepo()
	a.upgradeMu.Unlock()
	channel := upgrade.Channel(a.root)
	ctx, cancel := context.WithTimeout(a.ctx, 15*time.Minute)
	defer cancel()
	r, err := selfupdate.For(ctx, repo, channel)
	if err != nil {
		return err
	}
	p := &a.update
	p.mu.Lock()
	staged := ""
	if p.stagedAt == r.Commit {
		staged = p.staged
	}
	p.mu.Unlock()
	if staged != "" {
		err = selfupdate.Swap(staged, true)
	} else {
		err = selfupdate.Install(ctx, r)
	}
	if err != nil {
		return err
	}
	p.mu.Lock()
	p.swapping = true
	p.mu.Unlock()
	go func() {
		time.Sleep(300 * time.Millisecond)
		runtime.Quit(a.ctx)
	}()
	return nil
}

// SavingsHistory is the yearly saving the nightly backup recorded each day,
// oldest first.
// Storage is what each person's photos take in Immich, as the nightly
// backup last read it.
func (a *App) Storage() storage.Record { return storage.Load(storage.Path(a.root)) }

// Usage is each running app's CPU and memory right now, busiest first, for
// Status's "What's using power".
func (a *App) Usage() ([]docker.Stat, error) {
	ctx, cancel := a.timed()
	defer cancel()
	return core.Usage(ctx)
}

func (a *App) SavingsHistory() []savings.Point {
	return savings.LoadHistory(savings.HistoryPath(a.root))
}

// People lists the household (homelab person list), removed people too.
func (a *App) People() ([]people.Person, error) {
	list, err := people.Load(people.Path(a.root))
	if list == nil {
		list = []people.Person{}
	}
	return list, err
}

// PersonAction adds someone (action "add", with email and the apps they
// use; none means every household app), makes a new welcome page and
// sign-in link ("welcome"), or turns their sign-in off ("remove"), as
// homelab person does, sending its output as "cli:log" events.
func (a *App) PersonAction(action, name, email string, apps []string) error {
	args := []string{"person", action, name}
	switch action {
	case "add":
		if email != "" {
			args = append(args, "--email", email)
		}
		if len(apps) > 0 {
			args = append(args, "--apps", strings.Join(apps, ","))
		}
	case "welcome", "remove":
	default:
		return fmt.Errorf("unknown action %q", action)
	}
	if action != "welcome" {
		args = append(args, "--apply")
	}
	if !a.install.TryLock() {
		return errors.New("another install or setup step is running")
	}
	defer a.install.Unlock()
	runtime.EventsEmit(a.ctx, "cli:log", "$ homelab "+strings.Join(args, " "))
	return a.stream(core.CLI(a.root, args...), "cli:log")
}

// OpenWelcome opens a person's welcome page in the browser, to print or send.
func (a *App) OpenWelcome(username string) error {
	path := people.WelcomePath(a.root, username)
	if filepath.Base(path) != username+".html" {
		return fmt.Errorf("unknown person %q", username)
	}
	if _, err := os.Stat(path); err != nil {
		return errors.New("no welcome page yet: make a new one")
	}
	return core.OpenFile(path)
}

// QR is an app's address as a QR code (an SVG data: URL), for opening it
// on a phone with its camera.
func (a *App) QR(address string) (string, error) {
	if !strings.HasPrefix(address, "https://") && !strings.HasPrefix(address, "http://") {
		return "", fmt.Errorf("%q is not a web address", address)
	}
	return companion.QRDataURL(address)
}

// Phones lists the phones paired with the phone companion.
func (a *App) Phones() []companion.Phone {
	return companion.NewStore(companion.StorePath(a.root)).Phones()
}

// PhonePairing is a one-time code for a phone, the links that carry it,
// and the first link as a QR code (an image's data: URL).
type PhonePairing struct {
	Code  string   `json:"code"`
	Links []string `json:"links"`
	QR    string   `json:"qr"`
	// Off: PHONE_COMPANION=false, so nothing answers the links.
	Off bool `json:"off"`
}

// PairPhone makes a one-time code (it works once, for 10 minutes) for a
// phone named name, allowed to make changes or only to look.
func (a *App) PairPhone(name string, canChange bool) (PhonePairing, error) {
	if !core.IsRoot(a.root) {
		return PhonePairing{}, errors.New("choose the homelab folder in Setup first")
	}
	code, err := companion.NewStore(companion.StorePath(a.root)).NewPairing(name, canChange)
	if err != nil {
		return PhonePairing{}, err
	}
	env := core.Env(a.root)
	lan, _ := domain.LANAddress()
	p := PhonePairing{Code: code, Links: companion.Links(env, lan, code), Off: strings.EqualFold(env["PHONE_COMPANION"], "false")}
	if len(p.Links) > 0 {
		p.QR, err = companion.QRDataURL(p.Links[0])
	}
	return p, err
}

// SetPhoneCanChange lets a phone start, stop, restart, and back up, or
// makes it read-only again.
func (a *App) SetPhoneCanChange(id string, on bool) ([]companion.Phone, error) {
	store := companion.NewStore(companion.StorePath(a.root))
	_, err := store.SetCanChange(id, on)
	return store.Phones(), err
}

// RemovePhone unpairs a phone: its token stops working at once.
func (a *App) RemovePhone(id string) ([]companion.Phone, error) {
	store := companion.NewStore(companion.StorePath(a.root))
	_, err := store.Remove(id)
	return store.Phones(), err
}

// SettingTests lists the settings that have a Test button.
func (a *App) SettingTests() []string { return setup.TestableKeys() }

// TestSetting checks a setting's saved value against the service it is for
// (a login, a token, a URL, or a folder).
func (a *App) TestSetting(key string) setup.Result {
	return setup.Tester{Env: core.Env(a.root), Root: a.root}.Test(a.ctx, key)
}

// Setup is the first-time setup checklist, checked live.
func (a *App) Setup() []setup.Step { return core.Setup(a.ctx, a.root) }

// MarkSetupDone records a manual step as done (or not).
func (a *App) MarkSetupDone(id string, done bool) ([]setup.Step, error) {
	if err := setup.MarkDone(a.root, id, done); err != nil {
		return nil, err
	}
	return a.Setup(), nil
}

// RunSetup runs a step's homelab commands, sending each output line as a
// "setup:log" event, then returns the checklist checked again.
func (a *App) RunSetup(id string) ([]setup.Step, error) {
	if !a.install.TryLock() {
		return nil, errors.New("another install or setup step is running")
	}
	defer a.install.Unlock()
	var step *setup.Step
	steps := a.Setup()
	for i := range steps {
		if steps[i].ID == id {
			step = &steps[i]
		}
	}
	if step == nil || len(step.Run) == 0 {
		return steps, fmt.Errorf("the %s step has nothing to run", id)
	}
	return a.runSteps(step.Run)
}

// RunSetupChoice runs one of a step's alternatives (where the backups go).
func (a *App) RunSetupChoice(id string, choice int) ([]setup.Step, error) {
	if !a.install.TryLock() {
		return nil, errors.New("another install or setup step is running")
	}
	defer a.install.Unlock()
	steps := a.Setup()
	for _, s := range steps {
		if s.ID == id && choice >= 0 && choice < len(s.Choices) {
			return a.runSteps(s.Choices[choice].Run)
		}
	}
	return steps, fmt.Errorf("the %s step has no choice %d", id, choice)
}

// runSteps runs homelab commands one after another into the setup log.
func (a *App) runSteps(run [][]string) ([]setup.Step, error) {
	for _, args := range run {
		runtime.EventsEmit(a.ctx, "setup:log", "$ homelab "+strings.Join(args, " "))
		if err := a.stream(core.CLI(a.root, args...), "setup:log"); err != nil {
			return a.Setup(), fmt.Errorf("homelab %s: %w", strings.Join(args, " "), err)
		}
	}
	return a.Setup(), nil
}

// Homelab runs one of the commands the Status, Setup, and Backups screens
// offer, sending its output as "cli:log" events. Without apply it only
// shows the plan: moving an app in (adopt), removing old containers
// (cleanup, with their volumes when target is "volumes"). Closing
// Vaultwarden sign-ups, writing a diagnostics report, backing up now, a
// restore test, and getting the newest homelab files run straight away.
func (a *App) Homelab(action, target string, apply bool) error {
	var args []string
	lock := false
	switch action {
	case "adopt":
		c, err := a.catalog()
		if err != nil {
			return err
		}
		if _, ok := c.Get(target); !ok {
			return fmt.Errorf("unknown app %q", target)
		}
		args = []string{"adopt", target}
	case "cleanup":
		args = []string{"cleanup"}
		if target == "volumes" {
			args = append(args, "--volumes")
		}
	case "signups-close":
		// Closing never waits: an open sign-up window holds the install lock.
		args, apply = []string{"signups", "close"}, false
	case "jobs-remove":
		// Turn the scheduled jobs off (Setup › Runs in the background);
		// Setup's own step installs them again.
		args = []string{"schedule", "remove"}
	case "report":
		// A diagnostics file with every secret removed, to share for help.
		args, apply = []string{"report"}, false
	case "backup":
		// Back up now: dumps, archives, and the .env copy, as the nightly job.
		args, apply = []string{"backup"}, true
	case "duplicati-setup":
		// Create the Duplicati backup jobs (Backups › Off-site jobs).
		args, apply = []string{"duplicati", "setup"}, true
	case "upgrade-back":
		// Back to the version before the last upgrade, then up.
		args, apply = []string{"upgrade", "--back"}, true
		defer func() {
			a.upgradeMu.Lock()
			a.lastUpgrade = nil
			a.upgradeMu.Unlock()
		}()
	case "upgrade":
		// Get the newest homelab files (fast-forward only), then up.
		args, apply = []string{"upgrade"}, true
		defer func() {
			a.upgradeMu.Lock()
			a.lastUpgrade = nil
			a.upgradeMu.Unlock()
		}()
	case "fix":
		// Repair what usually goes wrong (homelab fix): the plan first,
		// then, on apply, one at a time with installs and backups.
		args, lock = []string{"fix"}, apply
	case "update-all":
		// Update every app the nightly update would, now (homelab update
		// --all): the list first, then, on apply, one at a time with installs.
		args, lock = []string{"update", "--all"}, apply
	case "restore-test":
		// Duplicati restores a sample of files, which are checked against the
		// live ones. One at a time with a backup or an install.
		args, apply, lock = []string{"restore-test", "--auto"}, false, true
	default:
		return fmt.Errorf("unknown action %q", action)
	}
	if apply || lock {
		if !a.install.TryLock() {
			return errors.New("another install or setup step is running")
		}
		defer a.install.Unlock()
	}
	if apply {
		args = append(args, "--apply")
	}
	runtime.EventsEmit(a.ctx, "cli:log", "$ homelab "+strings.Join(args, " "))
	return a.stream(core.CLI(a.root, args...), "cli:log")
}

// Move moves the homelab to another machine, as homelab move does: "out"
// asks where to save the move file and packs it (a backup first, then
// every app stopped); "in" asks for the file and unpacks it here. It
// returns "" when the dialog was cancelled, else the file.
func (a *App) Move(direction string) (string, error) {
	home, _ := os.UserHomeDir()
	var file string
	var err error
	switch direction {
	case "out":
		file, err = runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{Title: "Save the move file (outside the homelab folder)", DefaultDirectory: home,
			DefaultFilename: "homelab-move-" + time.Now().Format("2006-01-02") + ".tar", CanCreateDirectories: true})
	case "in":
		file, err = runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{Title: "Choose the move file from the old machine", DefaultDirectory: home,
			Filters: []runtime.FileFilter{{DisplayName: "Homelab move file (*.tar)", Pattern: "*.tar"}}})
	default:
		return "", fmt.Errorf("unknown direction %q", direction)
	}
	if err != nil || file == "" {
		return "", err
	}
	args := []string{"move", direction, file, "--apply"}
	if direction == "out" {
		args = []string{"move", "out", "--to", file, "--apply"}
	}
	if !a.install.TryLock() {
		return "", errors.New("another install or setup step is running")
	}
	defer a.install.Unlock()
	runtime.EventsEmit(a.ctx, "cli:log", "$ homelab "+strings.Join(args, " "))
	return file, a.stream(core.CLI(a.root, args...), "cli:log")
}

// Weekly is the week's summary (homelab digest): what was updated, backed
// up, and caught, in the words the Sunday alert uses.
type Weekly struct {
	Title    string `json:"title"`
	Body     string `json:"body"`
	Problems int    `json:"problems"`
}

// Weekly reads this week's summary.
func (a *App) Weekly() (Weekly, error) {
	var w Weekly
	ctx, cancel := context.WithTimeout(a.ctx, time.Minute)
	defer cancel()
	out, err := core.CLIContext(ctx, a.root, "--json", "digest").Output()
	if err != nil {
		return w, fmt.Errorf("the weekly summary: %w", err)
	}
	for _, line := range strings.Split(string(out), "\n") {
		var l struct {
			Type string `json:"type"`
			Data Weekly `json:"data"`
		}
		if json.Unmarshal([]byte(line), &l) == nil && l.Type == "digest" {
			return l.Data, nil
		}
	}
	return w, errors.New("the weekly summary was empty")
}

// RecoveryKit writes the printable recovery kit (homelab recovery-kit)
// and opens it in the browser to print.
func (a *App) RecoveryKit() error {
	if err := a.stream(core.CLI(a.root, "recovery-kit"), "cli:log"); err != nil {
		return err
	}
	return core.OpenFile(filepath.Join(a.root, "recovery-kit.html"))
}

// AppAction starts, stops, restarts, updates, or rolls back one app
// (homelab start|stop|restart|update|rollback), sending its output as
// "cli:log" events.
func (a *App) AppAction(id, action string) error {
	args := []string{action, id}
	switch action {
	case "start", "stop", "restart", "update":
	case "rollback":
		args = append(args, "--apply")
	default:
		return fmt.Errorf("unknown action %q", action)
	}
	if err := a.container(id); err != nil {
		return err
	}
	if !a.install.TryLock() {
		return errors.New("another install or setup step is running")
	}
	defer a.install.Unlock()
	runtime.EventsEmit(a.ctx, "cli:log", "$ homelab "+strings.Join(args, " "))
	return a.stream(core.CLI(a.root, args...), "cli:log")
}

// Logs is the end of an app's log: its last lines (200 when lines is 0).
func (a *App) Logs(id string, lines int) (string, error) {
	if err := a.container(id); err != nil {
		return "", err
	}
	if lines <= 0 || lines > 5000 {
		lines = 200
	}
	ctx, cancel := a.timed()
	defer cancel()
	out, err := core.CLIContext(ctx, a.root, "logs", id, "--tail", strconv.Itoa(lines)).CombinedOutput()
	if err != nil {
		if tail := strings.TrimSpace(string(out)); tail != "" {
			return "", fmt.Errorf("%w\n%s", err, tail)
		}
		return "", err
	}
	return string(out), nil
}

// container checks that id is an app the homelab runs in a container.
func (a *App) container(id string) error {
	c, err := a.catalog()
	if err != nil {
		return err
	}
	app, ok := c.Get(id)
	if !ok {
		return fmt.Errorf("unknown app %q", id)
	}
	if app.Native() != nil {
		return fmt.Errorf("%s runs natively; manage it in its own app", app.Name())
	}
	return nil
}

// stream runs c, sending its output line by line as events named event.
func (a *App) stream(c *exec.Cmd, event string) error {
	w := &lineWriter{emit: func(line string) { runtime.EventsEmit(a.ctx, event, line) }}
	c.Stdout, c.Stderr = w, w
	err := c.Run()
	w.Flush()
	return err
}

// lineWriter sends each line written to it to emit, and keeps the last few
// so an error can say what went wrong.
type lineWriter struct {
	emit func(string)
	mu   sync.Mutex
	buf  []byte
	tail []string
}

func (w *lineWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.buf = append(w.buf, p...)
	for {
		i := bytes.IndexAny(w.buf, "\r\n")
		if i < 0 {
			break
		}
		w.line(string(w.buf[:i]))
		w.buf = w.buf[i+1:]
	}
	return len(p), nil
}

// Flush sends a last line that had no newline.
func (w *lineWriter) Flush() {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.line(string(w.buf))
	w.buf = nil
}

func (w *lineWriter) line(s string) {
	if s = strings.TrimRight(s, " \t"); strings.TrimSpace(s) == "" {
		return
	}
	w.emit(s)
	if w.tail = append(w.tail, strings.TrimSpace(s)); len(w.tail) > 6 {
		w.tail = w.tail[1:]
	}
}

// Tail is the last lines written.
func (w *lineWriter) Tail() string {
	w.mu.Lock()
	defer w.mu.Unlock()
	return strings.Join(w.tail, "\n")
}

// busy reports whether an install, setup step, or command is running.
func (a *App) busy() bool {
	if a.install.TryLock() {
		a.install.Unlock()
		return false
	}
	return true
}

// beforeClose asks before quitting while something runs: an install would
// stop halfway, and an open sign-up window would stay open until its timer.
func (a *App) beforeClose(ctx context.Context) (prevent bool) {
	if !a.busy() {
		return false
	}
	choice, err := runtime.MessageDialog(ctx, runtime.MessageDialogOptions{
		Type:          runtime.QuestionDialog,
		Title:         "Something is still running",
		Message:       "An install or setup step is still running. Quitting now can leave it half done. Quit anyway?",
		Buttons:       []string{"Quit", "Keep running"},
		DefaultButton: "Keep running",
		CancelButton:  "Keep running",
	})
	return err == nil && choice != "Quit" && choice != "Yes"
}

// timed is the app's context with a time limit, for reads from the
// container runtime that should never leave a screen waiting forever.
func (a *App) timed() (context.Context, context.CancelFunc) {
	return context.WithTimeout(a.ctx, 20*time.Second)
}

// AddCustom adds your own app (homelab custom add), sending its output as
// "cli:log" events, and returns the refreshed catalog. The ID comes from the
// name when it is empty.
func (a *App) AddCustom(spec custom.Spec) (api.Catalog, error) {
	c, err := a.catalog()
	if err != nil {
		return api.Catalog{}, err
	}
	if spec.ID == "" {
		spec.ID = custom.Slug(spec.Name)
	}
	if err := spec.Check(c); err != nil {
		return api.Catalog{}, err
	}
	args := []string{"custom", "add", spec.ID, "--image", spec.Image, "--name", spec.Name, "--category", spec.Category, "--apply"}
	if spec.Port > 0 {
		args = append(args, "--port", strconv.Itoa(spec.Port))
	}
	if spec.Description != "" {
		args = append(args, "--description", spec.Description)
	}
	for _, v := range spec.Volumes {
		args = append(args, "--volume", v)
	}
	for k, v := range spec.Env {
		args = append(args, "--env", k+"="+v)
	}
	if !a.install.TryLock() {
		return api.Catalog{}, errors.New("an install or setup step is running")
	}
	defer a.install.Unlock()
	runtime.EventsEmit(a.ctx, "cli:log", "$ homelab custom add "+spec.ID)
	if err := a.stream(core.CLI(a.root, args...), "cli:log"); err != nil {
		return api.Catalog{}, err
	}
	return a.Catalog()
}

// Wire connects the running apps to each other, sending a "link" event
// (wiring.Link) as each connection finishes.
func (a *App) Wire() ([]wiring.Link, error) {
	c, err := a.catalog()
	if err != nil {
		return nil, err
	}
	_, containers, err := core.Containers(a.ctx)
	if err != nil {
		return nil, err
	}
	home, _ := os.UserHomeDir()
	w := wiring.New(c, containers, core.Env(a.root), home)
	return w.Apply(a.ctx, func(l wiring.Link) { runtime.EventsEmit(a.ctx, "link", l) }), nil
}

// Open shows a URL in the default browser.
func (a *App) Open(url string) { runtime.BrowserOpenURL(a.ctx, url) }

func (a *App) catalog() (*catalog.Catalog, error) { return core.Catalog(a.root) }

func (a *App) plan(tokens []string, settings map[string]string) (*catalog.Catalog, *docker.Client, *install.Plan, error) {
	c, err := a.catalog()
	if err != nil {
		return nil, nil, nil, err
	}
	ctx, cancel := a.timed()
	defer cancel()
	client, containers, err := core.Containers(ctx)
	if err != nil {
		return nil, nil, nil, err
	}
	sel, err := selector.Resolve(c, tokens, nil)
	if err != nil {
		return nil, nil, nil, err
	}
	home, _ := os.UserHomeDir()
	p, err := install.Build(install.Inputs{
		Catalog:    c,
		EnvFile:    filepath.Join(a.root, ".env"),
		EnvExample: filepath.Join(a.root, ".env.example"),
		Containers: containers,
		Prober:     ports.NewHostProber(),
		Identity:   envfile.HostIdentity(),
		Home:       home,
		Set:        settings,
	}, sel)
	return c, client, p, err
}
