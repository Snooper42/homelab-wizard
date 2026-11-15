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

// Explain these logs from a phone (item 4 of apple-loop.md): never on a wall
// screen, which anyone walking past could set the computer's model working
// with; only for an app the homelab runs in a container; not for a household
// member's phone (member_test.go). Each is refused before the log is read or
// the model is asked.
func TestPhoneExplainLogsChecksTheDevice(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-ntfy-1", Image: "binwiederhier/ntfy", Running: true, Project: "homelab_security", Service: "ntfy"},
	})
	t.Setenv(asCLI, "1")
	root, _ := repoCopy(t, "NTFY_PORT=1")
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	m, ok := h.phoneMethods()["ExplainLogs"]
	if !ok {
		t.Fatal("no ExplainLogs")
	}
	if m.Member {
		t.Error("ExplainLogs answers a member's phone")
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
