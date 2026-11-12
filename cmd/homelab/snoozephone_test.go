package main

import (
	"context"
	"encoding/json"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/health"
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
	failing(t, root, "jellyfin")
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

// A phone snoozes a check the watchdog has (N42): one failing now, one
// that failed once and is checked again, or one already snoozed (to wake
// it). A name the watchdog never gave, an app that is fine, is refused, so
// a phone allowed changes can't fill the snoozes with made-up names.
func TestPhoneSnoozesOnlyTheWatchdogsChecks(t *testing.T) {
	fakeDocker(t, nil)
	t.Setenv(asCLI, "1")
	root, _ := repoCopy(t, "")
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	failing(t, root, "jellyfin")
	if err := health.UpdateState(health.StatePath(root), func(s *health.State) { s.Pending = map[string]int{"immich": 1} }); err != nil {
		t.Fatal(err)
	}
	if err := notify.SnoozeHours(root, "disk /", 2); err != nil {
		t.Fatal(err)
	}
	m := h.phoneMethods()["SnoozeCheck"]
	ctx := companion.WithCaller(context.Background(), companion.Device{ID: "a1", Name: "Sam's iPhone", CanChange: true})
	call := func(check string, hours int) error {
		c, _ := json.Marshal(check)
		_, _, err := m.Call(ctx, []json.RawMessage{c, json.RawMessage(strconv.Itoa(hours))})
		return err
	}
	for _, ok := range []string{"jellyfin", "immich"} {
		if err := call(ok, 1); err != nil {
			t.Errorf("%s, which the watchdog has: %v", ok, err)
		}
	}
	if err := call("disk /", 0); err != nil {
		t.Errorf("waking one already snoozed: %v", err)
	}
	for _, made := range []string{"navidrome", "made up 1"} {
		if err := call(made, 1); err == nil {
			t.Errorf("%q, which isn't failing, was snoozed", made)
		}
		if _, ok := notify.LoadSnoozes(root)[made]; ok {
			t.Errorf("%q kept", made)
		}
	}
}

// failing marks checks as failing in the watchdog's state, as a run that
// found them down would.
func failing(t *testing.T, root string, checks ...string) {
	t.Helper()
	if err := health.UpdateState(health.StatePath(root), func(s *health.State) {
		if s.Failing == nil {
			s.Failing = map[string]time.Time{}
		}
		for _, c := range checks {
			s.Failing[c] = time.Now().Add(-time.Hour)
		}
	}); err != nil {
		t.Fatal(err)
	}
}
