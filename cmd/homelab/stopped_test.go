package main

import (
	"bytes"
	"context"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/battery"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/stopped"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// homelab stop keeps the app as stopped on purpose, until a time when one
// is given; start, restart, and remove forget it.
func TestStopKeepsWhatWasStoppedOnPurpose(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_media_automation-sonarr-1", Image: "x", Running: true, Health: "healthy", Project: "homelab_media_automation", Service: "sonarr"},
		{Name: "homelab_media_automation-radarr-1", Image: "x", Running: true, Health: "healthy", Project: "homelab_media_automation", Service: "radarr"},
	})
	root, _ := repoCopy(t)
	path := stopped.Path(root)
	before := time.Now().Truncate(time.Second)

	if out, code := homelabCmd(t, root, "", "stop", "sonarr"); code != 0 {
		t.Fatalf("stop (exit %d):\n%s", code, out)
	}
	r := stopped.Load(path)
	if s, ok := r["sonarr"]; !ok || !s.Until.IsZero() || s.Since.Before(before) {
		t.Fatalf("after stop: %v", r)
	}
	out, code := homelabCmd(t, root, "", "stop", "radarr", "--until", "1h")
	if code != 0 || !strings.Contains(out, "starts again by itself at") {
		t.Fatalf("stop --until (exit %d):\n%s", code, out)
	}
	r = stopped.Load(path)
	if s := r["radarr"]; s.Until.Sub(before) < 59*time.Minute || s.Until.Sub(before) > 61*time.Minute {
		t.Fatalf("radarr until %v, want an hour from now", s.Until)
	}
	// An end that cannot be read stops nothing and keeps nothing.
	if out, code := homelabCmd(t, root, "", "stop", "sonarr", "radarr", "--until", "tonight"); code == 0 || !strings.Contains(out, "--until takes") {
		t.Fatalf("a bad --until (exit %d):\n%s", code, out)
	}
	if n := strings.Count(readCalls(t, calls), "stop sonarr"); n != 1 {
		t.Fatalf("stopped %d times, want once:\n%s", n, readCalls(t, calls))
	}
	if out, code := homelabCmd(t, root, "", "start", "sonarr"); code != 0 {
		t.Fatalf("start (exit %d):\n%s", code, out)
	}
	if r = stopped.Load(path); r.Has("sonarr") || !r.Has("radarr") {
		t.Fatalf("after start sonarr: %v", r)
	}
	if out, code := homelabCmd(t, root, "", "restart", "radarr"); code != 0 {
		t.Fatalf("restart (exit %d):\n%s", code, out)
	}
	if r = stopped.Load(path); len(r) != 0 {
		t.Fatalf("after restart radarr: %v", r)
	}
}

