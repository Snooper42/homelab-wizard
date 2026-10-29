package main

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"time"

	"github.com/Snooper42/homelab-wizard/app/tray"
	"github.com/Snooper42/homelab-wizard/internal/battery"
	"github.com/Snooper42/homelab-wizard/internal/engine"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/host"
	"github.com/Snooper42/homelab-wizard/internal/schedule"
)

// HealthInfo is how this machine looks after the homelab, for Setup's
// tiles: the background agent, the watchdog's last check, and the power.
type HealthInfo struct {
	// Agent is the background agent: "running" (its engine answers),
	// "stopped" (installed, not running), "quit" (stopped by Quit), or
	// "off" (not installed yet: Setup's scheduled jobs step).
	Agent     string    `json:"agent"`
	LastCheck time.Time `json:"lastCheck"` // the watchdog's last run; zero before the first
	// Power is "battery" or "plugged" on a machine with a battery, and ""
	// on one without (or where it cannot tell).
	Power     string `json:"power"`
	KeptAwake bool   `json:"keptAwake"` // KEEP_AWAKE: held awake while plugged in
}

// What Health reads, which tests replace.
var (
	agentInstalled = func() bool {
		l, err := schedule.For(host.Current())
		if err != nil {
			return false
		}
		for _, j := range schedule.Jobs() {
			if l.Status(j.Label).Installed {
				return true
			}
		}
		return false
	}
	agentAnswers = func(root string) bool {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_, err := engine.Dial(ctx, root)
		return err == nil
	}
)

// agentState names the agent's state from what was found.
func agentState(installed, quit, answers bool) string {
	switch {
	case answers:
		return "running"
	case quit:
		return "quit"
	case installed:
		return "stopped"
	}
	return "off"
}

// Health reads how this machine looks after the homelab.
func (a *App) Health() HealthInfo {
	h := HealthInfo{Agent: "off"}
	if a.root == "" {
		return h
	}
	_, err := os.Stat(filepath.Join(a.root, "scripts", "logs", "stopped.json"))
	h.Agent = agentState(agentInstalled(), err == nil, agentAnswers(a.root))
	h.LastCheck = health.LoadState(health.StatePath(a.root)).LastRun
	if on, known := battery.Power(); known {
		h.Power = "plugged"
		if on {
			h.Power = "battery"
		}
	}
	h.KeptAwake = tray.KeepAwake(a.root)
	return h
}

var errNoRoot = errors.New("no homelab folder yet: Setup makes one")

// StartAgent starts the background agent again (homelab resume, as when
// the app opens), and says why when it could not.
func (a *App) StartAgent() error {
	if a.root == "" {
		return errNoRoot
	}
	return resume(a.root)
}
