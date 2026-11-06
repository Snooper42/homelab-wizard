package main

import (
	"context"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/claim"
	"github.com/Snooper42/homelab-wizard/internal/compose"
	"github.com/Snooper42/homelab-wizard/internal/ports"
)

// A public app that its first visitor would own goes through the tunnel
// only once it has its first account (internal/claim, N19).

// mayPublish says whether a running public app goes through the tunnel
// now, and if not, why.
func (h *homelab) mayPublish(ctx context.Context, a *catalog.App, env map[string]string) (bool, string) {
	if !publishable(a.ID, a.Public(), env) {
		return false, ""
	}
	lookup := compose.MapLookup(env)
	ok, why := claim.Claimed(ctx, a.ID, ports.WebURL(a, ports.AppBindings(a, lookup), lookup))
	if !ok {
		return false, a.Name() + " stays off the internet until it has its first account: " + why + ". Open it at home (or on the tailnet) and make it, then Set up the domain again"
	}
	return true, ""
}
