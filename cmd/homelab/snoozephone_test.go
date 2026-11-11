package main

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/notify"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// Snoozing a failing check's alerts from a phone, as the computer's Snooze… does: a change, so only a phone allowed
// to change things may; up to a week; 0 hours wakes it again. What a phone snoozes, Watchdog's snoozed shows.
func TestSnoozeFromAPhone(t *testing.T) {
	fakeDocker(t, nil)
	t.Setenv(asCLI, "1")
	root, _ := repoCopy(t, "")
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	m := h.phoneMethods()["SnoozeCheck"]
	if m.Call == nil || !m.Change || m.Member {
		t.Fatalf("SnoozeCheck is a change, the owner's phones' only: %+v", m)
	}
	ctx := companion.WithCaller(context.Background(), companion.Device{ID: "a1", Name: "Sam's iPhone", CanChange: true})
	args := func(raw ...string) []json.RawMessage {
		out := []json.RawMessage{}
		for _, r := range raw {
			out = append(out, json.RawMessage(r))
		}
		return out
	}
	if _, _, err := m.Call(ctx, args(`"jellyfin"`, `1`)); err != nil {
		t.Fatal(err)
	}
	if !notify.LoadSnoozes(root).Active("jellyfin", time.Now()) {
		t.Fatalf("not snoozed: %v", notify.LoadSnoozes(root))
	}
	if until := notify.LoadSnoozes(root)["jellyfin"]; until.After(time.Now().Add(61 * time.Minute)) {
		t.Errorf("an hour, not until %v", until)
	}
	if _, _, err := m.Call(ctx, args(`"jellyfin"`, `0`)); err != nil {
		t.Fatal(err)
	}
	if notify.LoadSnoozes(root).Active("jellyfin", time.Now().Add(time.Second)) {
		t.Error("0 hours left it snoozed")
	}
	for _, bad := range [][]string{{}, {`"jellyfin"`}, {`""`, `1`}, {`"jellyfin"`, `-1`}, {`"jellyfin"`, `169`}, {`"jellyfin"`, `"1"`}, {`"` + strings.Repeat("a", 200) + `"`, `1`}} {
		if _, _, err := m.Call(ctx, args(bad...)); err == nil {
			t.Errorf("snoozed %v", bad)
		}
	}
}
