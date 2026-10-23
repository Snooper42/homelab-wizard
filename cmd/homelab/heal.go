package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/health"
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
// Apps updated lately are left to the rollback. It returns a line per app
// restarted, for the alert. AUTO_HEAL=false turns it off.
func (h *homelab) heal(ctx context.Context, client *docker.Client, unwell []string, state health.State, env map[string]string, now time.Time) []string {
	if strings.EqualFold(env["AUTO_HEAL"], "false") || len(unwell) == 0 {
		return nil
	}
	path := healPath(h.root)
	last := map[string]time.Time{}
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &last)
	}
	hist := updates.LoadHistory(updates.HistoryPath(h.root))
	rollback := !strings.EqualFold(env["AUTO_ROLLBACK"], "false")
	var done []string
	for _, id := range unwell {
		a, ok := h.catalog.Get(id)
		if !ok || !state.Confirmed(id) || now.Sub(last[id]) < healEvery {
			continue
		}
		if r := hist.Apps[id]; rollback && r != nil && r.Previous != "" && now.Sub(r.Updated) <= updates.Watch {
			continue // the rollback decides
		}
		for _, pa := range h.byProject([]*catalog.App{a}) {
			if err := client.Compose(ctx, h.project(pa.file), pa.profiles, append([]string{"restart"}, pa.ids...)...); err != nil {
				h.ui.Warn("restart %s: %v", id, err)
				continue
			}
			last[id] = now
			line := a.Name() + " (" + state.Problems[id] + ")"
			h.ui.Info("restarted %s, unwell on two checks in a row", line)
			done = append(done, line)
		}
	}
	for id, t := range last {
		if now.Sub(t) > 7*24*time.Hour {
			delete(last, id)
		}
	}
	if len(done) > 0 {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err == nil {
			data, _ := json.MarshalIndent(last, "", "  ")
			_ = os.WriteFile(path, append(data, '\n'), 0o644)
		}
	}
	return done
}
