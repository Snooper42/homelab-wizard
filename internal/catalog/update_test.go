package catalog

import (
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/compose"
)

func TestUpdatePolicy(t *testing.T) {
	app := func(image, build, label, pin string) *App {
		s := &compose.Service{ID: "x", Image: image, BuildContext: build, Labels: map[string]string{}}
		if label != "" {
			s.Labels[WatchtowerLabel] = label
		}
		s.Meta.Pin = pin
		return &App{Service: s}
	}
	for _, c := range []struct {
		a        *App
		how, why string
	}{
		{app("vaultwarden/server:latest", "", "true", ""), "nightly", ""},
		{app("", "../dockerfiles/npm", "false", "keeps the bouncer"), "built", "keeps the bouncer"},
		{app("postgres:16", "", "", ""), "manual", "A database or cache: a new major version needs a dump and restore (homelab db upgrade for PostgreSQL, else Runbooks)"},
		{app("docker.io/valkey/valkey:9-alpine", "", "false", ""), "manual", "A database or cache: a new major version needs a dump and restore (homelab db upgrade for PostgreSQL, else Runbooks)"},
		{app("letehaha/budget-tracker-fe:sha-1", "", "false", "pinned to a tested build"), "manual", "pinned to a tested build"},
		{app("someone/app:1.2", "", "", ""), "manual", ""},
		{&App{Service: &compose.Service{ID: "jellyfin"}, native: &compose.Native{}}, "", ""},
	} {
		if how, why := c.a.UpdatePolicy(); how != c.how || why != c.why {
			t.Errorf("%s: %q %q, want %q %q", c.a.Image, how, why, c.how, c.why)
		}
	}
}
