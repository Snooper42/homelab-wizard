package main

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/crowdsec"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/diskspace"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/host"
)

// installJobs installs the scheduled jobs; tests replace it so they never
// touch this machine's scheduler.
var installJobs = func(ctx context.Context, h *homelab) error {
	return h.schedule(ctx, []string{"install", "--apply"})
}

// fixWait is how long fix gives the runtime to start and a restarted app
// to come back; tests shorten it.
var fixWait = 90 * time.Second

// fix repairs what usually goes wrong, in order: the container runtime not
// running, baseline apps down, apps unhealthy or crash-looping (restarted,
// then recreated), unused images filling a low disk, and scheduled jobs
// missing. It shows the plan first; nothing is deleted but unused images.
func (h *homelab) fix(ctx context.Context, args []string) error {
	fs := newFlags("fix")
	apply := applyFlag(fs)
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	u := h.ui
	u.Title("Fix it")

	if _, err := h.docker(ctx); err != nil {
		u.Warn("%s is not running", h.host.Runtime)
		if err := h.goAhead(*apply, "Start "+h.host.Runtime+"?"); err != nil {
			return err
		}
		if err := host.StartRuntime(h.host); err != nil {
			return fmt.Errorf("start %s: %w (%s)", h.host.Runtime, err, h.host.StartRuntime)
		}
		if !h.waitRuntime(ctx) {
			return fmt.Errorf("%s did not start within %s: %s", h.host.Runtime, fixWait, h.host.StartRuntime)
		}
		u.OK("%s is running", h.host.Runtime)
		*apply = true // they said yes to fixing
	}

	st, err := h.statusOf(ctx, false)
	if err != nil {
		return err
	}
	var down, unwell []*catalog.App
	for _, s := range st.Apps {
		a, ok := h.catalog.Get(s.ID)
		if !ok || a.Native() != nil {
			continue
		}
		switch {
		case s.State == "running" && (s.Health == "unhealthy" || s.Health == "restarting"):
			unwell = append(unwell, a)
		case !a.Optional() && s.State != "running" && s.State != "elsewhere":
			down = append(down, a)
		}
	}
	home, _ := os.UserHomeDir()
	low := anyLow(checkDisks(diskspace.Locations(h.root, home, h.envMap())))
	var jobsMissing []string
	if l, err := h.scheduler(); err == nil {
		for _, j := range jobs() {
			if !l.Status(j.Label).Loaded {
				jobsMissing = append(jobsMissing, j.Label)
			}
		}
	}

	// The proxy no longer pulling CrowdSec's bans (a rejected key, or a
	// bouncer that stopped after CrowdSec restarted).
	bouncer := false
	if client, err := h.docker(ctx); err == nil {
		if containers, err := client.Containers(ctx); err == nil {
			checked, ok, _ := crowdsecBouncer(ctx, client, detect.Analyze(h.catalog, containers), time.Now())
			bouncer = checked && !ok
		}
	}

	var plan []string
	if len(down) > 0 {
		plan = append(plan, "start the baseline apps that are down: "+names(down))
	}
	if len(unwell) > 0 {
		plan = append(plan, "restart the apps that are unwell, and recreate any that stay unwell: "+names(unwell))
	}
	if bouncer {
		plan = append(plan, "reconnect the proxy to CrowdSec, so its bans are enforced again (CrowdSec and Nginx Proxy Manager restart)")
	}
	if low {
		plan = append(plan, "free space by removing unused images and build cache (no data, no running app)")
	}
	if len(jobsMissing) > 0 {
		plan = append(plan, "install the scheduled jobs that are missing: "+strings.Join(jobsMissing, ", "))
	}
	if len(plan) == 0 {
		u.OK("nothing to fix: every baseline app is running and well, there is room on the disks, and the jobs are installed")
		return nil
	}
	for _, p := range plan {
		u.Info("%s", p)
	}
	if err := h.goAhead(*apply, "\nFix these?"); err != nil {
		return err
	}

	client, err := h.docker(ctx)
	if err != nil {
		return err
	}
	if len(down) > 0 {
		if err := h.up(ctx, []string{"--apply"}); err != nil {
			u.Warn("homelab up: %v", err)
		}
	}
	for _, pa := range h.byProject(unwell) {
		p := h.project(pa.file)
		if err := client.Compose(ctx, p, pa.profiles, append([]string{"restart"}, pa.ids...)...); err != nil {
			u.Warn("restart %s: %v", strings.Join(pa.ids, ", "), err)
		}
	}
	if len(unwell) > 0 {
		still := h.stillUnwell(ctx, unwell)
		for _, pa := range h.byProject(still) {
			p := h.project(pa.file)
			u.Info("still unwell after a restart, recreating: %s", strings.Join(pa.ids, ", "))
			if err := client.Compose(ctx, p, pa.profiles, append([]string{"up", "--detach", "--force-recreate", "--no-deps"}, pa.ids...)...); err != nil {
				u.Warn("recreate %s: %v", strings.Join(pa.ids, ", "), err)
			}
		}
		if still = h.stillUnwell(ctx, still); len(still) > 0 {
			u.Warn("still unwell: %s. Its log usually says why (homelab logs %s); make a report (homelab report) to ask for help", names(still), still[0].ID)
		}
	}
	if bouncer {
		h.reconnectBouncer(ctx, client)
	}
	if low {
		for _, args := range [][]string{{"image", "prune", "--force"}, {"builder", "prune", "--force"}} {
			if out, err := client.Runner.Output(ctx, client.Bin, args...); err != nil {
				u.Warn("docker %s: %v", strings.Join(args, " "), err)
			} else if s := strings.TrimSpace(string(out)); s != "" {
				u.Info("%s", lastLine(s))
			}
		}
	}
	if len(jobsMissing) > 0 {
		if err := installJobs(ctx, h); err != nil {
			u.Warn("homelab schedule install: %v", err)
		}
	}
	u.OK("done; homelab doctor checks the rest")
	return nil
}

