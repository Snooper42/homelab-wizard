package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/selfupdate"
	"github.com/Snooper42/homelab-wizard/internal/upgrade"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// How often the app looks for a newer build of itself while it runs.
const (
	firstUpdateCheck = time.Minute
	updateEvery      = 4 * time.Hour
)

// pending is the newer build found in the background: what changed, and
// whether it is already downloaded for installing when the app quits.
type pending struct {
	mu       sync.Mutex
	release  *selfupdate.Release
	notes    []string
	staged   string // the downloaded app, ready to put in place
	stagedAt string // the commit it was built from
	staging  bool
	swapping bool // an update is already being put in place
}

// prefs is what the app remembers about updating, beside config.json.
type prefs struct {
	InstallOnQuit bool `json:"installOnQuit"`
}

func prefsPath() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	return filepath.Join(dir, "Homelab Wizard", "update.json")
}

func loadPrefs() prefs {
	var p prefs
	if data, err := os.ReadFile(prefsPath()); err == nil {
		_ = json.Unmarshal(data, &p)
	}
	return p
}

func savePrefs(p prefs) error {
	path := prefsPath()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(p, "", "  ")
	return os.WriteFile(path, data, 0o644)
}

// watchUpdates looks for a newer build a minute after starting, then every
// few hours, and tells the window when it finds one ("app:update").
func (a *App) watchUpdates() {
	t := time.NewTimer(firstUpdateCheck)
	defer t.Stop()
	for {
		select {
		case <-a.ctx.Done():
			return
		case <-t.C:
		}
		a.checkAppUpdate()
		t.Reset(updateEvery)
	}
}

// checkAppUpdate asks GitHub for the newest build; one that can replace
// this app is kept, with what changed, and downloaded ahead when it is to
// be installed on quitting.
func (a *App) checkAppUpdate() {
	if commit == "" || selfupdate.Current().Kind == "" {
		return
	}
	ctx, cancel := context.WithTimeout(a.ctx, time.Minute)
	defer cancel()
	a.upgradeMu.Lock()
	repo := a.appRepo()
	a.upgradeMu.Unlock()
	r, err := selfupdate.For(ctx, repo, upgrade.Channel(a.root))
	if err != nil || !r.Newer(commit) || !selfupdate.CanInstall(r) {
		return
	}
	p := &a.update
	p.mu.Lock()
	same := p.release != nil && p.release.Commit == r.Commit
	p.mu.Unlock()
	if !same {
		notes := selfupdate.Notes(ctx, repo, commit, r.Commit)
		p.mu.Lock()
		p.release, p.notes = &r, notes
		p.mu.Unlock()
	}
	if loadPrefs().InstallOnQuit && !selfupdate.Current().AsksPermission() {
		a.stageUpdate()
	}
	runtime.EventsEmit(a.ctx, "app:update", a.PendingAppUpdate())
}

// stageUpdate downloads the pending build into the cache folder, unless it
// is there already or on its way.
func (a *App) stageUpdate() {
	p := &a.update
	p.mu.Lock()
	r := p.release
	if r == nil || p.staging || p.stagedAt == r.Commit {
		p.mu.Unlock()
		return
	}
	p.staging = true
	p.mu.Unlock()
	ctx, cancel := context.WithTimeout(a.ctx, 15*time.Minute)
	defer cancel()
	staged, err := selfupdate.Stage(ctx, *r, selfupdate.StageDir())
	p.mu.Lock()
	p.staging = false
	if err == nil {
		p.staged, p.stagedAt = staged, r.Commit
	}
	p.mu.Unlock()
	if err == nil {
		runtime.EventsEmit(a.ctx, "app:update", a.PendingAppUpdate())
	}
}

// PendingUpdate is the newer build the background check found.
type PendingUpdate struct {
	Commit        string   `json:"commit"`
	Version       string   `json:"version,omitempty"`
	Notes         []string `json:"notes"`
	Ready         bool     `json:"ready"` // downloaded: installs in seconds
	InstallOnQuit bool     `json:"installOnQuit"`
	// CanInstallOnQuit is false where installing asks for an
	// administrator's password (the Windows installer, a Linux package).
	CanInstallOnQuit bool `json:"canInstallOnQuit"`
}

// PendingAppUpdate is the newer build found in the background, or nil.
func (a *App) PendingAppUpdate() *PendingUpdate {
	p := &a.update
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.release == nil {
		return nil
	}
	notes := p.notes
	if notes == nil {
		notes = []string{}
	}
	return &PendingUpdate{Commit: p.release.Commit, Version: p.release.Version, Notes: notes,
		Ready: p.stagedAt == p.release.Commit, InstallOnQuit: loadPrefs().InstallOnQuit,
		CanInstallOnQuit: !selfupdate.Current().AsksPermission()}
}

// SetInstallOnQuit turns installing updates when the app quits on or off;
// on, a pending update is downloaded now so quitting stays quick.
func (a *App) SetInstallOnQuit(on bool) error {
	if err := savePrefs(prefs{InstallOnQuit: on}); err != nil {
		return err
	}
	if on {
		go a.stageUpdate()
	}
	return nil
}

// shutdown puts a downloaded update in place as the app quits, when that
// is turned on; the new version opens next time.
func (a *App) shutdown(context.Context) {
	p := &a.update
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.swapping || p.release == nil || p.stagedAt != p.release.Commit || !loadPrefs().InstallOnQuit || selfupdate.Current().AsksPermission() {
		return
	}
	p.swapping = true
	_ = selfupdate.Swap(p.staged, false)
}
