package api

import (
	"context"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

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
