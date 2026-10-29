package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"sync"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/crash"
	"github.com/Snooper42/homelab-wizard/internal/engine"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
	"github.com/Snooper42/homelab-wizard/internal/updates"
)

// The agent's timetable: the watchdog every 15 minutes, the backup daily
// at backupHour:backupMinute, and the nightly updates at WATCHTOWER_
// SCHEDULE's hour (4:00 unless changed), each at the first chance after
// if the machine was asleep or off then: the backup first.
const (
	watchdogEvery = 15 * time.Minute
	backupHour    = 3
	backupMinute  = 30
)

// agent is the one background job: it starts the apps after login, keeps
// the machine awake on power, serves the phone companion, runs the
// watchdog, the nightly backup, and the nightly updates. One login item instead of five; each
// part still runs as its own process, with its own log, so one failing
// leaves the others running.
func (h *homelab) agent(ctx context.Context, args []string) error {
	self, err := os.Executable()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(h.logsDir(), 0o755); err != nil {
		return err
	}
	if slices.Contains(args, "--login-item") {
		// Started by macOS as the app's login item (SMAppService), from a
		// plist fixed when the app was built: no log file, and launchd's
		// short PATH. The agent opens its own log and finds the runtime.
		f, err := openJobLog(h.logsDir(), "agent", jobLogLimit)
		if err != nil {
			return err
		}
		defer f.Close()
		h.ui.Out, os.Stdout, os.Stderr = f, f, f
		home, _ := os.UserHomeDir()
		os.Setenv("PATH", h.host.JobPath(home)+string(os.PathListSeparator)+os.Getenv("PATH"))
	}
	// A crash here goes to scripts/logs/crash-<date>.log (internal/crash).
	if err := crash.Watch(h.logsDir(), "agent", version); err != nil {
		h.ui.Warn("agent: no crash log: %v", err)
	}
	run := func(name string, args ...string) error {
		f, err := openJobLog(h.logsDir(), name, jobLogLimit)
		if err != nil {
			return err
		}
		defer f.Close()
		fmt.Fprintf(f, "\n== %s\n", time.Now().Format(time.RFC3339))
		c := procattr.Hide(exec.CommandContext(ctx, self, args...))
		c.Dir, c.Stdout, c.Stderr = h.root, f, f
		return c.Run()
	}
	var wg sync.WaitGroup
	// Always-on parts come back a minute after failing; one that exits
	// cleanly was switched off in .env, and is looked at again later.
	always := func(name string, args ...string) {
		defer wg.Done()
		for ctx.Err() == nil {
			wait := time.Minute
			if run(name, args...) == nil {
				wait = watchdogEvery
			}
			select {
			case <-ctx.Done():
			case <-time.After(wait):
			}
		}
	}
	wg.Add(3)
	go always("awake", "awake")
	go always("serve", "serve")
	// The engine for the app and the menu bar item: status and changes.
	go func() {
		defer wg.Done()
		srv := &engine.Server{Root: h.root,
			Status: func(ctx context.Context) (api.Status, error) { return core.Status(ctx, h.root) },
			Now:    func(ctx context.Context) (api.Status, error) { return core.StatusHere(ctx, h.root) }}
		if err := srv.Serve(ctx); err != nil && !errors.Is(err, engine.ErrServed) {
			h.ui.Warn("agent: serving the engine: %v", err)
		}
	}()
	startTrayHelper(self)
	state := filepath.Join(h.logsDir(), "agent.json")
	if _, err := os.Stat(state); err != nil {
		// Counting starts now: the first backup is tonight's, not one at once.
		_ = saveAgentState(state, agentState{LastBackup: time.Now(), LastUpdate: time.Now()})
	} else if s := loadAgentState(state); s.LastUpdate.IsZero() {
		// From a version that left the updates to Watchtower: tonight's
		// is the first.
		s.LastUpdate = time.Now()
		_ = saveAgentState(state, s)
	}
	h.ui.Info("agent: starting the apps")
	// What homelab quit stopped first: up starts only the baseline. With
	// the runtime not up yet, again once up has waited for it.
	restarted := func() {
		if n, err := h.startStopped(ctx); err != nil {
			h.ui.Warn("agent: the apps homelab quit stopped: %v", err)
		} else if n > 0 {
			h.ui.OK("agent: started %d containers homelab quit stopped", n)
		}
	}
	restarted()
	_ = run("startup", "up", "--apply", "--wait-media", "15m")
	if h.quitted() {
		restarted()
	}
	lastWatch := time.Time{}
	tick := time.NewTicker(time.Minute)
	defer tick.Stop()
	for {
		now := time.Now()
		if now.Sub(lastWatch) >= watchdogEvery {
			lastWatch = now
			_ = run("watchdog", "watchdog", "--quiet")
		}
		if s := loadAgentState(state); backupDue(now, s.LastBackup) {
			_ = run("backup", "backup", "--apply")
			s.LastBackup = now
			_ = saveAgentState(state, s)
		}
		env := h.envMap()
		if s := loadAgentState(state); updateDue(now, s.LastUpdate, env) {
			// Paused (Status, the menu): the night passes without one.
			if !updates.Paused(env) {
				_ = run("update", "update", "--all", "--nightly", "--apply")
			}
			s.LastUpdate = now
			_ = saveAgentState(state, s)
		}
		select {
		case <-ctx.Done():
			wg.Wait()
			return nil
		case <-tick.C:
		}
	}
}

