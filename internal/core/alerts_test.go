package core

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/notify"
)

func TestCurrent(t *testing.T) {
	sent := time.Date(2026, 10, 30, 3, 30, 0, 0, time.UTC)
	down := func(lines ...string) notify.Event {
		return notify.Event{ID: "down", Time: sent, Topic: "tunnel-watchdog", Title: DownTitle, Message: strings.Join(lines, "\n")}
	}
	backup := func(lines ...string) notify.Event {
		return notify.Event{ID: "backup", Time: sent, Topic: "duplicati-alerts", Title: BackupFailedTitle, Message: strings.Join(lines, "\n")}
	}
	sonarr := DownLine(health.Result{Name: "sonarr", Err: errors.New("HTTP 502")})
	bouncer := DownLine(health.Result{Name: "crowdsec bouncer", Err: errors.New("no answer in time")})
	runs := map[string]bool{"navidrome": true, "komga": true}
	for _, c := range []struct {
		name  string
		event notify.Event
		watch health.State
		kept  bool
	}{
		{"a later run passed every check named", down(sonarr, bouncer), health.State{LastRun: sent.Add(15 * time.Minute)}, false},
		{"no run since", down(sonarr), health.State{LastRun: sent.Add(-time.Second)}, true},
		{"one still failing", down(sonarr, bouncer), health.State{LastRun: sent.Add(time.Hour), Failing: map[string]time.Time{"crowdsec bouncer": sent}}, true},
		{"failed again once", down(sonarr), health.State{LastRun: sent.Add(time.Hour), Pending: map[string]int{"sonarr": 1}}, true},
		{"every app skipped runs again", backup(NotRunningLine("navidrome"), OutsideLine("komga")), health.State{}, false},
		{"one still stopped", backup(NotRunningLine("navidrome"), NotRunningLine("kavita")), health.State{}, true},
		{"a dump that failed", backup(NotRunningLine("navidrome"), "navidrome: the dump failed"), health.State{}, true},
		{"the watchdog's good news", notify.Event{Topic: "tunnel-watchdog", Title: "Homelab: recovered", Message: "sonarr answering again"}, health.State{LastRun: sent.Add(time.Hour)}, true},
		{"Duplicati's own", notify.Event{Topic: "duplicati-alerts", Title: "Duplicati backup failed", Message: NotRunningLine("navidrome")}, health.State{}, true},
	} {
		got := Current([]notify.Event{c.event}, c.watch, func() func(string) bool { return func(id string) bool { return runs[id] } })
		if (len(got) == 1) != c.kept {
			t.Errorf("%s: kept %v, want %v", c.name, len(got) == 1, c.kept)
		}
	}
	// The runtime is asked only for a backup's alert, and once.
	asked := 0
	running := func() func(string) bool { asked++; return func(string) bool { return true } }
	Current([]notify.Event{down(sonarr)}, health.State{}, running)
	if asked != 0 {
		t.Fatal("asked the runtime without a backup's alert")
	}
	if got := Current([]notify.Event{backup(NotRunningLine("a")), backup(NotRunningLine("b"))}, health.State{}, running); len(got) != 0 || asked != 1 {
		t.Fatalf("%v, asked %d times", got, asked)
	}
}

func TestRecentAlertsLeavesOutCleared(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"id":"a","time":1760000000,"event":"message","topic":"tunnel-watchdog","title":"` + DownTitle + `","message":"sonarr: HTTP 502"}` + "\n"))
		w.Write([]byte(`{"id":"b","time":1760000900,"event":"message","topic":"tunnel-watchdog","title":"Homelab: recovered","message":"sonarr answering again"}` + "\n"))
	}))
	defer srv.Close()
	u, _ := url.Parse(srv.URL)
	root := homelab(t, "NTFY_READ_TOKEN=tk_read\nNTFY_PORT="+u.Port()+"\n")
	if err := (health.State{LastRun: time.Unix(1760000900, 0)}).Save(health.StatePath(root)); err != nil {
		t.Fatal(err)
	}
	events, err := RecentAlerts(context.Background(), root)
	if err != nil || len(events) != 1 || events[0].ID != "b" {
		t.Fatalf("%v %v", events, err)
	}
}

func TestRunningApps(t *testing.T) {
	ctx := context.Background()
	if runningApps(ctx, t.TempDir())("navidrome") {
		t.Fatal("running without a homelab")
	}
	root := homelab(t, "")
	r := &runner{FakeRunner: &docker.FakeRunner{}, down: errors.New("Cannot connect to the Docker daemon")}
	withDocker(t, r)
	if runningApps(ctx, root)("navidrome") {
		t.Fatal("running with the runtime down")
	}
	r.down = nil
	stopped := running("homelab_media", "komga")
	stopped.Running = false
	r.Containers = []docker.FakeContainer{running("homelab_media", "navidrome"), stopped}
	runs := runningApps(ctx, root)
	if !runs("navidrome") || runs("komga") || runs("kavita") {
		t.Fatal("navidrome alone runs")
	}
}
