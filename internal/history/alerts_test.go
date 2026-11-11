package history

import (
	"strings"
	"testing"
	"time"
)

func TestAlertsKept(t *testing.T) {
	root := t.TempDir()
	yesterday := time.Now().Add(-26 * time.Hour)
	RecordAlert(root, Alert{At: yesterday, Topic: "tunnel-watchdog", Title: "Homelab: something is down", Body: "immich: not answering\nvikunja: unhealthy", Priority: 4, Checks: []string{"immich", "vikunja"}})
	RecordAlert(root, Alert{Topic: "watchtower", Title: "Homelab: an update was rolled back", Body: "Radarr\x07 rolled back"})
	got, err := AlertsIn(root, 0)
	if err != nil || len(got) != 2 {
		t.Fatalf("both kept, past ntfy's 12 hours: %+v %v", got, err)
	}
	if got[0].Topic != "watchtower" || got[1].Title != "Homelab: something is down" {
		t.Fatalf("newest first: %+v", got)
	}
	if got[0].Body != "Radarr rolled back" {
		t.Fatalf("control characters kept: %q", got[0].Body)
	}
	down := got[1]
	if down.Body != "immich: not answering\nvikunja: unhealthy" || down.Priority != 4 || strings.Join(down.Checks, ",") != "immich,vikunja" {
		t.Fatalf("its lines, priority and checks: %+v", down)
	}
	if down.ClearedAt != nil || down.SnoozedUntil != nil || down.SnoozedBy != "" {
		t.Fatalf("not cleared or snoozed yet: %+v", down)
	}
	if !down.At.Round(time.Second).Equal(yesterday.Round(time.Second)) {
		t.Fatalf("its time: %v, want %v", down.At, yesterday)
	}
	// None kept yet is an empty list, and no database is made for asking.
	empty := t.TempDir()
	if got, err := AlertsIn(empty, 0); err != nil || got == nil || len(got) != 0 {
		t.Fatalf("none yet: %+v %v", got, err)
	}
	// An alert with no title isn't kept.
	d, _ := Open(root)
	defer d.Close()
	if err := d.AddAlert(Alert{Title: " \n "}); err == nil {
		t.Fatal("an alert with no title was kept")
	}
}

func TestAlertCleared(t *testing.T) {
	root := t.TempDir()
	d, err := Open(root)
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	_ = d.AddAlert(Alert{Title: "Homelab: something is down", Checks: []string{"immich", "vikunja"}})
	_ = d.AddAlert(Alert{Title: "Homelab: recovered", Body: "paperless answering again"})
	failing := map[string]bool{"vikunja": true}
	first := time.Now()
	if err := d.ClearAlerts(func(name string) bool { return failing[name] }, first); err != nil {
		t.Fatal(err)
	}
	got, _ := d.Alerts(0)
	if got[1].ClearedAt != nil {
		t.Fatalf("cleared while vikunja still fails: %+v", got[1])
	}
	if got[0].ClearedAt != nil {
		t.Fatalf("an alert about no check is never cleared: %+v", got[0])
	}
	delete(failing, "vikunja")
	at := first.Add(5 * time.Minute)
	_ = d.ClearAlerts(func(name string) bool { return failing[name] }, at)
	got, _ = d.Alerts(0)
	if got[1].ClearedAt == nil || !got[1].ClearedAt.Round(time.Second).Equal(at.Round(time.Second)) {
		t.Fatalf("cleared when none of its checks fails, at that time: %+v", got[1])
	}
	// A later run doesn't move when it cleared.
	_ = d.ClearAlerts(func(string) bool { return false }, at.Add(time.Hour))
	got, _ = d.Alerts(0)
	if !got[1].ClearedAt.Round(time.Second).Equal(at.Round(time.Second)) {
		t.Fatalf("cleared again: %+v", got[1])
	}
}

func TestAlertSnoozedBy(t *testing.T) {
	root := t.TempDir()
	d, err := Open(root)
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	_ = d.AddAlert(Alert{At: time.Now().Add(-time.Hour), Title: "Homelab: something is down", Checks: []string{"immich"}})
	_ = d.AddAlert(Alert{At: time.Now().Add(-time.Minute), Title: "Homelab: something is down", Checks: []string{"immich", "disk"}})
	until := time.Now().Add(time.Hour)
	if err := d.SnoozeAlert("immich", until, "Sam's iPhone"); err != nil {
		t.Fatal(err)
	}
	got, _ := d.Alerts(0)
	if got[0].SnoozedBy != "Sam's iPhone" || got[0].SnoozedUntil == nil || !got[0].SnoozedUntil.Round(time.Second).Equal(until.Round(time.Second)) {
		t.Fatalf("the newest open alert about it says who snoozed it, until when: %+v", got[0])
	}
	if got[1].SnoozedBy != "" {
		t.Fatalf("an older one marked too: %+v", got[1])
	}
	// Alert again now takes it off.
	_ = d.SnoozeAlert("immich", time.Time{}, ThisComputer)
	got, _ = d.Alerts(0)
	if got[0].SnoozedBy != "" || got[0].SnoozedUntil != nil {
		t.Fatalf("woken, still marked: %+v", got[0])
	}
	// A cleared alert isn't marked; a check with no alert is no error.
	_ = d.ClearAlerts(func(string) bool { return false }, time.Now())
	_ = d.SnoozeAlert("immich", until, ThisComputer)
	got, _ = d.Alerts(0)
	if got[0].SnoozedBy != "" {
		t.Fatalf("a cleared alert marked snoozed: %+v", got[0])
	}
	if err := d.SnoozeAlert("nothing-here", until, ThisComputer); err != nil {
		t.Fatal(err)
	}
}

func TestAlertsTrimmed(t *testing.T) {
	root := t.TempDir()
	d, err := Open(root)
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	_ = d.AddAlert(Alert{At: time.Now().Add(-Keep - time.Hour), Title: "too old"})
	_ = d.AddAlert(Alert{Title: "kept"})
	got, _ := d.Alerts(0)
	if len(got) != 1 || got[0].Title != "kept" {
		t.Fatalf("older than %v kept: %+v", Keep, got)
	}
	// A long body is cut; Alerts gives at most the limit asked (and 200).
	_ = d.AddAlert(Alert{Title: "long", Body: strings.Repeat("x", 5000)})
	got, _ = d.Alerts(1)
	if len(got) != 1 || len([]rune(got[0].Body)) > maxAlertBody {
		t.Fatalf("limit and length: %d alerts, body %d", len(got), len([]rune(got[0].Body)))
	}
	// The record of what was done is still there beside it.
	if err := d.Add(Entry{Kind: "start", Text: "Started Immich"}); err != nil {
		t.Fatal(err)
	}
}
