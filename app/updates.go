package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/Snooper42/homelab-wizard/app/tray"
	"github.com/Snooper42/homelab-wizard/internal/selfupdate"
)

// One look for updates covers the homelab files and the app's own build:
// every 15 minutes while the app runs, and when the window comes forward
// after 10. The window, its sidebar, and the menu bar item show what it
// found as one update, which Update now puts in place in one step.
const (
	lookEvery      = 15 * time.Minute
	lookOnFocus    = 10 * time.Minute
	updatedShownTo = time.Hour // "Updated to …" shows this long after the update
)

// due is whether a look made at last is older than every by the wall
// clock: a Mac's monotonic clock stops while it sleeps, so a look before
// a night's sleep still counts as old in the morning.
func due(last, now time.Time, every time.Duration) bool {
	return last.IsZero() || now.Round(0).Sub(last.Round(0)) >= every
}

// UpdateState is the one update the window shows: the homelab files
// waiting and a newer build of the app, together.
type UpdateState struct {
	// State: "" (nothing waits), "ready" (Update now puts it in place),
	// or "blocked" (it cannot finish by itself; Blocked says why).
	State   string   `json:"state"`
	Version string   `json:"version,omitempty"` // "0.15.0", when known
	Notes   []string `json:"notes"`             // what it brings, in words
	Files   int      `json:"files"`             // homelab changes waiting
	App     bool     `json:"app"`               // a newer build replaces this app
	// Downloaded: the app's new build is here already, so the update
	// takes seconds.
	Downloaded bool `json:"downloaded"`
	// Finish: the new app brought homelab files for the folder it made,
	// which go in place by themselves after it opens.
	Finish  bool   `json:"finish,omitempty"`
	Blocked string `json:"blocked,omitempty"`
	// Page is where to download the new build by hand, when it cannot
	// install itself.
	Page             string    `json:"page,omitempty"`
	InstallOnQuit    bool      `json:"installOnQuit"`
	CanInstallOnQuit bool      `json:"canInstallOnQuit"`
	Looked           time.Time `json:"looked"`
	// Updated is the update just put in place, shown once after it.
	Updated *Updated `json:"updated,omitempty"`
	// NotInstalled says why the update last asked for did not go in
	// place: the app opened again on the build it was (Windows blocked
	// the new one, a password was not given). Shown once, with Page.
	NotInstalled string `json:"notInstalled,omitempty"`
}

// Updated is an update just put in place: what it was, for "Updated to …".
type Updated struct {
	Version string    `json:"version,omitempty"`
	Notes   []string  `json:"notes"`
	At      time.Time `json:"at"`
	// Commit is the build the app was updating to: an app that opens on
	// another one knows the update did not go in place.
	Commit string `json:"commit,omitempty"`
}

// lookState is the last look, beside the update the background found.
type lookState struct {
	mu     sync.Mutex
	looked time.Time
	busy   bool
}

// prNumber is the "(#285)" a change's subject ends with.
var prNumber = regexp.MustCompile(`\s*\(#\d+\)$`)

// updateState puts the homelab files' check and the app's newer build
// together as one update.
func updateState(info UpgradeInfo, pending *PendingUpdate, looked time.Time) UpdateState {
	s := UpdateState{Notes: []string{}, Files: info.Behind, Looked: looked}
	if pending != nil {
		s.App, s.Downloaded = true, pending.Ready
		s.InstallOnQuit, s.CanInstallOnQuit = pending.InstallOnQuit, pending.CanInstallOnQuit
		s.Version = strings.TrimPrefix(pending.Version, "v")
	} else if info.AppUpdate != nil {
		s.App = true
		s.Version = strings.TrimPrefix(info.AppUpdate.Version, "v")
	}
	if s.Version == "" && info.NewVersion != "" && info.NewVersion != info.Version {
		s.Version = info.NewVersion
	}
	switch {
	case len(info.Notes) > 0:
		s.Notes = info.Notes
	case pending != nil && len(pending.Notes) > 0:
		for _, n := range pending.Notes {
			s.Notes = append(s.Notes, prNumber.ReplaceAllString(n, ""))
		}
	default:
		for _, c := range info.Changes {
			s.Notes = append(s.Notes, prNumber.ReplaceAllString(c.Subject, ""))
		}
	}
	// A folder the app made gets its files with the new build: they are
	// not a separate step.
	if info.Kit && s.App {
		s.Files = 0
	}
	s.Finish = info.Kit && s.Files > 0
	switch {
	case info.Ahead > 0:
		s.State, s.Blocked = "blocked", "The homelab folder has changes of its own, so it cannot update by itself: Upgrading.md says what to do"
	case info.AppUpdate != nil && !info.AppUpdate.CanInstall:
		s.State, s.Blocked, s.Page = "blocked", "This copy of the app cannot replace itself: download the new one", info.AppUpdate.Page
	case !info.SelfUpdates && info.AppBehind > 0 && s.Files == 0:
		s.State, s.Blocked = "blocked", "This build was made by hand: build or download the newest one"
	case s.Files > 0 || s.App:
		s.State = "ready"
	}
	return s
}

