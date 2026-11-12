package main

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/ui"
	"github.com/Snooper42/homelab-wizard/internal/updates"
)

// Items 87 and 88, the owner's decision: Vaultwarden, Pocket ID and
// CrowdSec wait out a new release's first days in the nightly updates; an
// app with no hold, one whose image here is the newest, and one whose
// digest can't be read go ahead as before.
func TestTheNightlyUpdateHoldsANewRelease(t *testing.T) {
	t.Setenv(asCLI, "1")
	root, _ := repoCopy(t)
	var out strings.Builder
	h, err := newHomelab(&ui.UI{Out: &out}, root)
	if err != nil {
		t.Fatal(err)
	}
	for _, id := range []string{"vaultwarden", "pocket-id", "crowdsec"} {
		if a, ok := h.catalog.Get(id); !ok || a.Meta.Hold != 3 {
			t.Errorf("%s has no 3-day hold", id)
		}
	}
	get := func(id string) *catalog.App { a, _ := h.catalog.Get(id); return a }
	f := &docker.FakeRunner{
		Registry: map[string]string{
			"vaultwarden/server:latest":      "sha256:new",
			"ghcr.io/pocket-id/pocket-id:v2": "sha256:same",
		},
		RepoDigests: map[string][]string{
			"vaultwarden/server:latest":      {"vaultwarden/server@sha256:old"},
			"ghcr.io/pocket-id/pocket-id:v2": {"ghcr.io/pocket-id/pocket-id@sha256:same"},
		},
	}
	client := &docker.Client{Runner: f, Bin: "docker"}
	apps := []*catalog.App{get("vaultwarden"), get("pocket-id"), get("crowdsec"), get("ntfy")}
	kept := h.holdNew(context.Background(), client, apps)
	var ids []string
	for _, a := range kept {
		ids = append(ids, a.ID)
	}
	// Vaultwarden's new release waits; Pocket ID has nothing new; CrowdSec's
	// digest couldn't be read, so it goes as before; ntfy has no hold.
	if strings.Join(ids, " ") != "pocket-id crowdsec ntfy" {
		t.Fatalf("tonight's updates: %v\n%s", ids, out.String())
	}
	if !strings.Contains(out.String(), "Vaultwarden: a new release came out; it waits until") || !strings.Contains(out.String(), "homelab update vaultwarden takes it now") {
		t.Errorf("said:\n%s", out.String())
	}
	if !strings.Contains(out.String(), "could not read how new its newest image is, so it updates now") {
		t.Errorf("CrowdSec's unread digest not said:\n%s", out.String())
	}
	for _, call := range f.Calls {
		if strings.HasPrefix(call, "pull") {
			t.Errorf("pulled while holding: %s", call)
		}
	}
	holds := updates.LoadHolds(updates.HoldPath(root))
	if w, ok := holds["vaultwarden"]; !ok || w.Digest != "sha256:new" || time.Since(w.Seen) > time.Minute {
		t.Errorf("Vaultwarden's wait not kept: %+v", holds)
	}
	if _, ok := holds["pocket-id"]; ok {
		t.Error("Pocket ID waits for nothing")
	}
}
