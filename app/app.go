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
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Snooper42/homelab-wizard/app/tray"
	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/appicon"
	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/board"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/crash"
	"github.com/Snooper42/homelab-wizard/internal/crowdsec"
	"github.com/Snooper42/homelab-wizard/internal/custom"
	"github.com/Snooper42/homelab-wizard/internal/diskspace"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/domain"
	"github.com/Snooper42/homelab-wizard/internal/duplicati"
	"github.com/Snooper42/homelab-wizard/internal/engine"
	"github.com/Snooper42/homelab-wizard/internal/explain"
	"github.com/Snooper42/homelab-wizard/internal/finance"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/host"
	"github.com/Snooper42/homelab-wizard/internal/install"
	"github.com/Snooper42/homelab-wizard/internal/kit"
	"github.com/Snooper42/homelab-wizard/internal/notify"
	"github.com/Snooper42/homelab-wizard/internal/people"
	"github.com/Snooper42/homelab-wizard/internal/ports"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
	"github.com/Snooper42/homelab-wizard/internal/progress"
	"github.com/Snooper42/homelab-wizard/internal/releases"
	"github.com/Snooper42/homelab-wizard/internal/savings"
	"github.com/Snooper42/homelab-wizard/internal/schedule"
	"github.com/Snooper42/homelab-wizard/internal/selector"
	"github.com/Snooper42/homelab-wizard/internal/selfupdate"
	"github.com/Snooper42/homelab-wizard/internal/settings"
	"github.com/Snooper42/homelab-wizard/internal/setup"
	"github.com/Snooper42/homelab-wizard/internal/storage"
	"github.com/Snooper42/homelab-wizard/internal/sysmem"
	"github.com/Snooper42/homelab-wizard/internal/ui"
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

	update pending   // a newer build found in the background
	looks  lookState // the last look for updates

	shownMu sync.Mutex // the apps Status last showed, for Answers
	shown   []api.AppStatus

	quitting atomic.Bool // Quit and Stop was chosen: close without asking again
	// uninstalled: homelab uninstall --app took the app off. It closes
	// without asking, and writes nothing more (no window size, no update
	// put in place on the way out).
	uninstalled atomic.Bool
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.root = core.Root()
	// A crash of this window goes to scripts/logs, for Status and the report.
	if a.root != "" {
		_ = crash.Watch(filepath.Join(a.root, "scripts", "logs"), "app", version)
	}
	followAppImage()
	startTray()
	go a.watchUpdates()
	go a.moveToAgent()
	// Status follows the engine (the agent's, or the runtime here when the
	// agent is not running): each change goes to the window
	// (status:changed), with the agent's Status after it, which the window
	// draws without asking; from a watcher here it reads Status again.
	go engine.Follow(ctx, a.root, func(c engine.Change) {
		if c.Status != nil {
			a.shownMu.Lock()
			a.shown = slices.Clone(c.Status.Apps)
			a.shownMu.Unlock()
		}
		emitEvent(a.ctx, "status:changed", c)
	})
	a.windowTheme(tray.LoadAppearance())
	// What Quit and Stop stopped starts again when the app opens (not when
	// it opens from the tray's Quit, which asks to stop it).
	if a.root != "" && screenArg(os.Args[1:]) != "quit" {
		go func() { _ = resume(a.root) }()
	}
}