// UpdateState is the update waiting, as the last look found it.
func (a *App) UpdateState() UpdateState {
	a.upgradeMu.Lock()
	var info UpgradeInfo
	if a.lastUpgrade != nil {
		info = a.upgradeInfoLocked()
	}
	a.upgradeMu.Unlock()
	a.looks.mu.Lock()
	looked := a.looks.looked
	a.looks.mu.Unlock()
	s := updateState(info, a.PendingAppUpdate(), looked)
	if s.State == "" {
		s.InstallOnQuit, s.CanInstallOnQuit = installOnQuit(), !selfupdate.Current().AsksPermission()
	}
	if u, ok := loadUpdated(time.Now()); ok {
		if why, failed := notInstalled(u, commit, selfupdate.Failure()); failed {
			s.NotInstalled = why
			if r := a.pendingRelease(); r != nil && r.Page != "" {
				s.Page = r.Page
			}
		} else {
			s.Updated = &u
		}
	}
	return s
}

// notInstalled says, for an update to u.Commit when this app was built
// from built, why it did not go in place: the update's log's reason when
// it has one. An update of the homelab files only, or a build made by
// hand, has no commit to tell by.
func notInstalled(u Updated, built, why string) (string, bool) {
	if u.Commit == "" || built == "" || strings.HasPrefix(u.Commit, built) || strings.HasPrefix(built, u.Commit) {
		return "", false
	}
	v := "the new version"
	if u.Version != "" {
		v = u.Version
	}
	if why == "" {
		why = "the new build was not put in place"
	}
	return fmt.Sprintf("The update to %s did not install: %s. Install it by hand from its release page, or try again.", v, why), true
}

// LookForUpdates looks now when asked, or when the last look is 10
// minutes old (the window came forward), and says what it found.
func (a *App) LookForUpdates(now bool) UpdateState {
	a.looks.mu.Lock()
	ask := (now || due(a.looks.looked, time.Now(), lookOnFocus)) && !a.looks.busy
	a.looks.mu.Unlock()
	if ask {
		a.look()
	}
	return a.UpdateState()
}

// look asks GitHub once for both, downloads a newer app build ahead, and
// tells the window and the menu bar item.
func (a *App) look() {
	a.looks.mu.Lock()
	if a.looks.busy {
		a.looks.mu.Unlock()
		return
	}
	a.looks.busy = true
	a.looks.mu.Unlock()
	if a.root != "" {
		_, _ = a.UpgradeCheck(true)
	}
	a.checkAppUpdate()
	a.looks.mu.Lock()
	a.looks.busy, a.looks.looked = false, time.Now()
	a.looks.mu.Unlock()
	s := a.UpdateState()
	saveFound(s)
	emitEvent(a.ctx, "update:state", s)
}

// UpdateStep is how far Update now has come, sent as "update:step".
type UpdateStep struct {
	Step    string `json:"step"`    // files, download, app, done, failed
	Percent int    `json:"percent"` // the whole update's, 0 to 100
	Error   string `json:"error,omitempty"`
}

// UpdateNow puts the update in place: the homelab files first, then the
// app's new build, which quits this one and opens again. With only the
// files, the window stays and says it is done.
func (a *App) UpdateNow() error {
	s := a.UpdateState()
	if s.State != "ready" {
		return errors.New("no update is ready")
	}
	step := func(name string, pct int) { emitEvent(a.ctx, "update:step", UpdateStep{Step: name, Percent: pct}) }
	fail := func(err error) error {
		emitEvent(a.ctx, "update:step", UpdateStep{Step: "failed", Error: err.Error()})
		return err
	}
	if s.Files > 0 {
		step("files", 5)
		if err := a.Homelab("upgrade", "", true); err != nil {
			return fail(err)
		}
	}
	if !s.App {
		saveUpdated(Updated{Version: s.Version, Notes: s.Notes, At: time.Now()})
		step("done", 100)
		a.look()
		return nil
	}
	step("app", 60)
	to := ""
	if r := a.pendingRelease(); r != nil {
		to = r.Commit
	}
	saveUpdated(Updated{Version: s.Version, Notes: s.Notes, At: time.Now(), Commit: to})
	if err := a.InstallAppUpdate(); err != nil {
		_ = os.Remove(updatedPath())
		return fail(err)
	}
	return nil
}

// ClearUpdated takes "Updated to …" away once it was seen.
func (a *App) ClearUpdated() { _ = os.Remove(updatedPath()) }

// installOnQuit is whether a downloaded update goes in place as the app
// quits: on unless turned off.
func installOnQuit() bool {
	p := loadPrefs()
	return p.InstallOnQuit == nil || *p.InstallOnQuit
}

func configFile(name string) string {
	dir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	return filepath.Join(dir, "Homelab Wizard", name)
}

func updatedPath() string { return configFile("updated.json") }

func saveUpdated(u Updated) {
	if u.Notes == nil {
		u.Notes = []string{}
	}
	writeJSON(updatedPath(), u)
}

// loadUpdated is the update put in place in the last hour, if any.
func loadUpdated(now time.Time) (Updated, bool) {
	var u Updated
	data, err := os.ReadFile(updatedPath())
	if err != nil || json.Unmarshal(data, &u) != nil {
		return Updated{}, false
	}
	if age := now.Round(0).Sub(u.At.Round(0)); u.At.IsZero() || age < 0 || age > updatedShownTo {
		return Updated{}, false
	}
	return u, true
}

// saveFound leaves what the look found for the menu bar item, which runs
// apart from the window.
func saveFound(s UpdateState) {
	_ = tray.SaveFound(tray.Found{Looked: s.Looked, Ready: s.State == "ready", Version: s.Version})
}

func writeJSON(path string, v any) {
	if path == "" {
		return
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return
	}
	data, _ := json.MarshalIndent(v, "", "  ")
	_ = os.WriteFile(path, data, 0o644)
}
