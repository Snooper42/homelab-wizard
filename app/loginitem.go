package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/host"
	"github.com/Snooper42/homelab-wizard/internal/schedule"
)

// agentLabel is the background agent's launchd label.
const agentLabel = "com.homelab.agent"

// The agent as the app's login item: on a Mac with macOS 13 or later, the
// app registers it through SMAppService (its plist inside the app, in
// Contents/Library/LaunchAgents), so System Settings › Login Items lists it
// as Homelab Wizard instead of a bare "homelab", which an ad-hoc-signed
// launchd job gets. Where that cannot be done, the launchd job stays.

// agentJobs is what switching needs of launchd (schedule.Launchd).
type agentJobs interface {
	Status(label string) schedule.Status
	Remove(label string) error
	Enable(label string)
}

// loginItem switches the agent from its launchd job to the login item.
type loginItem struct {
	jobs     agentJobs
	state    func() int          // SMAppService's state (loginItemState)
	set      func(on bool) error // register or unregister (loginItemSet)
	fallback func() error        // the launchd job again (homelab schedule install)
}

// use makes the agent the login item when its launchd job runs it now,
// and says what happened ("" when there was nothing to do). A login item
// that does not end up enabled (an error, or one waiting for approval in
// System Settings) is taken back, and the launchd job installed again, so
// the homelab is never left without its agent.
func (li loginItem) use() string {
	// macOS says "not found" for a login item it has never seen, until its
	// first register, so that one is tried too (useLoginItem has checked
	// this build carries its plist); one still not enabled after it falls
	// back to the launchd job below.
	switch li.state() {
	case itemEnabled, itemNone:
		return "" // done already, or macOS 12
	case itemRequiresApproval:
		_ = li.set(false)
		if err := li.fallback(); err != nil {
			return "waiting for approval; the launchd job could not come back: " + err.Error()
		}
		return "waiting for approval: the launchd job again"
	}
	// Only once the jobs are installed (Setup does that) and the agent is
	// not stopped by Quit.
	if !li.jobs.Status(agentLabel).Loaded {
		return ""
	}
	if err := li.jobs.Remove(agentLabel); err != nil {
		return "the launchd job stays: " + err.Error()
	}
	li.jobs.Enable(agentLabel)
	err := li.set(true)
	if err == nil && li.state() == itemEnabled {
		return "registered"
	}
	_ = li.set(false)
	why := "not enabled"
	if err != nil {
		why = err.Error()
	}
	if ferr := li.fallback(); ferr != nil {
		return why + "; the launchd job could not come back: " + ferr.Error()
	}
	return why + ": the launchd job again"
}

// loginItemNote is what the app remembers of its last try, so it tries
// once per build.
type loginItemNote struct {
	Version string    `json:"version"`
	Result  string    `json:"result"`
	At      time.Time `json:"at"`
}

func loginItemNotePath() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	return filepath.Join(dir, "Homelab Wizard", "login-item.json")
}

// bundledLoginItem reports whether this build carries the login item's
// plist (a release; not wails dev).
func bundledLoginItem() bool {
	exe, err := os.Executable()
	if err != nil {
		return false
	}
	return fileExists(filepath.Join(filepath.Dir(exe), "..", "Library", "LaunchAgents", schedule.LoginItemPlist))
}

// useLoginItem tries the login item once per build, on a Mac whose build
// carries it.
func (a *App) useLoginItem() {
	if !bundledLoginItem() {
		return
	}
	l, err := schedule.For(host.Current())
	if err != nil {
		return
	}
	ld, ok := l.(schedule.Launchd)
	if !ok {
		return
	}
	loginItem{jobs: ld, state: loginItemState, set: loginItemSet,
		fallback: func() error { return core.CLI(a.root, "schedule", "install", "--apply").Run() }}.once(loginItemNotePath(), version)
}

// once tries the login item once per build, noting the result at path;
// one waiting for approval is tried again at each start.
func (li loginItem) once(path, build string) string {
	var note loginItemNote
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &note)
	}
	if note.Version == build && li.state() != itemRequiresApproval {
		return ""
	}
	result := li.use()
	if result == "" || path == "" {
		return result
	}
	data, _ := json.MarshalIndent(loginItemNote{Version: build, Result: result, At: time.Now()}, "", "  ")
	_ = os.MkdirAll(filepath.Dir(path), 0o755)
	_ = os.WriteFile(path, data, 0o644)
	return result
}