// jobLogLimit is how large a job's log grows before its older half moves
// to <job>.1.log.
const jobLogLimit = 5 << 20

// openJobLog opens a job's log in dir for adding to. One that has reached
// limit is split first: its older half replaces <name>.1.log and the newer
// half stays, so a job keeps at most about one and a half times limit (the
// watchdog writes every 15 minutes, for as long as the homelab runs).
func openJobLog(dir, name string, limit int64) (*os.File, error) {
	path := filepath.Join(dir, name+".log")
	if fi, err := os.Stat(path); err == nil && fi.Size() >= limit {
		if err := splitLog(path, filepath.Join(dir, name+".1.log")); err != nil {
			return nil, err
		}
	}
	return os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
}

// splitLog moves the older half of path, up to a line's end, to older.
// Each file is written beside its place and renamed into it, so a split
// cut short leaves the old files as they were.
func splitLog(path, older string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	cut := len(data) / 2
	if i := bytes.IndexByte(data[cut:], '\n'); i >= 0 {
		cut += i + 1
	}
	for _, f := range []struct {
		path string
		data []byte
	}{{older, data[:cut]}, {path, data[cut:]}} {
		tmp := f.path + ".tmp"
		if err := os.WriteFile(tmp, f.data, 0o644); err != nil {
			return err
		}
		if err := os.Rename(tmp, f.path); err != nil {
			return err
		}
	}
	return nil
}

// backupDue reports whether the nightly backup should run now: it is past
// today's backup time and none ran since then.
func backupDue(now, last time.Time) bool { return dueAt(now, last, backupHour, backupMinute) }

// updateDue reports whether the nightly updates should run now: past
// today's time in WATCHTOWER_SCHEDULE and none since.
func updateDue(now, last time.Time, env map[string]string) bool {
	h, m := updates.At(env[updates.ScheduleKey])
	return dueAt(now, last, h, m)
}

// dueAt reports whether a daily job at hour:minute should run now: it is
// past today's time and it has not run since.
func dueAt(now, last time.Time, hour, minute int) bool {
	slot := time.Date(now.Year(), now.Month(), now.Day(), hour, minute, 0, 0, now.Location())
	if now.Before(slot) {
		slot = slot.AddDate(0, 0, -1)
	}
	return last.Before(slot)
}

// agentState is what the agent remembers between logins.
type agentState struct {
	LastBackup time.Time `json:"lastBackup"`
	LastUpdate time.Time `json:"lastUpdate,omitzero"`
}

func loadAgentState(path string) agentState {
	var s agentState
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &s)
	}
	return s
}

func saveAgentState(path string, s agentState) error {
	data, _ := json.MarshalIndent(s, "", "  ")
	return os.WriteFile(path, data, 0o644)
}