// reconnectBouncer removes the proxy's bouncer from CrowdSec, which
// registers it again from CROWDSEC_BOUNCER_KEY when it restarts, then
// restarts the proxy so it pulls the bans afresh.
func (h *homelab) reconnectBouncer(ctx context.Context, client *docker.Client) {
	u := h.ui
	if containers, err := client.Containers(ctx); err == nil {
		if ctr, ok := runningContainer(detect.Analyze(h.catalog, containers), crowdsec.App); ok {
			_, _ = client.Exec(ctx, ctr.Name, "cscli", "bouncers", "delete", crowdsec.ProxyBouncer)
		}
	}
	for _, id := range []string{crowdsec.App, crowdsec.Proxy} {
		a, ok := h.catalog.Get(id)
		if !ok {
			continue
		}
		for _, pa := range h.byProject([]*catalog.App{a}) {
			if err := client.Compose(ctx, h.project(pa.file), pa.profiles, append([]string{"restart"}, pa.ids...)...); err != nil {
				u.Warn("restart %s: %v", id, err)
			}
		}
	}
	u.Info("the proxy reconnects to CrowdSec within a minute; Status › Protection shows it")
}

// stillUnwell waits up to fixWait for the apps to come back well and
// returns those that have not.
func (h *homelab) stillUnwell(ctx context.Context, apps []*catalog.App) []*catalog.App {
	deadline := time.Now().Add(fixWait)
	for {
		st, err := h.statusOf(ctx, false)
		var bad []*catalog.App
		if err == nil {
			byID := map[string]api.AppStatus{}
			for _, s := range st.Apps {
				byID[s.ID] = s
			}
			for _, a := range apps {
				s := byID[a.ID]
				if s.State != "running" || s.Health == "unhealthy" || s.Health == "restarting" {
					bad = append(bad, a)
				}
			}
		}
		if len(bad) == 0 || time.Now().After(deadline) {
			return bad
		}
		select {
		case <-ctx.Done():
			return bad
		case <-time.After(5 * time.Second):
		}
	}
}

// waitRuntime waits up to fixWait for the runtime to answer.
func (h *homelab) waitRuntime(ctx context.Context) bool {
	deadline := time.Now().Add(fixWait)
	for time.Now().Before(deadline) {
		h.client = nil
		if _, err := h.docker(ctx); err == nil {
			return true
		}
		select {
		case <-ctx.Done():
			return false
		case <-time.After(3 * time.Second):
		}
	}
	return false
}

func names(apps []*catalog.App) string {
	var n []string
	for _, a := range apps {
		n = append(n, a.Name())
	}
	return strings.Join(n, ", ")
}

func lastLine(s string) string {
	lines := strings.Split(s, "\n")
	return lines[len(lines)-1]
}
