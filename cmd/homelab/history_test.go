package main

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/history"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// TestHistoryRecordsWhatWasDone (unison-handoff.md section 4, item 4): a
// restart from this computer, and from a phone (its own process, named by
// HOMELAB_ACTOR as runSelf sets it), each read back as a line with who did
// it; homelab history shows them.
func TestHistoryRecordsWhatWasDone(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_media_automation-sonarr-1", Image: "lscr.io/linuxserver/sonarr", Running: true, Project: "homelab_media_automation", Service: "sonarr"},
	})
	root, _ := repoCopy(t)
	if out, code := homelabCmd(t, root, "", "restart", "sonarr"); code != 0 {
		t.Fatalf("restart (exit %d):\n%s", code, out)
	}
	t.Setenv(actorEnv, "Sam's iPhone")
	if out, code := homelabCmd(t, root, "", "stop", "sonarr"); code != 0 {
		t.Fatalf("stop (exit %d):\n%s", code, out)
	}
	got, err := history.List(root, history.Filter{})
	if err != nil || len(got) != 2 {
		t.Fatalf("history: %+v %v", got, err)
	}
	if got[0].Text != "Stopped Sonarr" || got[0].Who != "Sam's iPhone" || got[0].App != "sonarr" ||
		got[1].Text != "Restarted Sonarr" || got[1].Who != history.ThisComputer {
		t.Fatalf("history: %+v", got)
	}
	t.Setenv(actorEnv, "")
	out, code := homelabCmd(t, root, "", "history", "--app", "sonarr")
	if code != 0 || !strings.Contains(out, "Stopped Sonarr  (Sam's iPhone)") || !strings.Contains(out, "Restarted Sonarr  (this computer)") {
		t.Fatalf("homelab history (exit %d):\n%s", code, out)
	}
}

// A phone's settings are named, never their values; its History is
// redacted; a member's Finances are never recorded.
func TestHistoryFromAPhone(t *testing.T) {
	fakeDocker(t, nil)
	t.Setenv(asCLI, "1")
	root, _ := repoCopy(t, "NTFY_PUBLISH_TOKEN=tk_supersecretvalue123")
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	ctx := companion.WithCaller(context.Background(), companion.Device{ID: "a1", Name: "Sam's iPhone", CanChange: true})
	if whoAsked(ctx) != "Sam's iPhone" || whoAsked(context.Background()) != history.ThisComputer {
		t.Fatal("who asked")
	}
	methods := h.phoneMethods()
	arg, _ := json.Marshal(map[string]string{"QUIET_HOURS": "23-7"})
	if _, _, err := methods["SaveSettings"].Call(ctx, []json.RawMessage{arg}); err != nil {
		t.Fatal(err)
	}
	got, _ := history.List(root, history.Filter{})
	if len(got) != 1 || got[0].Text != "Changed settings: QUIET_HOURS" || got[0].Who != "Sam's iPhone" || strings.Contains(got[0].Text, "23-7") {
		t.Fatalf("settings: %+v", got)
	}
	h.recordFinances(root+"/members/sam", "Sam's iPhone", "Changed the Finances plan")
	h.recordFinances(root, "Sam's iPhone", "Changed Finances' transactions")
	if got, _ := history.List(root, history.Filter{Search: "Finances"}); len(got) != 1 || got[0].Text != "Changed Finances' transactions" {
		t.Fatalf("Finances: %+v", got)
	}
	// What a phone reads has no secret in it, whatever a line carried.
	h.record("restart", "ntfy", history.ThisComputer, "Restarted ntfy with tk_supersecretvalue123")
	v, _, err := methods["History"].Call(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	read, _ := json.Marshal(v)
	if strings.Contains(string(read), "supersecretvalue") || !strings.Contains(string(read), "Restarted ntfy") {
		t.Fatalf("the phone's History: %s", read)
	}
	if m := methods["History"]; m.Change || m.Member {
		t.Fatalf("History is the owner's phones', to look at: %+v", m)
	}
	// A wall screen, which anyone walking past can read, doesn't get it.
	wall := companion.WithCaller(context.Background(), companion.Device{ID: "w1", Name: "Kitchen", Kiosk: true})
	if v, _, err := methods["History"].Call(wall, nil); err == nil {
		t.Fatalf("a wall screen read what was done: %v", v)
	}
}
