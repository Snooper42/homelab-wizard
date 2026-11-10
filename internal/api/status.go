package api

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/applist"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/diskspace"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/notify"
	"github.com/Snooper42/homelab-wizard/internal/ports"
	"github.com/Snooper42/homelab-wizard/internal/savings"
	"github.com/Snooper42/homelab-wizard/internal/started"
	"github.com/Snooper42/homelab-wizard/internal/tailnet"
	"github.com/Snooper42/homelab-wizard/internal/updates"
)

// startedBy is why a running container last started, for "up 9 minutes"
// on hover: what the homelab noted then (data/started.json); an update
// noticed about then; Docker's restart policy after it stopped on its own
// (DockerRestart); or "" when none of them says.
func startedBy(why started.Record, hist updates.History, id string, c docker.Container) string {
	if w := why.Why(id, c.StartedAt); w != "" {
		return w
	}
	if r := hist.Apps[id]; r != nil && !c.StartedAt.IsZero() && !r.Updated.IsZero() {
		if d := r.Updated.Sub(c.StartedAt); d >= -started.Near && d <= updateNoticed {
			return Updated
		}
	}
	if c.Restarts > 0 {
		return DockerRestart
	}
	return ""
}

// StartedBy's own reasons, besides internal/started's: Docker started it
// again by itself after it stopped on its own (its restart policy); or an
// update the homelab noticed about then, by whoever made it.
const (
	DockerRestart = "docker"
	Updated       = "update"
)

// updateNoticed is how long after a container starts its update may be
// noticed (the next look at the images) and still be why it started.
const updateNoticed = 30 * time.Minute

// StatusOf is the state of every app, given the running containers and the
// .env settings; helpers only with all. Optional apps that were never
// installed are left out.
func StatusOf(ctx context.Context, c *catalog.Catalog, containers []docker.Container, env map[string]string, all bool) Status {
	return statusOf(ctx, c, containers, env, all, true)
}

// StatusRemembered is StatusOf without waiting for the apps' pages: it uses
// the answers kept from the last few seconds and sets Checking when some
// app is still to be asked (Probe), so a screen can show the rest at once.
func StatusRemembered(ctx context.Context, c *catalog.Catalog, containers []docker.Container, env map[string]string, all bool) Status {
	return statusOf(ctx, c, containers, env, all, false)
}

