package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/crowdsec"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/digest"
	"github.com/Snooper42/homelab-wizard/internal/diskspace"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/notify"
	"github.com/Snooper42/homelab-wizard/internal/savings"
	"github.com/Snooper42/homelab-wizard/internal/setup"
	"github.com/Snooper42/homelab-wizard/internal/upgrade"
)

// digestTopic is where the weekly summary goes: the topic the watchdog
// reports the homelab's health to, so no new subscription is needed.
const digestTopic = "tunnel-watchdog"

// digestCmd shows this week's summary; --send sends it now.
func (h *homelab) digestCmd(ctx context.Context, args []string) error {
	fs := newFlags("digest")
	send := fs.Bool("send", false, "")
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	title, body, problems := h.weekly(ctx)
	if h.ui.JSON && !*send {
		emit(h.ui, "digest", map[string]any{"title": title, "body": body, "problems": problems})
		return nil
	}
	if !*send {
		h.ui.Title(title)
		h.ui.Println(body)
		h.ui.Printf("\n  %s\n", h.ui.Dim("Sent to "+digestTopic+" on Sundays by the nightly backup; --send sends it now."))
		return nil
	}
	if err := h.ntfy().Publish(ctx, digestTopic, h.digestMessage(title, body)); err != nil {
		return err
	}
	h.ui.OK("sent to %s", digestTopic)
	return nil
}

// sendWeekly sends the weekly summary from the nightly backup: on Sundays,
// once.
func (h *homelab) sendWeekly(ctx context.Context) {
	path := filepath.Join(h.logsDir(), "digest.json")
	var state struct {
		LastSent time.Time `json:"lastSent"`
	}
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &state)
	}
	if !digest.Due(time.Now(), state.LastSent) || h.envMap()["NTFY_PUBLISH_TOKEN"] == "" {
		return // not Sunday, sent already, or alerts not set up yet
	}
	title, body, _ := h.weekly(ctx)
	h.ui.Info("sending the weekly summary: %s", title)
	h.alert(ctx, digestTopic, h.digestMessage(title, body))
	state.LastSent = time.Now()
	if data, err := json.Marshal(state); err == nil {
		_ = os.MkdirAll(filepath.Dir(path), 0o755)
		_ = os.WriteFile(path, data, 0o644)
	}
}

func (h *homelab) digestMessage(title, body string) notify.Message {
	m := notify.Message{Title: title, Body: body, Priority: 2, Tags: []string{"house"}}
	if title != "Homelab this week: all well" {
		m.Priority, m.Tags = 3, []string{"house", "eyes"}
	}
	return m
}

// weekly gathers what the summary reads.
func (h *homelab) weekly(ctx context.Context) (title, body string, problems int) {
	env := h.envMap()
	home, _ := os.UserHomeDir()
	in := digest.Input{Now: time.Now(), Currency: savings.Dollars, Disks: checkDisks(diskspace.Locations(h.root, home, env))}
	if drives, err := checkDrives(ctx); err == nil {
		in.Drives = drives
	}
	installed := func(a *catalog.App) bool { return !a.Optional() }
	if client, err := h.docker(ctx); err == nil {
		if containers, err := client.Containers(ctx); err == nil {
			st := api.StatusOf(ctx, h.catalog, containers, env, false)
			in.Status = &st
			report := detect.Analyze(h.catalog, containers)
			if cs, ok := runningContainer(report, crowdsec.App); ok {
				if _, proxy := runningContainer(report, crowdsec.Proxy); proxy {
					run := func(ctx context.Context, args ...string) ([]byte, error) { return client.Exec(ctx, cs.Name, args...) }
					if p, err := crowdsec.Read(ctx, run, time.Now()); err == nil {
						in.Protection = &p
					}
				}
			}
			installed = func(a *catalog.App) bool {
				s, _ := report.State(a.ID)
				return s == detect.Running || s == detect.Stopped
			}
		}
	}
	in.Backups = backup.Read(h.root, backup.SourcesFor(h.catalog, installed), env, time.Now())
	if c, err := h.duplicatiLogin(ctx); err != nil {
		in.JobsErr = err
	} else {
		in.Jobs, in.JobsErr = c.Jobs(ctx, time.Now())
	}
	if c, err := upgrade.Inspect(ctx, h.root, false); err == nil {
		in.Behind = c.Behind
	}
	w := health.LoadState(health.StatePath(h.root)).Summary()
	in.Watchdog = &w
	if since := setup.Started(h.root); !since.IsZero() && time.Since(since) < setup.Grace {
		in.New = true
	}
	return digest.Summary(in)
}
