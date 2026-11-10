package api

import (
	"context"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/applist"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
)

func TestStatusLeavesOutTheCompanionWhenOff(t *testing.T) {
	_, file, _, _ := runtime.Caller(0)
	c, err := catalog.Load(filepath.Join(filepath.Dir(file), "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	listed := func(env map[string]string) bool {
		for _, a := range StatusOf(context.Background(), c, nil, env, false).Apps {
			if a.ID == "homelab-companion" {
				return true
			}
		}
		return false
	}
	if !listed(map[string]string{"PHONE_COMPANION": "true"}) {
		t.Error("the companion is missing while on")
	}
	if listed(map[string]string{"PHONE_COMPANION": "false"}) {
		t.Error("the companion is listed while off")
	}
}

// Pinned apps are marked, and listed in the order they were pinned; one
// not in the catalog (gone since) is left out.
func TestStatusPinned(t *testing.T) {
	_, file, _, _ := runtime.Caller(0)
	c, err := catalog.Load(filepath.Join(filepath.Dir(file), "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	st := StatusOf(context.Background(), c, nil, map[string]string{PinnedKey: "vikunja,gone,vaultwarden"}, false)
	if got := strings.Join(st.Pinned, ","); got != "vikunja,vaultwarden" {
		t.Fatalf("pinned %q", got)
	}
	for _, a := range st.Apps {
		if a.Pinned != (a.ID == "vikunja" || a.ID == "vaultwarden") {
			t.Errorf("%s pinned %v", a.ID, a.Pinned)
		}
	}
}

// A public app says how it may be reached once the domain has the tunnel:
// away from home, or home only when the household keeps it so; ntfy only
// once its publishers use a token, and no other app at all.
func TestStatusReach(t *testing.T) {
	_, file, _, _ := runtime.Caller(0)
	c, err := catalog.Load(filepath.Join(filepath.Dir(file), "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	c.Root = t.TempDir()
	if err := applist.HomeOnly.Set(c.Root, "paperless", true); err != nil {
		t.Fatal(err)
	}
	reach := func(env map[string]string) map[string]string {
		out := map[string]string{}
		for _, a := range StatusOf(context.Background(), c, nil, env, false).Apps {
			out[a.ID] = a.Reach
		}
		return out
	}
	tunnel := map[string]string{"HOMELAB_DOMAIN": "example.com", "TUNNEL_TOKEN": "t"}
	got := reach(tunnel)
	for id, want := range map[string]string{"immich-server": "away", "paperless": "home", "vaultwarden": "away", "ntfy": "", "sonarr": "", "uptime-kuma": ""} {
		if got[id] != want {
			t.Errorf("%s: %q, want %q", id, got[id], want)
		}
	}
	tunnel["NTFY_PUBLISH_TOKEN"] = "p"
	if r := reach(tunnel)["ntfy"]; r != "away" {
		t.Errorf("ntfy with its token: %q", r)
	}
	if r := reach(map[string]string{"HOMELAB_DOMAIN": "example.com"})["immich-server"]; r != "" {
		t.Errorf("without the tunnel, no switch: %q", r)
	}
}
