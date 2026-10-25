package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/engine"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
)

// The agent's timetable: the watchdog every 15 minutes, the backup daily
// at backupHour:backupMinute (or at the first chance after, if the machine
// was asleep or off then).
const (
	watchdogEvery = 15 * time.Minute
	backupHour    = 3
	backupMinute  = 30
)

// agent is the one background job: it starts the apps after login, keeps
// the machine awake on power, serves the phone companion, runs the
// watchdog and the nightly backup. One login item instead of five; each
// part still runs as its own process, with its own log, so one failing
// leaves the others running.
func (h *homelab) agent(ctx context.Context, _ []string) error {
	self, err := os.Executable()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(h.logsDir(), 0o755); err != nil {
		return err
	}
	run := func(name string, args ...string) error {
		f, err := os.OpenFile(filepath.Join(h.logsDir(), name+".log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
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
		_ = saveAgentState(state, agentState{LastBackup: time.Now()})
	}
	h.ui.Info("agent: starting the apps")
	_ = run("startup", "up", "--apply", "--wait-media", "15m")
	lastWatch := time.Time{}
	tick := time.NewTicker(time.Minute)
	defer tick.Stop()
	for {
		now := time.Now()
		if now.Sub(lastWatch) >= watchdogEvery {
			lastWatch = now
			_ = run("watchdog", "watchdog", "--quiet")
		}
		if backupDue(now, loadAgentState(state).LastBackup) {
			_ = run("backup", "backup", "--apply")
			_ = saveAgentState(state, agentState{LastBackup: now})
		}
		select {
		case <-ctx.Done():
			wg.Wait()
			return nil
		case <-tick.C:
		}
	}
}

// backupDue reports whether the nightly backup should run now: it is past
// today's backup time and none ran since then.
func backupDue(now, last time.Time) bool {
	slot := time.Date(now.Year(), now.Month(), now.Day(), backupHour, backupMinute, 0, 0, now.Location())
	if now.Before(slot) {
		slot = slot.AddDate(0, 0, -1)
	}
	return last.Before(slot)
}

// agentState is what the agent remembers between logins.
type agentState struct {
	LastBackup time.Time `json:"lastBackup"`
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

// trayHelperFor finds the menu bar helper for the agent at self: beside it
// in Contents/Helpers, or, from the agent's own bundle in
// Contents/Library/LoginItems, in the outer app's Contents/Helpers.
func trayHelperFor(self string) string {
	candidates := []string{filepath.Join(filepath.Dir(self), "homelab-tray")}
	if i := strings.Index(self, "/Contents/Library/LoginItems/"); i >= 0 {
		candidates = append(candidates, self[:i]+"/Contents/Helpers/homelab-tray")
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	return ""
}