// resume runs homelab resume and keeps what it said in
// scripts/logs/resume.log, so an agent it could not start (which nothing
// on screen says yet) can be looked into; its error is the command's.
func resume(root string) error {
	out, err := core.CLI(root, "resume").CombinedOutput()
	var b bytes.Buffer
	fmt.Fprintf(&b, "== %s homelab resume\n%s", time.Now().Format(time.RFC3339), out)
	if err != nil {
		fmt.Fprintf(&b, "failed: %v\n", err)
	}
	dir := filepath.Join(root, "scripts", "logs")
	if os.MkdirAll(dir, 0o755) == nil {
		_ = os.WriteFile(filepath.Join(dir, "resume.log"), b.Bytes(), 0o644)
	}
	if err != nil {
		return fmt.Errorf("homelab resume: %v %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

// domReady puts the window back where it was and, opened from the tray's
// Quit Homelab Wizard…, asks whether to quit.
func (a *App) domReady(ctx context.Context) {
	a.restoreWindow(ctx)
	if screenArg(os.Args[1:]) == "quit" {
		go a.quitIfAsked()
	}
}

// onSecondInstance brings the window forward when the app is opened again
// (for example from the menu bar) and shows the screen it asked for.
func (a *App) onSecondInstance(data options.SecondInstanceData) {
	runtime.WindowUnminimise(a.ctx)
	runtime.Show(a.ctx)
	switch s := screenArg(data.Args); s {
	case "":
	case "quit":
		go a.quitIfAsked()
	default:
		emitEvent(a.ctx, "navigate", s)
	}
}

// Screen is the screen the app was opened with (--screen NAME), or "".
// Quit is a question, not a screen: the window opens on its usual one.
func (a *App) Screen() string {
	if s := screenArg(os.Args[1:]); s != "quit" {
		return s
	}
	return ""
}

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
	OSVersion    string `json:"osVersion,omitempty"` // "macOS 26.0", "Ubuntu 24.04", "Windows 11 24H2"
	Model        string `json:"model,omitempty"`     // "Mac mini (M4)"
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
	// Accent: the colour picked for the system, for the page's buttons
	// and links (Windows; elsewhere nil, and the platform's blue stays).
	Accent *Accent `json:"accent,omitempty"`
	// Desktop is the Linux desktop, for its look: "kde" (Plasma, SteamOS)
	// is drawn as Breeze, anything else as GNOME (style.css, html.de-kde).
	Desktop string `json:"desktop,omitempty"`
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

// OpenNativeApp opens or starts a native app (Jellyfin) that is installed
// but not running: on a Mac the app, by its name or its name with
// "Server"; on Linux its system service, after the password; on Windows its
// service, after approval, or else its tray app.
func (a *App) OpenNativeApp(id string) error {
	c, err := a.catalog()
	if err != nil {
		return err
	}
	app, ok := c.Get(id)
	if !ok || app.Native() == nil {
		return fmt.Errorf("%q is not a native app", id)
	}
	name := app.Name()
	switch goruntime.GOOS {
	case "darwin":
		for _, n := range []string{name, name + " Server"} {
			if exec.Command("open", "-g", "-a", n).Run() == nil {
				return nil
			}
		}
		return fmt.Errorf("%s is not installed: %s", name, app.Native().Install)
	case "linux":
		if exec.Command("systemctl", "cat", id+".service").Run() != nil {
			return fmt.Errorf("%s has no system service here; start it as its installer says", name)
		}
		if out, err := exec.Command("pkexec", "systemctl", "start", id).CombinedOutput(); err != nil {
			return fmt.Errorf("starting %s: %v %s", name, err, strings.TrimSpace(string(out)))
		}
		return nil
	case "windows":
		service := name + "Server" // JellyfinServer, as its installer names it
		if procattr.Hide(exec.Command("sc.exe", "query", service)).Run() == nil {
			start := "Start-Process sc.exe -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList 'start','" + service + "'"
			if out, err := procattr.Hide(exec.Command("powershell.exe", "-NoProfile", "-Command", start)).CombinedOutput(); err != nil {
				return fmt.Errorf("starting %s: %v %s", name, err, strings.TrimSpace(string(out)))
			}
			return nil
		}
		for _, pattern := range []string{`*\*.Windows.Tray.exe`, `*.Windows.Tray.exe`} {
			found, _ := filepath.Glob(filepath.Join(os.Getenv("ProgramFiles"), name, "Server", pattern))
			if len(found) > 0 {
				return exec.Command(found[0]).Start()
			}
		}
		return fmt.Errorf("open %s Server from the Start menu", name)
	}
	return errors.New("open it from your system's app menu")
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
	{Name: "Phone companion", What: "Lets your paired phones see Status and Backups, and Finances where you allow it, on the home network and tailnet only.", When: "always"},
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
	// so Login Items names it Homelab Wizard, with the app's icon; and when
	// the jobs run a copy of the CLI the app's update left behind (an
	// AppImage's), so they run this release's.
	if old || agentOutsideBundle() || core.JobsCLIBehind(a.root) {
		_ = core.CLI(a.root, "schedule", "install", "--apply").Run()
	}
	foldTrayIntoAgent()
	a.useLoginItem()
}

// Host describes this machine, the homelab folder, and the runtime.
func (a *App) Host() HostInfo {
	p := host.Current()
	osVersion, model := machineName()
	info := HostInfo{OS: p.Name, OSVersion: osVersion, Model: model, Machine: p.Machine, Runtime: p.Runtime, Scheduler: p.Scheduler, Supported: p.Supported, Root: a.root, RootOK: core.IsRoot(a.root), Version: version, Backdrop: micaSupported(), Accent: systemAccent(), Desktop: desktop()}
	if info.RootOK {
		info.Disks = disks(a.root)
	} else if kit.Bundled() != "" {
		home, _ := os.UserHomeDir()
		info.Kit, info.NewRoot = true, filepath.Join(home, "Homelab")
	}
	info.RuntimeDownload, info.RuntimeInstalled = p.RuntimeDownload, runtimeInstalled(p)
	client, err := core.NewClient()
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
		if di.Runtime() == "Docker Engine" {
			info.RuntimeFound = "Docker Engine " + di.ServerVersion
		}
	}
	return info
}

// ChooseRoot asks for the homelab folder and remembers it.
func (a *App) ChooseRoot() (HostInfo, error) {
	dir, err := directoryDialog(a.ctx, runtime.OpenDialogOptions{Title: "Choose the homelab folder (the one with compose.yaml)", DefaultDirectory: a.root})
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
	if err := host.StartRuntime(p); err != nil {
		return fmt.Errorf("start it in Terminal: %s", p.StartRuntime)
	}
	return nil
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
	return directoryDialog(a.ctx, runtime.OpenDialogOptions{Title: "Choose the folder for " + key, DefaultDirectory: start, CanCreateDirectories: true})
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
	progress := func(ev install.Event) { emitEvent(a.ctx, "progress", ev) }
	// Compose's own output (image pulls, container starts) goes to the
	// screen too; from Finder the app has no terminal to show it.
	w := &lineWriter{emit: func(line string) { emitEvent(a.ctx, "install:log", line) }}
	a.trackApps(w)
	client.Runner = docker.ExecRunner{Stdout: w, Stderr: w}
	if client.JSONProgress(a.ctx) {
		client.Progress = "json"
	}
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
	emitEvent(a.ctx, "install:log", "$ homelab domain setup --auto")
	if err := a.stream(core.CLI(a.root, "domain", "setup", "--auto", "--apps", strings.Join(ids, ",")), "install:log"); err != nil {
		emitEvent(a.ctx, "install:log", "could not give the new apps their addresses: "+err.Error()+" (Setup › Set up the domain tries again)")
	}
	return api.StartedOf(p), nil
}

// Status is the state of every app, without waiting for their pages:
// with Checking set, Answers says which of them answer.
func (a *App) Status() (api.Status, error) {
	ctx, cancel := a.timed()
	defer cancel()
	st, err := core.StatusNow(ctx, a.root)
	if err == nil {
		a.shownMu.Lock()
		a.shown = slices.Clone(st.Apps)
		a.shownMu.Unlock()
	}
	return st, err
}

// LastStatus is the last Status the agent read, and when: the window draws
// it at once, marked with its age, while Status reads a fresh one. nil when
// there is none (no agent, or it has read none yet).
func (a *App) LastStatus() *api.Reading {
	ctx, cancel := a.timed()
	defer cancel()
	r, ok := core.LastStatus(ctx, a.root)
	if !ok {
		return nil
	}
	return &r
}

// Answers asks the pages of the apps Status last showed and returns, for
// each running app it asked, why it does not answer ("" when it does).
func (a *App) Answers() map[string]string {
	a.shownMu.Lock()
	apps := slices.Clone(a.shown)
	a.shownMu.Unlock()
	return a.answers(apps)
}

// StatusBoard is Status with the cards beside it, in one request: Status
// comes back as Status reads it, and each card in want ("watchdog",
// "crash", "savings", "storage", "alerts", "usage", "week", "protection")
// comes as a "status:card" event (board.Card, carrying n) as soon as it is
// read, from the agent when it serves them (core.ReadCards). While Status
// still checks the apps' pages, their answers come too, as the "answers"
// card, as Answers gives them.
func (a *App) StatusBoard(n int, want []string) (api.Status, error) {
	cards := core.Cards(a.root)
	cards["week"] = func(context.Context) (any, error) { return a.Weekly() }
	emit := func(c board.Card) { emitEvent(a.ctx, "status:card", c) }
	// The cards read from files come alongside Status, so a crash still
	// shows when Status fails; the ones that ask the runtime once it read.
	var files, runtime []string
	for _, name := range want {
		switch name {
		case "watchdog", "crash", "savings", "storage":
			files = append(files, name)
		default:
			runtime = append(runtime, name)
		}
	}
	go core.ReadCards(a.ctx, a.root, n, files, cards, emit)
	st, err := a.Status()
	if err != nil {
		return st, err
	}
	go core.ReadCards(a.ctx, a.root, n, runtime, cards, emit)
	// The pages' answers are for the apps this window shows: read here.
	if st.Checking {
		apps := slices.Clone(st.Apps)
		go board.Read(a.ctx, board.Readers{"answers": func(context.Context) (any, error) { return a.answers(apps), nil }}, n, []string{"answers"}, emit)
	}
	return st, nil
}

func (a *App) answers(apps []api.AppStatus) map[string]string {
	ctx, cancel := a.timed()
	defer cancel()
	api.Probe(ctx, apps)
	out := map[string]string{}
	now := time.Now()
	for _, s := range apps {
		if api.Askable(s, now) {
			out[s.ID] = s.NotAnswering
		}
	}
	return out
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
		if err := clipboardSet(a.ctx, v); err != nil {
			return err
		}
		go func() {
			time.Sleep(copyClearAfter)
			if now, err := clipboardGet(a.ctx); err == nil && now == v {
				_ = clipboardSet(a.ctx, "")
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

// LastCrash is the newest crash of the app, the menu bar item, or the
// background agent that Status should mention (in the last two weeks, not
// waved away yet); nil when there is none.
func (a *App) LastCrash() (*crash.Crash, error) { return core.LastCrash(a.root), nil }

// CrashSeen stops Status mentioning the newest crash.
func (a *App) CrashSeen() error { return core.CrashSeen(a.root) }

// EmailReport starts an email to the helper in HELPER_EMAIL about the
// newest diagnostics report, and shows the file to attach (a mail link
// cannot carry an attachment).
func (a *App) EmailReport() error {
	to := strings.TrimSpace(core.Env(a.root)["HELPER_EMAIL"])
	if to == "" {
		return errors.New("put your helper's address in Settings › Your helper's email first")
	}
	body := "Hi, my homelab needs a look. The diagnostics report is attached (Homelab Wizard removed every password and token from it).\n\nWhat I was doing:\n"
	link := "mailto:" + url.PathEscape(to) + "?subject=" + url.QueryEscape("Homelab report") + "&body=" + url.QueryEscape(body)
	openURL(a.ctx, strings.ReplaceAll(link, "+", "%20"))
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
	return a.upgradeInfoLocked(), nil
}

// upgradeInfoLocked is the last check as the window shows it; upgradeMu
// is held.
func (a *App) upgradeInfoLocked() UpgradeInfo {
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
	return info
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
		err = selfupdate.Install(ctx, r, a.downloading)
	}
	if err != nil {
		return err
	}
	p.mu.Lock()
	p.swapping = true
	p.mu.Unlock()
	go func() {
		time.Sleep(300 * time.Millisecond)
		quitApp(a.ctx)
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

// Finances is the household's money plan read forward from today: each
// paycheck, what it pays, and every account post-pay. Its Rev is the file
// as read, so a save made after a phone's is refused (finance.ErrChanged).
func (a *App) Finances() (finance.View, error) {
	p, err := finance.Load(finance.Path(a.root))
	return finance.ProjectWith(p, a.ledger(), time.Now(), finance.Ahead), err
}

// ledger is what the ledger says happened, for reading the plan forward;
// one that cannot be read is left out here (Transactions says why).
func (a *App) ledger() finance.Ledger {
	l, err := finance.LoadLedger(finance.LedgerPath(a.root))
	if err != nil {
		return finance.Ledger{}
	}
	return l
}

// SaveFinances keeps the plan (in data/finance.json, which the nightly
// backup takes off-site encrypted) and reads it forward again.
func (a *App) SaveFinances(p finance.Plan) (finance.View, error) {
	saved, err := finance.Save(finance.Path(a.root), p)
	if err != nil {
		return finance.View{}, err
	}
	return finance.ProjectWith(saved, a.ledger(), time.Now(), finance.Ahead), nil
}

// FinancesLedger is what actually happened to the household's money, a
// transaction at a time (data/finance-ledger.json, beside the plan).
func (a *App) FinancesLedger() (finance.Ledger, error) {
	return finance.LoadLedger(finance.LedgerPath(a.root))
}

// SaveFinancesLedger keeps the ledger, checked against the plan, and
// refused as the plan is when a phone saved after this was read.
func (a *App) SaveFinancesLedger(l finance.Ledger) (finance.Ledger, error) {
	p, err := finance.Load(finance.Path(a.root))
	if err != nil {
		return l, err
	}
	return finance.SaveLedger(finance.LedgerPath(a.root), l, p)
}

// SaveFinancesReceipt keeps a receipt (a picture made small on this device,
// or a PDF), sent as a data URL, and returns its name for a transaction.
func (a *App) SaveFinancesReceipt(dataURL string) (string, error) {
	return finance.SaveReceipt(finance.ReceiptsDir(a.root), dataURL)
}

// FinancesReceipt reads a kept receipt back as a data URL.
func (a *App) FinancesReceipt(name string) (string, error) {
	return finance.ReadReceipt(finance.ReceiptsDir(a.root), name)
}

// FinancesCalendar is the calendar feed's link for the plan's key, for a
// phone's calendar to subscribe to: the companion's https address only
// (the feed is never sent over the home Wi-Fi). "" with no key; an error
// when the homelab has neither its own domain nor Tailscale.
func (a *App) FinancesCalendar() (string, error) {
	p, err := finance.Load(finance.Path(a.root))
	if err != nil || p.CalendarKey == "" {
		return "", err
	}
	base := companion.SecureBase(core.Env(a.root))
	if base == "" {
		return "", errors.New("the calendar needs Tailscale or the homelab's own domain: it is never sent over the home Wi-Fi")
	}
	return base + "/finances.ics?key=" + p.CalendarKey, nil
}

// ExportFinances asks where to save a Finances export (Reports' CSV) and
// writes it there, readable only by its owner: it is money. name is the
// file's suggested name, a CSV's; the dialog opens in Downloads when there
// is one. It returns "" when the dialog was cancelled, else the file.
func (a *App) ExportFinances(name, text string) (string, error) {
	name = filepath.Base(strings.TrimSpace(name))
	if !strings.HasSuffix(strings.ToLower(name), ".csv") || len(name) < 5 {
		return "", fmt.Errorf("an export is a .csv file, not %q", name)
	}
	home, _ := os.UserHomeDir()
	dir := home
	if st, err := os.Stat(filepath.Join(home, "Downloads")); err == nil && st.IsDir() {
		dir = filepath.Join(home, "Downloads")
	}
	file, err := saveDialog(a.ctx, runtime.SaveDialogOptions{Title: "Save the Finances export", DefaultDirectory: dir, DefaultFilename: name, CanCreateDirectories: true,
		Filters: []runtime.FileFilter{{DisplayName: "Spreadsheet (*.csv)", Pattern: "*.csv"}}})
	if err != nil || file == "" {
		return "", err
	}
	return file, os.WriteFile(file, []byte(text), 0o600)
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
// sign-in link ("welcome"), gives them a new password in Jellyfin and
// Navidrome on a fresh welcome page ("password"), or turns their sign-in
// off ("remove"), as homelab person does, sending its output as "cli:log"
// events.
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
	case "welcome", "remove", "password":
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
	emitEvent(a.ctx, "cli:log", "$ homelab "+strings.Join(args, " "))
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
// phone named name, allowed to make changes or only to look, and on
// Finances nothing (""), to look ("view"), or to change them ("edit").
func (a *App) PairPhone(name string, canChange bool, finances string) (PhonePairing, error) {
	if !core.IsRoot(a.root) {
		return PhonePairing{}, errors.New("choose the homelab folder in Setup first")
	}
	code, err := companion.NewStore(companion.StorePath(a.root)).NewPairing(name, canChange, finances)
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

// SetPhoneFinances hides Finances from a phone (""), shows them ("view"),
// or lets it change them ("edit").
func (a *App) SetPhoneFinances(id, level string) ([]companion.Phone, error) {
	store := companion.NewStore(companion.StorePath(a.root))
	_, err := store.SetFinances(id, level)
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
		emitEvent(a.ctx, "setup:log", "$ homelab "+strings.Join(args, " "))
		// Why, in the CLI's own words (stream); the command is in the log above.
		if err := a.stream(core.CLI(a.root, args...), "setup:log"); err != nil {
			return a.Setup(), err
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
	lock, locked := false, false
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
	case "remove":
		// Remove an app from its page: its container goes, its data stays
		// on disk. On apply, a backup of its data comes first.
		if err := a.container(target); err != nil {
			return err
		}
		args = []string{"remove", target}
		if apply {
			if !a.install.TryLock() {
				return errors.New("another install or setup step is running")
			}
			defer a.install.Unlock()
			locked = true
			emitEvent(a.ctx, "cli:log", "$ homelab backup --apps "+target+" --apply")
			if err := a.stream(core.CLI(a.root, "backup", "--apps", target, "--apply"), "cli:log"); err != nil {
				return fmt.Errorf("the backup before removing it failed, so it was not removed: %w", err)
			}
			emitEvent(a.ctx, "cli:log", "")
		}
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
	case "restore-test-kopia":
		// The same, from Kopia's newest snapshot (the second engine).
		args, apply, lock = []string{"restore-test", "--auto", "--engine", "kopia"}, false, true
	default:
		return fmt.Errorf("unknown action %q", action)
	}
	if (apply || lock) && !locked {
		if !a.install.TryLock() {
			return errors.New("another install or setup step is running")
		}
		defer a.install.Unlock()
	}
	if apply {
		args = append(args, "--apply")
	}
	emitEvent(a.ctx, "cli:log", "$ homelab "+strings.Join(args, " "))
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
		file, err = saveDialog(a.ctx, runtime.SaveDialogOptions{Title: "Save the move file (outside the homelab folder)", DefaultDirectory: home,
			DefaultFilename: "homelab-move-" + time.Now().Format("2006-01-02") + ".tar", CanCreateDirectories: true})
	case "in":
		file, err = fileDialog(a.ctx, runtime.OpenDialogOptions{Title: "Choose the move file from the old machine", DefaultDirectory: home,
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
	emitEvent(a.ctx, "cli:log", "$ homelab "+strings.Join(args, " "))
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
	emitEvent(a.ctx, "cli:log", "$ homelab "+strings.Join(args, " "))
	return a.stream(core.CLI(a.root, args...), "cli:log")
}

// SetAppSetting turns one of an app's own settings on or off, from its
// page: "updates" (the nightly update; off holds it, homelab updates
// hold|release) or "alerts" (the watchdog's alerts about it, homelab
// notify on|off). Status says the new state.
func (a *App) SetAppSetting(id, setting string, on bool) error {
	c, err := a.catalog()
	if err != nil {
		return err
	}
	if _, ok := c.Get(id); !ok {
		return fmt.Errorf("unknown app %q", id)
	}
	var args []string
	switch setting {
	case "updates":
		if err := a.container(id); err != nil {
			return err
		}
		args = []string{"updates", "hold", id}
		if on {
			args[1] = "release"
		}
	case "alerts":
		args = []string{"notify", "off", id}
		if on {
			args[1] = "on"
		}
	default:
		return fmt.Errorf("unknown setting %q", setting)
	}
	if !a.install.TryLock() {
		return errors.New("another install or setup step is running")
	}
	defer a.install.Unlock()
	ctx, cancel := a.timed()
	defer cancel()
	if out, err := core.CLIContext(ctx, a.root, args...).CombinedOutput(); err != nil {
		if tail := lastLine(string(out)); tail != "" {
			return errors.New(tail)
		}
		return err
	}
	return nil
}

// lastLine is the last line of a command's output that says something.
func lastLine(out string) string {
	lines := strings.Split(strings.TrimSpace(out), "\n")
	return strings.TrimSpace(strings.TrimLeft(lines[len(lines)-1], "✗! "))
}

// ReleaseNotes is what updating an app brings: its project's releases
// newer than the version it runs, shown before Update goes ahead.
func (a *App) ReleaseNotes(id string) (releases.Preview, error) {
	ctx, cancel := context.WithTimeout(a.ctx, 20*time.Second)
	defer cancel()
	return core.ReleaseNotes(ctx, a.root, id)
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

// Explainer is the Ollama model on this machine that can explain a log,
// "" when there is none (the Logs panel then has no Explain).
func (a *App) Explainer() string {
	ctx, cancel := context.WithTimeout(a.ctx, 5*time.Second)
	defer cancel()
	model, _ := explain.Model(ctx, core.Env(a.root)["OLLAMA_MODEL"])
	return model
}

// AppIcon is an app's own icon for its page, as a data: URL ("" when it
// has none): asked of the app's page on this machine (its address in the
// last Status, never one from the window) at most once a week, and kept in
// data/icons.
func (a *App) AppIcon(id string) string {
	if a.root == "" {
		return ""
	}
	page := ""
	a.shownMu.Lock()
	for _, s := range a.shown {
		if s.ID == id && s.State == "running" {
			page = s.URL
		}
	}
	a.shownMu.Unlock()
	ctx, cancel := a.timed()
	defer cancel()
	return appicon.Get(ctx, a.root, id, page)
}

// ExplainLogs asks the Ollama on this machine what an app's last lines of
// log say, in plain words; the log stays on this machine.
func (a *App) ExplainLogs(id string) (string, error) {
	log, err := a.Logs(id, 200)
	if err != nil {
		return "", err
	}
	model, err := explain.Model(a.ctx, core.Env(a.root)["OLLAMA_MODEL"])
	if err != nil {
		return "", err
	}
	name := id
	if c, err := a.catalog(); err == nil {
		if app, ok := c.Get(id); ok {
			name = app.Name()
		}
	}
	return explain.Explain(a.ctx, model, name, a.forModel(log))
}

// forModel is an app's log as the model may see it: every secret in .env
// taken out (OLLAMA_HOST may put the model on another computer), then
// anything shaped like a password or token.
func (a *App) forModel(log string) string {
	return explain.Redact(settings.Hide(log, settings.SecretValues(a.root, core.Env(a.root))))
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
	w := &lineWriter{emit: func(line string) { emitEvent(a.ctx, event, line) },
		step: func(s ui.StepEvent) { emitEvent(a.ctx, "cli:step", s) }}
	a.trackApps(w)
	// Steps of a longer job come as JSON lines, for the progress bar.
	c.Env = append(os.Environ(), "HOMELAB_PROGRESS=json")
	c.Stdout, c.Stderr = w, w
	err := c.Run()
	w.Flush()
	// A command that failed says why on the page in its own words, not
	// "exit status 1"; the whole log is in the sheet.
	var exit *exec.ExitError
	if errors.As(err, &exit) {
		if why := w.Why(); why != "" {
			return errors.New(why)
		}
	}
	return err
}

// trackApps has w read Compose's lines into a row per app, sent as
// "job:app" events (progress.Update) for the window that shows the job.
func (a *App) trackApps(w *lineWriter) {
	c, err := core.Catalog(a.root)
	if err != nil {
		return
	}
	w.apps = progress.New(c, core.Env(a.root))
	w.appRow = func(u progress.Update) { emitEvent(a.ctx, "job:app", u) }
}

// lineWriter sends each line written to it to emit, and keeps the last few
// so an error can say what went wrong.
type lineWriter struct {
	emit func(string)
	step func(ui.StepEvent) // a progress step; nil leaves them out
	// apps reads Compose's lines into a row per app (job:app events), and
	// gives the log their plain text; nil passes the lines on as they are.
	apps   *progress.Tracker
	appRow func(progress.Update)
	mu     sync.Mutex
	buf    []byte
	tail   []string
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
	if strings.HasPrefix(s, stepPrefix) {
		var ev struct{ Data ui.StepEvent }
		if json.Unmarshal([]byte(s), &ev) == nil && w.step != nil {
			w.step(ev.Data)
		}
		return
	}
	if w.apps != nil {
		ups, text := w.apps.Line(s)
		for _, u := range ups {
			w.appRow(u)
		}
		if s = text; s == "" {
			return
		}
	}
	w.emit(s)
	if w.tail = append(w.tail, strings.TrimSpace(s)); len(w.tail) > 6 {
		w.tail = w.tail[1:]
	}
}

// stepPrefix starts the CLI's progress lines (ui.Step).
const stepPrefix = `{"schema":1,"type":"step"`

// Why is what a command that failed said last about it: the CLI's "✗"
// line (ui.Fail) when there is one, else its last line.
func (w *lineWriter) Why() string {
	w.mu.Lock()
	defer w.mu.Unlock()
	for i := len(w.tail) - 1; i >= 0; i-- {
		if why, ok := strings.CutPrefix(w.tail[i], "✗ "); ok {
			return strings.TrimSpace(why)
		}
	}
	if len(w.tail) > 0 {
		return w.tail[len(w.tail)-1]
	}
	return ""
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

// beforeClose asks before quitting while something runs (an install would
// stop halfway, and an open sign-up window would stay open until its
// timer), then whether to stop the homelab, which quitting does. An app
// update's restart quits without asking.
func (a *App) beforeClose(ctx context.Context) (prevent bool) {
	if a.uninstalled.Load() {
		return false
	}
	a.rememberWindow(ctx)
	a.update.mu.Lock()
	swapping := a.update.swapping
	a.update.mu.Unlock()
	if swapping || a.quitting.Load() {
		return false
	}
	if a.busy() {
		choice, err := messageDialog(ctx, runtime.MessageDialogOptions{
			Type:          runtime.QuestionDialog,
			Title:         "Something is still running",
			Message:       "An install or setup step is still running. Quitting now can leave it half done. Quit anyway?",
			Buttons:       []string{"Quit", "Keep running"},
			DefaultButton: "Keep running",
			CancelButton:  "Keep running",
		})
		if err != nil || (choice != "Quit" && choice != "Yes") {
			return true
		}
	}
	return !a.askQuit(ctx)
}

// askQuit asks once whether to quit and stop the homelab, and on Quit and
// Stop starts homelab quit, which goes on after the window closes: the
// agent until the next login, the menu bar item, and every app.
func (a *App) askQuit(ctx context.Context) bool {
	if a.root == "" {
		return true // no homelab yet: nothing to stop
	}
	p := host.Current()
	apps := "apps go"
	a.shownMu.Lock()
	n := 0
	for _, s := range a.shown {
		if s.State == "running" {
			n++
		}
	}
	a.shownMu.Unlock()
	if n == 1 {
		apps = "app goes"
	}
	if n > 0 {
		apps = strconv.Itoa(n) + " " + apps
	}
	again := "log in again"
	if p.OS == "windows" {
		again = "sign in again"
	}
	choice, err := messageDialog(ctx, runtime.MessageDialogOptions{
		Type:          runtime.QuestionDialog,
		Title:         "Quit Homelab Wizard and stop the homelab?",
		Message:       fmt.Sprintf("Your %s offline, on %s and on your phones, and nothing is backed up or updated until you open Homelab Wizard again (or %s).", apps, p.Machine, again),
		Buttons:       []string{"Quit and Stop", "Cancel"},
		DefaultButton: "Quit and Stop",
		CancelButton:  "Cancel",
	})
	if err != nil || (choice != "Quit and Stop" && choice != "Yes") {
		return false
	}
	a.quitting.Store(true)
	if c := core.CLI(a.root, "quit", "--apply"); c.Start() == nil {
		go c.Wait()
	}
	return true
}

// quitIfAsked asks, from the tray's Quit Homelab Wizard…, whether to quit
// and stop the homelab, and quits on Quit and Stop.
func (a *App) quitIfAsked() {
	if a.askQuit(a.ctx) {
		quitApp(a.ctx)
	}
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
	emitEvent(a.ctx, "cli:log", "$ homelab custom add "+spec.ID)
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
	return w.Apply(a.ctx, func(l wiring.Link) { emitEvent(a.ctx, "link", l) }), nil
}

// SetAttention shows how many apps need a look on the app's icon (the
// Mac's Dock, a Linux taskbar or dock), as the sidebar's Status count does;
// 0 clears it.
func (a *App) SetAttention(n int) { setBadge(n) }

// Open shows a web page in the default browser, or starts an email. Any
// other kind of address (file:, an app's own scheme) is not opened: the
// page passes on links from outside, such as a release's.
func (a *App) Open(link string) {
	if webLink(link) {
		openURL(a.ctx, link)
	}
}

// webLink reports whether link is an http, https, or mailto address.
func webLink(link string) bool {
	u, err := url.Parse(strings.TrimSpace(link))
	if err != nil {
		return false
	}
	switch strings.ToLower(u.Scheme) {
	case "http", "https":
		return u.Host != ""
	case "mailto":
		return true
	}
	return false
}

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
		Identity:   domain.HostIdentity(),
		Home:       home,
		Set:        settings,
		MemoryMB:   sysmem.TotalMB(),
	}, sel)
	return c, client, p, err
}
