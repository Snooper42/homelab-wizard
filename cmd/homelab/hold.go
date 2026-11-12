package main

import (
	"context"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/updates"
)

// holdNew leaves out of tonight's updates each app marked hold whose
// registry has an image newer than the one here that came out fewer than
// its days ago (internal/updates Hold), and says until when; the image is
// not pulled, so nothing else starts the app on it meanwhile. An app whose
// newest digest can't be read updates as before, with a warning.
func (h *homelab) holdNew(ctx context.Context, client *docker.Client, apps []*catalog.App) []*catalog.App {
	path := updates.HoldPath(h.root)
	holds := updates.LoadHolds(path)
	lookup := compose.MapLookup(h.envMap())
	now := time.Now()
	var out []*catalog.App
	for _, a := range apps {
		if a.Meta.Hold <= 0 {
			out = append(out, a)
			continue
		}
		ref, err := compose.Interpolate(a.Image, lookup)
		if err != nil || ref == "" {
			out = append(out, a)
			continue
		}
		remote, err := client.RegistryDigest(ctx, ref)
		if err != nil {
			h.ui.Warn("%s: could not read how new its newest image is, so it updates now: %v", a.Name(), err)
			out = append(out, a)
			continue
		}
		local, _ := client.RepoDigests(ctx, ref)
		take, until := holds.Decide(a.ID, a.Meta.Hold, remote, local, now)
		if take {
			out = append(out, a)
			continue
		}
		h.ui.Info("%s: a new release came out; it waits until %s, its first days, before it is installed (homelab updates notes %s has what's new; homelab update %s takes it now)",
			a.Name(), until.Local().Format("Mon, Jan 2"), a.ID, a.ID)
	}
	if err := holds.Save(path); err != nil {
		h.ui.Warn("could not keep the update holds: %v", err)
	}
	return out
}
