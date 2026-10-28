package main

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/core"
)

// stoppedApps is what homelab quit stopped, kept in scripts/logs/stopped.json
// until homelab resume, opening the app, or the agent's next start starts
// them again. While the file is there the homelab counts as quit.
type stoppedApps struct {
	At         time.Time `json:"at"`
	Containers []string  `json:"containers"`
}

func (h *homelab) stoppedFile() string { return filepath.Join(h.logsDir(), "stopped.json") }

// quitted reports whether homelab quit stopped the homelab and nothing has
// started it again since.
func (h *homelab) quitted() bool {
	_, err := os.Stat(h.stoppedFile())
	return err == nil
}

func (h *homelab) loadStopped() (stoppedApps, error) {
	var s stoppedApps
	data, err := os.ReadFile(h.stoppedFile())
	if err != nil {
		return s, err
	}
	return s, json.Unmarshal(data, &s)
}

// quit stops the homelab until the app opens again or the next login: the
// background agent (it stays installed), the menu bar item, and every app.
func (h *homelab) quit(ctx context.Context, args []string) error {
	fs := newFlags("quit")
	apply := applyFlag(fs)
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	u := h.ui
	tray := trayName()
	u.Title("Quit the homelab")
	u.Info("stop the background agent until the next login (it stays installed)")
	u.Info("quit %s", tray)
	u.Info("stop every app; opening Homelab Wizard, the next login, or homelab resume starts them again")
	if err := h.goAhead(*apply, "\nQuit?"); err != nil {
		return err
	}
	// The agent first, so it does not start the apps again.
	if l, err := h.scheduler(); err != nil {
		u.Warn("the background agent: %v", err)
	} else {
		for _, j := range jobs() {
			if err := l.Pause(j.Label); err != nil {
				u.Warn("%s: %v", j.Label, err)
				continue
			}
			u.OK("stopped %s until the next login", j.Label)
		}
	}
	if core.QuitTray() {
		u.OK("quit %s", tray)
	}
	if err := os.MkdirAll(h.logsDir(), 0o755); err != nil {
		return err
	}
	// Quit twice: the first one's list still counts.
	s, _ := h.loadStopped()
	s.At = time.Now()
	client, err := h.docker(ctx)
	if err != nil {
		u.Warn("the container runtime is not running, so there are no apps to stop: %v", err)
		return h.saveStopped(s)
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return err
	}
	projects := map[string]bool{}
	for _, f := range h.catalog.Files {
		projects[f.Name] = true
	}
	var names []string
	for _, c := range containers {
		if c.Running && projects[c.Project()] {
			names = append(names, c.Name)
			if !slices.Contains(s.Containers, c.Name) {
				s.Containers = append(s.Containers, c.Name)
			}
		}
	}
	// Written before stopping, so a quit cut short still knows what to start.
	if err := h.saveStopped(s); err != nil {
		return err
	}
	if len(names) == 0 {
		u.OK("no apps were running")
		return nil
	}
	if _, err := client.Runner.Output(ctx, client.Bin, append([]string{"stop"}, names...)...); err != nil {
		return err
	}
	u.OK("stopped %d containers", len(names))
	return nil
}

func (h *homelab) saveStopped(s stoppedApps) error {
	data, _ := json.MarshalIndent(s, "", "  ")
	return os.WriteFile(h.stoppedFile(), data, 0o644)
}

// resume undoes homelab quit: the background agent runs again, and the
// apps quit stopped start. The app runs it each time it opens.
func (h *homelab) resume(ctx context.Context, args []string) error {
	fs := newFlags("resume")
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	u := h.ui
	// The agent first: it is quick, and the Setup steps count it.
	if l, err := h.scheduler(); err == nil {
		for _, j := range jobs() {
			if err := l.Resume(j.Label); err != nil {
				u.Warn("%s: %v", j.Label, err)
			}
		}
	}
	n, err := h.startStopped(ctx)
	if err != nil {
		return err
	}
	if n > 0 {
		u.OK("started %d containers homelab quit stopped", n)
	}
	return nil
}

// startStopped starts the containers homelab quit stopped and forgets the
// list; it returns how many there were. With the runtime not running it
// keeps the list for the next try.
func (h *homelab) startStopped(ctx context.Context) (int, error) {
	s, err := h.loadStopped()
	if errors.Is(err, os.ErrNotExist) {
		return 0, nil
	}
	if err != nil {
		h.ui.Warn("%s: %v", h.rel(h.stoppedFile()), err)
		return 0, os.Remove(h.stoppedFile())
	}
	if len(s.Containers) > 0 {
		client, err := h.docker(ctx)
		if err != nil {
			return 0, err
		}
		if _, err := client.Runner.Output(ctx, client.Bin, append([]string{"start"}, s.Containers...)...); err != nil {
			// One removed since: start the others one by one.
			for _, name := range s.Containers {
				if _, err := client.Runner.Output(ctx, client.Bin, "start", name); err != nil {
					h.ui.Warn("%s: %v", name, err)
				}
			}
		}
	}
	if err := os.Remove(h.stoppedFile()); err != nil && !os.IsNotExist(err) {
		return 0, err
	}
	return len(s.Containers), nil
}
