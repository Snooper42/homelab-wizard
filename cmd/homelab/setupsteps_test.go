package main

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/setup"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// Setup's checklist on the owner's phone (the owner's yes, Nov 19, from the
// mocks canvas): every step's title, why and state, never its commands; the
// phone may do only the steps the homelab runs by itself, and RunSetupStep
// refuses any other, before running anything.
func TestPhoneSetupOffersOnlyWhatRunsByItself(t *testing.T) {
	steps := []setup.Step{
		{ID: "started", Title: "The homelab is started", Why: "w", State: "todo", Run: [][]string{{"up", "--apply"}}, Detail: "on mac-mini.local"},
		{ID: "jobs", Title: "Scheduled jobs", Why: "w", State: "done", Run: [][]string{{"schedule", "install", "--apply"}}},
		{ID: "vaultwarden", Title: "Password manager account", Why: "w", State: "todo", Run: [][]string{{"signups", "open", "--apply"}}},
		{ID: "awake", Title: "This machine stays awake", Why: "w", State: "todo", Run: [][]string{{"awake", "allow", "--apply"}}},
		{ID: "twofactor", Title: "Two-step sign-in", Why: "w", State: "todo", Manual: true},
		{ID: "heartbeat", Title: "Alerts when this machine is down", Why: "w", State: "todo", Later: true},
	}
	got := phoneSetup(steps)
	b, _ := json.Marshal(got)
	if strings.Contains(string(b), "--apply") || strings.Contains(string(b), "mac-mini") {
		t.Fatalf("a step's commands or details sent: %s", b)
	}
	for _, s := range got {
		want := s.ID == "started" // jobs is done; the rest aren't the phone's to run
		if s.ForYou != want {
			t.Errorf("%s: for you %v", s.ID, s.ForYou)
		}
	}
	if !got[5].Later || got[1].State != "done" {
		t.Errorf("states: %+v", got)
	}

	t.Setenv(asCLI, "1")
	root, _ := repoCopy(t, "")
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	methods := h.phoneMethods()
	list, run := methods["Setup"], methods["RunSetupStep"]
	if list.Call == nil || list.Change || !list.Private || list.Member {
		t.Fatalf("Setup: change %v, private %v, member %v", list.Change, list.Private, list.Member)
	}
	if run.Call == nil || !run.Change || run.Member {
		t.Fatalf("RunSetupStep: change %v, member %v", run.Change, run.Member)
	}
	wall := companion.WithCaller(context.Background(), companion.Device{ID: "w1", Name: "Hall screen", Kiosk: true})
	if v, _, err := list.Call(wall, nil); err != nil || v != nil {
		t.Fatalf("a wall screen: %v %v", v, err)
	}
	phone := companion.WithCaller(context.Background(), companion.Device{ID: "p1", Name: "iPhone", CanChange: true})
	for _, id := range []string{"vaultwarden", "awake", "runtime", "tailnet", "tunnel", "nothing", ""} {
		a, _ := json.Marshal(id)
		if _, log, err := run.Call(phone, []json.RawMessage{a}); err == nil || len(log) > 0 {
			t.Errorf("%q: ran %v, %v", id, log, err)
		}
	}
}
