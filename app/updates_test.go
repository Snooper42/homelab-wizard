package main

import (
	"os"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/app/tray"
	"github.com/Snooper42/homelab-wizard/internal/upgrade"
)

// A look is due by the wall clock: a monotonic reading taken before a
// night's sleep must not hold the next look back.
func TestDue(t *testing.T) {
	now := time.Date(2026, 10, 29, 8, 0, 0, 0, time.UTC)
	for _, c := range []struct {
		last time.Time
		want bool
	}{
		{time.Time{}, true},
		{now.Add(-16 * time.Minute), true},
		{now.Add(-15 * time.Minute), true},
		{now.Add(-14 * time.Minute), false},
	} {
		if got := due(c.last, now, lookEvery); got != c.want {
			t.Errorf("last %v: %v, want %v", c.last, got, c.want)
		}
	}
	// time.Now() carries a monotonic reading; due compares wall clocks.
	if !due(time.Now().Add(-time.Hour), time.Now(), lookEvery) {
		t.Error("an hour-old look is not due")
	}
}

// The homelab files and the app's build are one update, in words, with
// what blocks it said plainly.
func TestUpdateState(t *testing.T) {
	looked := time.Date(2026, 10, 29, 8, 0, 0, 0, time.UTC)
	files := UpgradeInfo{Check: upgrade.Check{Behind: 3, Version: "0.14.0", NewVersion: "0.15.0",
		Changes: []upgrade.Change{{Subject: "Backups, tidied (#286)"}}}, SelfUpdates: true}
	app := &PendingUpdate{Commit: "b", Version: "v0.15.0", Notes: []string{"Updates take one step (#287)"}, Ready: true, InstallOnQuit: true, CanInstallOnQuit: true}

	if s := updateState(UpgradeInfo{SelfUpdates: true}, nil, looked); s.State != "" || len(s.Notes) != 0 || !s.Looked.Equal(looked) {
		t.Errorf("nothing waits: %+v", s)
	}
	s := updateState(files, nil, looked)
	if s.State != "ready" || s.Files != 3 || s.App || s.Version != "0.15.0" || len(s.Notes) != 1 || s.Notes[0] != "Backups, tidied" {
		t.Errorf("the files: %+v", s)
	}
	s = updateState(UpgradeInfo{SelfUpdates: true}, app, looked)
	if s.State != "ready" || !s.App || !s.Downloaded || s.Version != "0.15.0" || s.Notes[0] != "Updates take one step" || !s.InstallOnQuit {
		t.Errorf("the app: %+v", s)
	}
	// The CHANGELOG's words come before the commits'.
	both := files
	both.Notes = []string{"Updates are found by themselves."}
	if s = updateState(both, app, looked); s.State != "ready" || s.Files != 3 || !s.App || s.Notes[0] != "Updates are found by themselves." {
		t.Errorf("both: %+v", s)
	}
	// A folder the app made gets its files with the new build.
	kit := files
	kit.Kit = true
	if s = updateState(kit, app, looked); s.Files != 0 || !s.App || s.State != "ready" || s.Finish {
		t.Errorf("a folder the app made: %+v", s)
	}
	// Once the new app opens, its files go in place by themselves.
	if s = updateState(kit, nil, looked); s.Files != 3 || s.App || s.State != "ready" || !s.Finish {
		t.Errorf("the new app's files: %+v", s)
	}
	ahead := files
	ahead.Ahead = 1
	if s = updateState(ahead, nil, looked); s.State != "blocked" || !strings.Contains(s.Blocked, "changes of its own") {
		t.Errorf("changes of its own: %+v", s)
	}
	byHand := UpgradeInfo{SelfUpdates: true, AppUpdate: &AppUpdate{Commit: "b", Page: "https://github.com/o/r/releases/tag/v0.15.0"}}
	if s = updateState(byHand, nil, looked); s.State != "blocked" || s.Page == "" || !strings.Contains(s.Blocked, "download") {
		t.Errorf("a download by hand: %+v", s)
	}
	local := UpgradeInfo{AppBehind: 2}
	if s = updateState(local, nil, looked); s.State != "blocked" || !strings.Contains(s.Blocked, "by hand") {
		t.Errorf("a local build: %+v", s)
	}
}

