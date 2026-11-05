package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
	"github.com/Snooper42/homelab-wizard/internal/stopped"
	"github.com/Snooper42/homelab-wizard/internal/updates"
)

// A restart that keeps failing: Docker's restart policy starts an app that
// stops on its own again, forever. One it restarted loopRestarts times in
// loopWithin, and still not settled, is stopped instead, kept as stopped by
// the watchdog (data/stopped.json, so nothing starts it by itself), and
// alerted with its last log lines. Starting it again, from Status or homelab
// start, forgets that. AUTO_HEAL=false leaves it to Docker, as it leaves the
// watchdog's restarts.
const (
	loopRestarts = 3
	loopWithin   = time.Hour
	// loopLines is how much of its log the alert carries.
	loopLines = 10
)

// restartsPath keeps each app's restart count as the watchdog saw it, over
// the last loopWithin.
func restartsPath(root string) string { return filepath.Join(root, "data", "restarts.json") }

// restartSeen is an app's container's restart count at one watchdog run.
type restartSeen struct {
	At    time.Time `json:"at"`
	Count int       `json:"count"`
}

// restartsWithin adds count at now to what was seen of one container, and
// says how many times Docker restarted it within loopWithin: the rise from
// the lowest count seen in that time. A count lower than one seen before is a
// new container (made again by an update or homelab up), which starts from
// nothing.
func restartsWithin(seen []restartSeen, count int, now time.Time) (n int, kept []restartSeen) {
	for _, s := range seen {
		if now.Sub(s.At) <= loopWithin && s.Count <= count {
			kept = append(kept, s)
		}
	}
	kept = append(kept, restartSeen{At: now, Count: count})
	low := count
	for _, s := range kept {
		low = min(low, s.Count)
	}
	return count - low, kept
}

// settled says a container is well for now: running, not between restarts,
// its health check not failing or still deciding, and up a minute. One that
// restarted a few times while its database started and runs since is left.
func settled(c docker.Container, now time.Time) bool {
	return c.Running && c.State != "restarting" && c.Health != "unhealthy" && c.Health != "starting" && now.Sub(c.StartedAt) > time.Minute
}

// stopRestartLoops stops the apps in a crash loop and returns the IDs it
// stopped, with a few lines for the alert on each. Apps stopped on purpose
// already, and apps updated lately (the rollback decides), are left.
func (h *homelab) stopRestartLoops(ctx context.Context, client *docker.Client, containers []docker.Container, env map[string]string, now time.Time) (ids []string, lines []string) {
	if strings.EqualFold(env["AUTO_HEAL"], "false") {
		return nil, nil
	}
	path := restartsPath(h.root)
	seen := map[string][]restartSeen{}
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &seen)
	}
	held := stopped.Load(stopped.Path(h.root))
	hist := updates.LoadHistory(updates.HistoryPath(h.root))
	rollback := !strings.EqualFold(env["AUTO_ROLLBACK"], "false")
	report := detect.Analyze(h.catalog, containers)
	next := map[string][]restartSeen{}
	counts := map[string]int{}
	for _, a := range h.catalog.Apps {
		st, m := report.State(a.ID)
		if st != detect.Running || m == nil || m.How != detect.ByLabel || m.Container.RestartPolicy == "no" {
			continue
		}
		n, kept := restartsWithin(seen[a.ID], m.Container.Restarts, now)
		next[a.ID] = kept
		if n < loopRestarts || settled(m.Container, now) || held.Has(a.ID) {
			continue
		}
		if r := hist.Apps[a.ID]; rollback && r != nil && r.Previous != "" && now.Sub(r.Updated) <= updates.Watch {
			continue // the rollback decides
		}
		counts[a.ID] = n
	}
	var loops []*catalog.App
	for _, a := range h.catalog.Apps {
		if _, ok := counts[a.ID]; ok {
			loops = append(loops, a)
		}
	}
	for _, pa := range h.byProject(loops) {
		for _, id := range pa.ids {
			a, _ := h.catalog.Get(id)
			_, m := report.State(id)
			tail := h.lastLogLines(ctx, client, m.Container.Name)
			if err := client.Compose(ctx, h.project(pa.file), pa.profiles, "stop", id); err != nil {
				h.ui.Warn("stop %s, which keeps restarting: %v", id, err)
				continue
			}
			n := counts[id]
			err := stopped.Update(stopped.Path(h.root), func(r stopped.Record) bool {
				r[id] = stopped.Stop{Since: now.Truncate(time.Second), Why: stopped.KeptRestarting, Restarts: n}
				return true
			})
			if err != nil {
				h.ui.Warn("could not keep that %s was stopped: %v", id, err)
			}
			delete(next, id)
			h.ui.Warn("stopped %s: Docker restarted it %d times in an hour", a.Name(), n)
			if tail != "" {
				h.ui.Printf("%s\n", indent(tail, "    "))
			}
			line := fmt.Sprintf("%s restarted %d times in an hour, so the watchdog stopped it.", a.Name(), n)
			if tail != "" {
				line += " Its last lines:\n" + tail
			}
			ids = append(ids, id)
			lines = append(lines, line)
		}
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err == nil {
		data, _ := json.MarshalIndent(next, "", "  ")
		_ = os.WriteFile(path, append(data, '\n'), 0o644)
	}
	return ids, lines
}

// lastLogLines is the end of a container's log, both its streams, each line
// cut to a phone's width, with the homelab's secrets taken out.
func (h *homelab) lastLogLines(ctx context.Context, client *docker.Client, name string) string {
	lctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	out, err := procattr.Hide(exec.CommandContext(lctx, client.Bin, "logs", "--tail", fmt.Sprint(loopLines), name)).CombinedOutput()
	if err != nil && len(out) == 0 {
		return ""
	}
	var lines []string
	for _, l := range strings.Split(strings.TrimRight(redact(string(out), h.secretValues()), "\n"), "\n") {
		if l = strings.TrimSpace(l); l == "" {
			continue
		}
		if r := []rune(l); len(r) > 160 {
			l = string(r[:159]) + "…"
		}
		lines = append(lines, l)
	}
	return strings.Join(lines, "\n")
}

// indent puts pre before each line of s.
func indent(s, pre string) string { return pre + strings.ReplaceAll(s, "\n", "\n"+pre) }