func statusOf(ctx context.Context, c *catalog.Catalog, containers []docker.Container, env map[string]string, all, ask bool) Status {
	st := Status{Apps: []AppStatus{}}
	report := detect.Analyze(c, containers)
	lookup := compose.MapLookup(env)
	domainName := env["HOMELAB_DOMAIN"]
	tailHost, tailAddress := env["TAILSCALE_HOST"], map[string]string{}
	if domainName == "" && tailHost != "" {
		for _, r := range tailnet.Routes(c.Apps, lookup) {
			tailAddress[r.App.ID] = tailnet.Address(tailHost, r.Port)
		}
	}
	// What updates left to go back to, and which are held.
	hist := updates.History{}
	why := started.Record{}             // why the homelab last started each app
	days := map[string][]time.Weekday{} // each app's update days, when not every night
	if c.Root != "" {
		hist = updates.LoadHistory(updates.HistoryPath(c.Root))
		why = started.Load(started.Path(c.Root))
		days = updates.LoadDays(updates.DaysPath(c.Root))
	}
	held := map[string]bool{}
	for _, id := range updates.Held(env) {
		held[id] = true
	}
	pinned := map[string]bool{}
	for _, id := range Pinned(c.Root, env) {
		if _, ok := c.Get(id); ok {
			pinned[id] = true
			st.Pinned = append(st.Pinned, id)
		}
	}
	quiet := map[string]bool{}
	for _, id := range notify.LoadQuiet(c.Root, env) {
		quiet[id] = true
	}
	// A public app may be reached away from home once the domain has the
	// Cloudflare tunnel; the household keeps some home only.
	homeOnly := map[string]bool{}
	for _, id := range applist.HomeOnly.Load(c.Root, nil) {
		homeOnly[id] = true
	}
	tunnel := domainName != "" && env["TUNNEL_TOKEN"] != ""
	for _, a := range c.Apps {
		if a.Internal() && !all {
			continue
		}
		s := AppStatus{ID: a.ID, Name: a.Name()}
		if n := a.Native(); n != nil {
			// The phone companion, turned off in Settings: nothing to show.
			if a.ID == "homelab-companion" && strings.EqualFold(env["PHONE_COMPANION"], "false") {
				continue
			}
			s.State, s.Health = "not running", "native"
			if NativeUp(ctx, n.Port) {
				s.State = "running"
			} else if !NativeInstalled(n) {
				continue // not on this machine: nothing to show
			}
		} else {
			state, m := report.State(a.ID)
			switch state {
			case detect.Running:
				s.State, s.Health = "running", m.Container.Health
				// Docker counts a container waiting to be restarted as running.
				if m.Container.State == "restarting" {
					s.Health = "restarting"
				}
				if !m.Container.StartedAt.IsZero() {
					s.Since = m.Container.StartedAt.UTC().Format(time.RFC3339)
				}
				s.Restarts = m.Container.Restarts
				s.StartedBy = startedBy(why, hist, a.ID, m.Container)
			case detect.Stopped:
				s.State = "stopped"
				s.WaitingFor = diskspace.MissingDrive(m.Container.Binds)
				if !m.Container.FinishedAt.IsZero() {
					s.StoppedAt = m.Container.FinishedAt.UTC().Format(time.RFC3339)
				}
				if s.WaitingFor == "" {
					s.StoppedWhy = StoppedWhy(m.Container)
				}
			case detect.External:
				s.State, s.Container = "elsewhere", m.Container.Name
			default:
				if a.Optional() {
					continue
				}
				s.State = "missing"
				st.Missing++
			}
		}
		if domainName != "" && a.HasWeb() && !a.Internal() && !a.Local() {
			s.Address = a.Subdomain() + "." + domainName
		}
		if domainName == "" && tailHost != "" {
			s.Address = tailAddress[a.ID] // Home mode: on the tailnet
		}
		s.URL = ports.WebURL(a, ports.AppBindings(a, lookup), lookup)
		if r := hist.Apps[a.ID]; r != nil && r.Previous != "" {
			s.UpdatedAt = r.Updated.UTC().Format(time.RFC3339)
		}
		s.Held = held[a.ID]
		s.UpdateDays = updates.DayNames(days[a.ID])
		s.Quiet = quiet[a.ID]
		s.Pinned = pinned[a.ID]
		if tunnel && a.Public() && (a.ID != "ntfy" || env["NTFY_PUBLISH_TOKEN"] != "") {
			s.Reach = map[bool]string{true: "home", false: "away"}[homeOnly[a.ID]]
		}
		st.Apps = append(st.Apps, s)
	}
	if ask {
		probe(ctx, st.Apps, time.Now())
	} else {
		st.Checking = remembered(st.Apps, time.Now())
	}
	st.Unmatched = len(report.Unmatched)
	running := map[string]bool{}
	for _, s := range st.Apps {
		running[s.ID] = s.State == "running"
	}
	// Helpers are left out of Apps without all, so ask the report for them.
	st.Savings = savings.Annual(c, func(id string) bool {
		if r, ok := running[id]; ok {
			return r
		}
		state, _ := report.State(id)
		return state == detect.Running
	})
	st.Updates = updates.Get(env)
	return st
}

// NativeUp checks a native app's local port.
func NativeUp(ctx context.Context, port int) bool {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("http://127.0.0.1:%d/", port), nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return true
}

// portTaken finds the port in Docker's error when another program has it:
// "Bind for 0.0.0.0:9925 failed: port is already allocated", "listen tcp
// 0.0.0.0:9925: bind: address already in use", or Docker 29's "failed to
// bind host port 0.0.0.0:9925/tcp: address already in use".
var portTaken = regexp.MustCompile(`:(\d+)(?:/(?:tcp|udp))?(?: failed)?: (?:bind: )?(?:address already in use|port is already allocated)`)

// StoppedWhy says in a few words why a stopped container stopped, when
// Docker knows: "it ran out of memory", "another program is using its port
// 9925", "Docker couldn't start it", or "it quit with an error". It is ""
// for one stopped cleanly (by hand, or by a shutdown), which needs no look.
func StoppedWhy(c docker.Container) string {
	switch {
	case c.OOMKilled:
		return "it ran out of memory"
	case c.Error != "":
		if m := portTaken.FindStringSubmatch(c.Error); m != nil {
			return "another program is using its port " + m[1]
		}
		return "Docker couldn't start it"
	}
	switch c.ExitCode {
	case 0, 137, 143: // it finished, or was stopped (docker stop, a shutdown)
		return ""
	}
	return "it quit with an error"
}