// Update now with only the homelab files: they are put in place, the
// window stays, and says what it was once.
func TestUpdateNowFiles(t *testing.T) {
	a, w := testApp(t)
	if err := a.UpdateNow(); err == nil {
		t.Fatal("an update with nothing waiting")
	}
	a.upgradeMu.Lock()
	a.lastUpgrade = &upgrade.Check{Behind: 2, Version: "0.14.0", NewVersion: "0.15.0", Notes: []string{"Backups, tidied."}}
	a.upgradeMu.Unlock()
	if s := a.UpdateState(); s.State != "ready" || s.Files != 2 {
		t.Fatalf("before: %+v", s)
	}
	if err := a.UpdateNow(); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(w.lines("cli:log"), "homelab upgrade --apply") {
		t.Errorf("the files were not updated: %v", w.lines("cli:log"))
	}
	steps := w.sent("update:step")
	if len(steps) < 2 || steps[0].(UpdateStep).Step != "files" || steps[len(steps)-1].(UpdateStep).Step != "done" {
		t.Errorf("steps: %v", steps)
	}
	if w.quitting() {
		t.Error("the app quit for the files alone")
	}
	s := a.UpdateState()
	if s.Updated == nil || s.Updated.Version != "0.15.0" || len(s.Updated.Notes) != 1 {
		t.Fatalf("Updated to: %+v", s.Updated)
	}
	if f := tray.LoadFound(); f.Looked.IsZero() {
		t.Error("the menu bar item was not told")
	}
	a.ClearUpdated()
	if a.UpdateState().Updated != nil {
		t.Error("Updated to shows again after it was closed")
	}
}

// Updated to … shows within the hour after the update, not later.
func TestLoadUpdated(t *testing.T) {
	testApp(t)
	at := time.Date(2026, 10, 29, 8, 0, 0, 0, time.UTC)
	saveUpdated(Updated{Version: "0.15.0", At: at})
	if u, ok := loadUpdated(at.Add(10 * time.Minute)); !ok || u.Version != "0.15.0" || u.Notes == nil {
		t.Errorf("ten minutes after: %+v %v", u, ok)
	}
	if _, ok := loadUpdated(at.Add(2 * time.Hour)); ok {
		t.Error("shown two hours after")
	}
	if _, ok := loadUpdated(at.Add(-time.Minute)); ok {
		t.Error("shown before it happened")
	}
	_ = os.Remove(updatedPath())
	if _, ok := loadUpdated(at); ok {
		t.Error("shown with no update")
	}
}

// Installing on quit is on until it is turned off.
func TestInstallOnQuitDefault(t *testing.T) {
	a, _ := testApp(t)
	if !installOnQuit() {
		t.Fatal("off before it was ever chosen")
	}
	if err := a.SetInstallOnQuit(false); err != nil || installOnQuit() {
		t.Fatalf("turned off: %v", err)
	}
	if err := a.SetInstallOnQuit(true); err != nil || !installOnQuit() {
		t.Fatalf("turned on: %v", err)
	}
}

// An app that opens on another build than the one it was updating to says
// the update did not install, with the update's own reason when it left one
// (Windows blocked the new build); on that build, it was updated.
func TestNotInstalled(t *testing.T) {
	u := Updated{Version: "0.15.10", Commit: "17b32549fcae0647353f8a0d070669ee3af919b1"}
	why, failed := notInstalled(u, "c7752f1aaaa", "Windows blocked it")
	if !failed || !strings.Contains(why, "The update to 0.15.10 did not install: Windows blocked it.") {
		t.Errorf("on the old build: %q %v", why, failed)
	}
	if why, _ := notInstalled(u, "c7752f1aaaa", ""); !strings.Contains(why, "the new build was not put in place") {
		t.Errorf("no reason in the log: %q", why)
	}
	for _, built := range []string{"17b32549fcae0647353f8a0d070669ee3af919b1", "17b3254", ""} {
		if _, failed := notInstalled(u, built, "x"); failed {
			t.Errorf("built from %q counts as not installed", built)
		}
	}
	if _, failed := notInstalled(Updated{Version: "0.15.10"}, "c7752f1", "x"); failed {
		t.Error("an update of the files only (no commit) counts as not installed")
	}
}
