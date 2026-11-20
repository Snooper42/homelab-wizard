package main

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// What an update brings, on a phone (apple-loop.md round 33): never on a wall
// screen, never a household member's phone, and only for an app the homelab
// runs in a container. Each is refused before anything is read.
func TestPhoneReleaseNotesChecksTheDevice(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-ntfy-1", Image: "binwiederhier/ntfy", Running: true, Project: "homelab_security", Service: "ntfy"},
	})
	t.Setenv(asCLI, "1")
	root, _ := repoCopy(t, "NTFY_PORT=1")
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	m, ok := h.phoneMethods()["ReleaseNotes"]
	if !ok {
		t.Fatal("no ReleaseNotes")
	}
	if m.Member {
		t.Error("ReleaseNotes answers a member's phone")
	}
	if m.Change {
		t.Error("ReleaseNotes asks for a phone that may change things: what an update brings is for a look-only phone to read too")
	}
	args := func(id string) []json.RawMessage { b, _ := json.Marshal(id); return []json.RawMessage{b} }
	wall := companion.WithCaller(context.Background(), companion.Device{ID: "w1", Name: "Hall screen", Kiosk: true})
	if _, _, err := m.Call(wall, args("ntfy")); err == nil || !strings.Contains(err.Error(), "wall screen") {
		t.Errorf("a wall screen: %v", err)
	}
	phone := companion.WithCaller(context.Background(), companion.Device{ID: "p1", Name: "iPhone"})
	if _, _, err := m.Call(phone, args("nothing-like-it")); err == nil || !strings.Contains(err.Error(), "unknown app") {
		t.Errorf("an unknown app: %v", err)
	}
	if _, _, err := m.Call(phone, nil); err == nil {
		t.Error("no app named: no error")
	}
}
