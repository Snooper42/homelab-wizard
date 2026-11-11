package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/finance"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/history"
	"github.com/Snooper42/homelab-wizard/internal/notify"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// Every alert is kept in the computer's record (internal/history), phone
// alerts set up or not; one that can carry money is kept only as its
// plain line, never its amount.
func TestAlertIsKept(t *testing.T) {
	root, _ := repoCopy(t, "NTFY_PUBLISH_TOKEN=")
	h := &homelab{root: root, envFile: filepath.Join(root, ".env"), ui: &ui.UI{Out: io.Discard}, catalog: catalogOf(t)}
	ctx := context.Background()
	h.alert(ctx, "watchtower", notify.Message{Title: "Homelab: Radarr rolled back", Body: "It runs the version from before.", Priority: 4})
	h.alert(ctx, digestTopic, reminderAlert(finance.Reminder{Title: "2 payments due tomorrow, $1,234.56", Body: "Rent, Car."}))
	h.alert(ctx, digestTopic, weeklyAlert(h, "This week: $9,876.54 out", "Spent $9,876.54"))
	got, err := history.AlertsIn(root, 0)
	if err != nil || len(got) != 3 {
		t.Fatalf("three kept without ntfy's token: %+v %v", got, err)
	}
	if got[2].Topic != "watchtower" || got[2].Title != "Homelab: Radarr rolled back" || got[2].Priority != 4 {
		t.Fatalf("the rollback: %+v", got[2])
	}
	if got[1].Title != "A Finances reminder" || got[1].Body != "" || got[0].Title != "The weekly summary" || got[0].Body != "" {
		t.Fatalf("Finances' reminder and the weekly summary, by their plain lines: %+v %+v", got[1], got[0])
	}
	for _, name := range []string{"homelab.db", "homelab.db-wal"} {
		data, _ := os.ReadFile(filepath.Join(root, "data", name))
		for _, money := range []string{"1,234.56", "9,876.54", "Rent, Car"} {
			if bytes.Contains(data, []byte(money)) {
				t.Errorf("%s holds %q", name, money)
			}
		}
	}
}

// The watchdog's down alert is kept with the checks it's about, and is
// marked cleared once none of them fails.
func TestWatchdogAlertKeptAndCleared(t *testing.T) {
	saved := desktopNotify
	desktopNotify = func(context.Context, string, string) error { return nil }
	t.Cleanup(func() { desktopNotify = saved })
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-vaultwarden-1", Image: "vaultwarden/server:latest", Running: true, Health: "unhealthy", Project: "homelab_security", Service: "vaultwarden"},
	})
	root, _ := repoCopy(t, "UPDATES_PAUSED=true", "TUNNEL_TOKEN=", "AUTO_HEAL=false")
	for range 3 { // a failure is confirmed on a later check
		homelabCmd(t, root, "", "watchdog")
	}
	got, _ := history.AlertsIn(root, 0)
	i := slices.IndexFunc(got, func(a history.Alert) bool { return slices.Contains(a.Checks, "vaultwarden") })
	if i < 0 || got[i].ClearedAt != nil || got[i].Topic != "tunnel-watchdog" {
		t.Fatalf("the down alert with its checks, open: %+v", got)
	}
	h := &homelab{root: root, envFile: filepath.Join(root, ".env"), ui: &ui.UI{Out: io.Discard}, catalog: catalogOf(t)}
	results := []health.Result{{Name: "vaultwarden", Status: 200}}
	for _, c := range got[i].Checks {
		if c != "vaultwarden" {
			results = append(results, health.Result{Name: c, Err: errors.New("down")})
		}
	}
	h.clearAlerts(results, time.Now())
	if again, _ := history.AlertsIn(root, 0); again[i].ClearedAt != nil && len(results) > 1 {
		t.Fatalf("cleared while its other checks still fail: %+v", again[i])
	}
	h.clearAlerts([]health.Result{{Name: "vaultwarden", Status: 200}}, time.Now())
	if again, _ := history.AlertsIn(root, 0); again[i].ClearedAt == nil {
		t.Fatalf("not cleared once none fails: %+v", again[i])
	}
}

// A phone reads the record with AlertLog: a read, the household's; a
// snooze from a phone says which phone, and a wall screen isn't shown who.
func TestAlertLogFromAPhone(t *testing.T) {
	fakeDocker(t, nil)
	t.Setenv(asCLI, "1")
	root, _ := repoCopy(t, "DUPLICATI_PASSWORD=quinceS3cretValue9")
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	history.RecordAlert(root, history.Alert{Topic: "tunnel-watchdog", Title: "Homelab: something is down", Body: "jellyfin: not answering (login quinceS3cretValue9 refused)", Checks: []string{"jellyfin"}})
	m := h.phoneMethods()["AlertLog"]
	if m.Call == nil || m.Change || m.Member {
		t.Fatalf("AlertLog is a read, the owner's phones' only: %+v", m)
	}
	phone := companion.WithCaller(context.Background(), companion.Device{ID: "a1", Name: "Sam's iPhone", CanChange: true})
	if _, _, err := h.phoneMethods()["SnoozeCheck"].Call(phone, []json.RawMessage{json.RawMessage(`"jellyfin"`), json.RawMessage(`1`)}); err != nil {
		t.Fatal(err)
	}
	v, _, err := m.Call(phone, nil)
	list, _ := v.([]history.Alert)
	if err != nil || len(list) != 1 || list[0].SnoozedBy != "Sam's iPhone" || list[0].SnoozedUntil == nil {
		t.Fatalf("the alert, snoozed by the phone: %+v %v", list, err)
	}
	if strings.Contains(list[0].Body, "quinceS3cretValue9") || !strings.Contains(list[0].Body, "jellyfin: not answering") {
		t.Fatalf("a secret of .env reached the phone: %q", list[0].Body)
	}
	wall := companion.WithCaller(context.Background(), companion.Device{ID: "w1", Name: "Hall screen", Kiosk: true})
	v, _, _ = m.Call(wall, nil)
	if list, _ := v.([]history.Alert); len(list) != 1 || list[0].SnoozedBy != "" || list[0].SnoozedUntil == nil {
		t.Fatalf("a wall screen sees it snoozed, not by whom: %+v", list)
	}
}
