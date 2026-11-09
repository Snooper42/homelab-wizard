package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/history"
	"github.com/Snooper42/homelab-wizard/internal/lockedfile"
	"github.com/Snooper42/homelab-wizard/internal/started"
	"github.com/Snooper42/homelab-wizard/internal/stopped"
	"github.com/Snooper42/homelab-wizard/internal/turn"
	"github.com/Snooper42/homelab-wizard/internal/updates"
)

// healEvery is how often the watchdog restarts one app at most: an app a
// restart does not help is left for a person after the first.
const healEvery = 6 * time.Hour

// healPath keeps when the watchdog last restarted each app.
func healPath(root string) string { return filepath.Join(root, "data", "healed.json") }

// heal restarts the apps among unwell (running, but unhealthy or not
// answering) whose check has failed on two runs in a row, at most once in
// healEvery each, so a hung app comes back without anyone at the computer.
// Apps updated lately are left to the rollback. Among missing (their
// container is gone), those the watchdog saw running in the last week are
// made again, on the same terms; one never started is left alone, and so
// is one stopped on purpose (data/stopped.json), and none while another
// job has the turn (internal/turn). It
// returns a line per app restarted, for the alert. AUTO_HEAL=false turns it
// off.
func (h *homelab) heal(ctx context.Context, client *docker.Client, unwell, missing []string, state health.State, env map[string]string, now time.Time) []string {
	if strings.EqualFold(env["AUTO_HEAL"], "false") || len(unwell)+len(missing) == 0 {
		return nil
	}
	// Another job changing the homelab (an update takes an app down and up
	// again) has the turn: its apps are left to it, and looked at again on
	// the next round. A watchdog run by that job itself has its turn.
	if _, busy := turn.First(h.root); busy && os.Getenv(turn.Env) == "" {
		return nil
	}
	path := healPath(h.root)
	last := map[string]time.Time{}
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &last)
	}
	hist := updates.LoadHistory(updates.HistoryPath(h.root))
	rollback := !strings.EqualFold(env["AUTO_ROLLBACK"], "false")
	held := stopped.Load(stopped.Path(h.root))
	var done []string
	healed := map[string]time.Time{}
	for _, id := range append(slices.Clone(unwell), missing...) {
		a, ok := h.catalog.Get(id)
		if !ok || !state.Confirmed(id) || now.Sub(last[id]) < healEvery || held.Has(id) {
			continue
		}
		if r := hist.Apps[id]; rollback && r != nil && r.Previous != "" && now.Sub(r.Updated) <= updates.Watch {
			continue // the rollback decides
		}
		verb := []string{"restart"}
		if slices.Contains(missing, id) {
			if !ranThisWeek(state, id) {
				continue
			}
			// No container to restart: Compose makes it again.
			verb = []string{"up", "--detach", "--no-deps"}
		}
		for _, pa := range h.byProject([]*catalog.App{a}) {
			if err := client.Compose(ctx, h.project(pa.file), pa.profiles, append(verb, pa.ids...)...); err != nil {
				h.ui.Warn("restart %s: %v", id, err)
				continue
			}
			last[id] = now
			healed[id] = now
			h.noteStarted(started.Watchdog, id)
			line := a.Name() + " (" + state.Problems[id] + ")"
			if verb[0] == "up" {
				line = a.Name() + " (its container was gone, so it was made again)"
			}
			h.record("heal", id, history.Watchdog, "Restarted "+line+": it stopped answering")
			h.ui.Info("restarted %s, unwell on two checks in a row", line)
			done = append(done, line)
		}
	}
	if len(done) > 0 {
		h.noteHealed(path, healed, now)
	}
	return done
}

// noteHealed adds this run's restarts to the note, read again under its
// lock: another watchdog run (the agent's, and the one after sleep) may
// have noted its own meanwhile, and losing it would let that app be
// restarted again before healEvery is up. Notes a week old go.
func (h *homelab) noteHealed(path string, healed map[string]time.Time, now time.Time) {
	err := lockedfile.Update(path, 0o644, func(old []byte) ([]byte, bool) {
		last := map[string]time.Time{}
		_ = json.Unmarshal(old, &last)
		for id, t := range healed {
			last[id] = t
		}
		for id, t := range last {
			if now.Sub(t) > 7*24*time.Hour {
				delete(last, id)
			}
		}
		data, _ := json.MarshalIndent(last, "", "  ")
		return append(data, '\n'), true
	})
	if err != nil {
		h.ui.Warn("watchdog: couldn't note the restarts: %v", err)
	}
}

// ranThisWeek says whether id passed a watchdog check on a kept day.
func ranThisWeek(state health.State, id string) bool {
	for _, c := range state.Days[id] {
		if c[0] > 0 {
			return true
		}
	}
	return false
}
