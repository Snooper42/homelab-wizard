package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/battery"
)

// The agent's state, as Setup's tile says it: running wins (its engine
// answers), then stopped by Quit, then installed but stopped, else off.
func TestAgentState(t *testing.T) {
	for _, c := range []struct {
		installed, quit, answers bool
		want                     string
	}{
		{true, false, true, "running"},
		{false, false, true, "running"},
		{true, true, false, "quit"},
		{true, false, false, "stopped"},
		{false, false, false, "off"},
	} {
		if got := agentState(c.installed, c.quit, c.answers); got != c.want {
			t.Errorf("agentState(%v, %v, %v) = %q, want %q", c.installed, c.quit, c.answers, got, c.want)
		}
	}
}

// Health reads the agent, the watchdog's last run, the power, and
// KEEP_AWAKE from the homelab folder; with no folder, the agent is off.
func TestHealth(t *testing.T) {
	installed, answers, onBattery, known := true, false, true, true
	oldInstalled, oldAnswers, oldPower := agentInstalled, agentAnswers, battery.Power
	agentInstalled = func() bool { return installed }
	agentAnswers = func(string) bool { return answers }
	battery.Power = func() (bool, bool) { return onBattery, known }
	t.Cleanup(func() { agentInstalled, agentAnswers, battery.Power = oldInstalled, oldAnswers, oldPower })

	if h := (&App{}).Health(); h.Agent != "off" {
		t.Errorf("no folder: %+v", h)
	}
	root := t.TempDir()
	ran := time.Date(2026, 10, 29, 3, 15, 0, 0, time.UTC)
	for path, data := range map[string]string{
		".env":                             "KEEP_AWAKE=false\n",
		"scripts/logs/watchdog-state.json": `{"lastRun":"` + ran.Format(time.RFC3339) + `"}`,
	} {
		p := filepath.Join(root, path)
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, []byte(data), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	a := &App{root: root}
	h := a.Health()
	if h.Agent != "stopped" || h.Power != "battery" || h.KeptAwake || !h.LastCheck.Equal(ran) {
		t.Errorf("installed, not answering, on battery, KEEP_AWAKE=false: %+v", h)
	}
	answers, onBattery = true, false
	if h = a.Health(); h.Agent != "running" || h.Power != "plugged" {
		t.Errorf("answering, plugged in: %+v", h)
	}
	answers = false
	if err := os.WriteFile(filepath.Join(root, "scripts", "logs", "stopped.json"), []byte("{}"), 0o644); err != nil {
		t.Fatal(err)
	}
	if h = a.Health(); h.Agent != "quit" {
		t.Errorf("stopped by Quit: %+v", h)
	}
	known = false
	if h = a.Health(); h.Power != "" {
		t.Errorf("no battery: %+v", h)
	}
}