// Plugged in again, the battery saver starts what it paused, except an app
// stopped on purpose meanwhile, which it lets go of.
func TestBatterySaverLeavesWhatWasStoppedOnPurpose(t *testing.T) {
	battery.Power = func() (bool, bool) { return false, true }
	t.Cleanup(func() { battery.Power = func() (bool, bool) { return false, false } })
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_media_automation-sonarr-1", Image: "x", Project: "homelab_media_automation", Service: "sonarr"},
		{Name: "homelab_media_automation-radarr-1", Image: "x", Project: "homelab_media_automation", Service: "radarr"},
	})
	root, _ := repoCopy(t)
	if err := (battery.State{Paused: []string{"radarr", "sonarr"}, Since: time.Now()}).Save(battery.Path(root)); err != nil {
		t.Fatal(err)
	}
	if err := (stopped.Record{"sonarr": {Since: time.Now()}}).Save(stopped.Path(root)); err != nil {
		t.Fatal(err)
	}
	h, err := newHomelab(&ui.UI{Out: &bytes.Buffer{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	client, err := h.docker(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	containers, _ := client.Containers(context.Background())
	h.batterySaver(context.Background(), client, containers)
	log := readCalls(t, calls)
	if !strings.Contains(log, "start radarr") || strings.Contains(log, "sonarr") {
		t.Fatalf("calls:\n%s", log)
	}
	if st := battery.Load(battery.Path(root)); len(st.Paused) != 0 {
		t.Fatalf("still paused %v", st.Paused)
	}
	if !stopped.Load(stopped.Path(root)).Has("sonarr") {
		t.Fatal("sonarr is no longer kept as stopped on purpose")
	}
}

// The watchdog makes a gone app again, but not one stopped on purpose.
func TestWatchdogLeavesWhatWasStoppedOnPurpose(t *testing.T) {
	vaultwarden := docker.FakeContainer{Name: "homelab_security-vaultwarden-1", Image: "vaultwarden/server:latest", Running: true, Health: "healthy", Project: "homelab_security", Service: "vaultwarden"}
	fakeDocker(t, []docker.FakeContainer{vaultwarden})
	root, _ := repoCopy(t, "UPDATES_PAUSED=true", "TUNNEL_TOKEN=")
	homelabCmd(t, root, "", "watchdog")
	if err := (stopped.Record{"vaultwarden": {Since: time.Now()}}).Save(stopped.Path(root)); err != nil {
		t.Fatal(err)
	}
	calls := fakeDocker(t, nil)
	homelabCmd(t, root, "", "watchdog")
	homelabCmd(t, root, "", "watchdog")
	if log := readCalls(t, calls); strings.Contains(log, "vaultwarden") && strings.Contains(log, "up --detach") {
		t.Fatalf("made an app stopped on purpose again:\n%s", log)
	}
}

// Its time come, an app stopped for a while starts again; one still to
// wait, or stopped with no end, stays stopped; one running again is
// forgotten; one that will not start is tried again next time.
func TestStartWhenDue(t *testing.T) {
	t.Setenv("FAKE_START_FAILS", "lidarr")
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_media_automation-sonarr-1", Image: "x", Project: "homelab_media_automation", Service: "sonarr"},
		{Name: "homelab_media_automation-radarr-1", Image: "x", Project: "homelab_media_automation", Service: "radarr"},
		{Name: "homelab_media_automation-lidarr-1", Image: "x", Project: "homelab_media_automation", Service: "lidarr"},
		{Name: "homelab_media_automation-bazarr-1", Image: "x", Running: true, Health: "healthy", Project: "homelab_media_automation", Service: "bazarr"},
		{Name: "homelab_media_automation-prowlarr-1", Image: "x", Project: "homelab_media_automation", Service: "prowlarr"},
	})
	root, _ := repoCopy(t)
	now := time.Now()
	if err := (stopped.Record{
		"sonarr":   {Since: now.Add(-2 * time.Hour), Until: now.Add(-time.Minute)},
		"radarr":   {Since: now, Until: now.Add(time.Hour)},
		"lidarr":   {Since: now.Add(-2 * time.Hour), Until: now.Add(-time.Minute)},
		"bazarr":   {Since: now},
		"prowlarr": {Since: now},
	}).Save(stopped.Path(root)); err != nil {
		t.Fatal(err)
	}
	var out bytes.Buffer
	h, err := newHomelab(&ui.UI{Out: &out}, root)
	if err != nil {
		t.Fatal(err)
	}
	client, err := h.docker(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	containers, _ := client.Containers(context.Background())
	h.startWhenDue(context.Background(), client, containers, now)
	log := readCalls(t, calls)
	for _, want := range []string{"start sonarr", "start lidarr"} {
		if !strings.Contains(log, want) {
			t.Errorf("no %q in:\n%s", want, log)
		}
	}
	for _, not := range []string{"radarr", "prowlarr", "bazarr"} {
		if strings.Contains(log, not) {
			t.Errorf("%s was started:\n%s", not, log)
		}
	}
	if got := strings.Join(stopped.Load(stopped.Path(root)).IDs(), ","); got != "lidarr,prowlarr,radarr" {
		t.Errorf("kept %s, want lidarr,prowlarr,radarr", got)
	}
	if !strings.Contains(out.String(), "started Sonarr again") {
		t.Errorf("said:\n%s", out.String())
	}
}

// The awake job starts an app within its minute of looking once its time
// comes.
func TestResumeStopped(t *testing.T) {
	was := powerEvery
	powerEvery = 10 * time.Millisecond
	t.Cleanup(func() { powerEvery = was })
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_media_automation-sonarr-1", Image: "x", Project: "homelab_media_automation", Service: "sonarr"},
	})
	root, _ := repoCopy(t)
	if err := (stopped.Record{"sonarr": {Since: time.Now(), Until: time.Now().Add(100 * time.Millisecond)}}).Save(stopped.Path(root)); err != nil {
		t.Fatal(err)
	}
	h, err := newHomelab(&ui.UI{Out: &bytes.Buffer{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	done := make(chan struct{})
	go func() { h.resumeStopped(ctx); close(done) }()
	for len(stopped.Load(stopped.Path(root))) > 0 {
		if ctx.Err() != nil {
			t.Fatal("still stopped after 20s")
		}
		time.Sleep(20 * time.Millisecond)
	}
	cancel()
	<-done
	if log := readCalls(t, calls); !strings.Contains(log, "start sonarr") {
		t.Fatalf("calls:\n%s", log)
	}
}

// homelab up (which the agent runs at login) leaves a baseline app stopped
// on purpose stopped, and says so.
func TestUpLeavesWhatWasStoppedOnPurpose(t *testing.T) {
	calls := fakeDocker(t, nil)
	root, _ := repoCopy(t)
	if err := (stopped.Record{"navidrome": {Since: time.Now()}}).Save(stopped.Path(root)); err != nil {
		t.Fatal(err)
	}
	out, code := homelabCmd(t, root, "", "up", "--apply")
	if code != 0 || !strings.Contains(out, "left stopped, as they were stopped on purpose: navidrome") || !strings.Contains(out, "not started, as they need an app stopped on purpose: feishin") {
		t.Fatalf("up exit %d:\n%s", code, out)
	}
	// Feishin needs Navidrome: starting it would start Navidrome with it.
	log := readCalls(t, calls)
	if !strings.Contains(log, "up --detach --no-recreate audiobookshelf calibre-web komga") || strings.Contains(log, "navidrome") || strings.Contains(log, "feishin") {
		t.Fatalf("navidrome or feishin was started, or the rest of Media was not:\n%s", log)
	}
}

// Fix it does not count a baseline app stopped on purpose as down.
func TestFixLeavesWhatWasStoppedOnPurpose(t *testing.T) {
	var ctrs []docker.FakeContainer
	for _, id := range []string{"nginx-proxy-manager", "adguard-home", "crowdsec", "vaultwarden", "uptime-kuma", "ntfy", "duplicati", "navidrome", "feishin", "audiobookshelf", "calibre-web", "komga"} {
		a, _ := catalogOf(t).Get(id)
		ctrs = append(ctrs, docker.FakeContainer{Name: a.Project() + "-" + id + "-1", Image: "x", Running: id != "navidrome", Health: "healthy", Project: a.Project(), Service: id})
	}
	fakeDocker(t, ctrs)
	root, _ := repoCopy(t, "UPDATES_PAUSED=true", "TUNNEL_TOKEN=")
	out, _ := homelabCmd(t, root, "", "fix")
	if !strings.Contains(out, "start the homelab's own apps that are down") || !strings.Contains(out, "Navidrome") {
		t.Fatalf("without a record, a stopped Navidrome should be down:\n%s", out)
	}
	if err := (stopped.Record{"navidrome": {Since: time.Now()}}).Save(stopped.Path(root)); err != nil {
		t.Fatal(err)
	}
	out, _ = homelabCmd(t, root, "", "fix")
	if strings.Contains(out, "Navidrome") {
		t.Fatalf("Fix it offers to start an app stopped on purpose:\n%s", out)
	}
}

// An app stopped on purpose while the awake job starts another one again
// (a phone's Stop for a while, during the seconds a start takes) stays in
// the record: the awake job does not save its older copy over it, which
// would let the watchdog start the app the person just stopped.
func TestStartWhenDueKeepsAStopMadeMeanwhile(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_media_automation-sonarr-1", Image: "x", Project: "homelab_media_automation", Service: "sonarr"},
		{Name: "homelab_media_automation-radarr-1", Image: "x", Running: true, Health: "healthy", Project: "homelab_media_automation", Service: "radarr"},
	})
	root, _ := repoCopy(t)
	now := time.Now()
	path := stopped.Path(root)
	if err := (stopped.Record{"sonarr": {Since: now.Add(-2 * time.Hour), Until: now.Add(-time.Minute)}}).Save(path); err != nil {
		t.Fatal(err)
	}
	t.Setenv("FAKE_START_STOPS", path+"=radarr")
	h, err := newHomelab(&ui.UI{Out: &bytes.Buffer{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	client, err := h.docker(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	containers, _ := client.Containers(context.Background())
	h.startWhenDue(context.Background(), client, containers, now)
	if log := readCalls(t, calls); !strings.Contains(log, "start sonarr") {
		t.Fatalf("sonarr was not started:\n%s", log)
	}
	if got := strings.Join(stopped.Load(path).IDs(), ","); got != "radarr" {
		t.Errorf("the record holds %q after the awake job, want radarr (stopped meanwhile)", got)
	}
}
