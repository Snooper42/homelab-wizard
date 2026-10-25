package api

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/diskspace"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/ports"
	"github.com/Snooper42/homelab-wizard/internal/savings"
	"github.com/Snooper42/homelab-wizard/internal/tailnet"
	"github.com/Snooper42/homelab-wizard/internal/updates"
)

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
	if c.Root != "" {
		hist = updates.LoadHistory(updates.HistoryPath(c.Root))
	}
	held := map[string]bool{}
	for _, id := range updates.Held(env) {
		held[id] = true
	}
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
			case detect.Stopped:
				s.State = "stopped"
				s.WaitingFor = diskspace.MissingDrive(m.Container.Binds)
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
