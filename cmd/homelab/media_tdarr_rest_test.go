package main

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/media"
	"github.com/Snooper42/homelab-wizard/internal/stopped"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// The owner, Nov 9: Tdarr's memory on a 16GB Mac. Tdarr rests while it has
// nothing to do, and a job that needs it starts it first; a Tdarr someone
// started, or stopped, stays as they left it.
func TestTdarrRestsWhenIdleAndWakesForAJob(t *testing.T) {
	td := &fakeTdarr{limit: 1}
	root, _ := repoCopy(t, "TDARR_PORT="+td.serve(t), "TDARR_API_KEY=tdarr-key")
	home := t.TempDir()
	h, err := newHomelab(&ui.UI{Out: &bytes.Buffer{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	tick := func(env map[string]string) string {
		t.Helper()
		calls := fakeDocker(t, []docker.FakeContainer{
			{Name: "homelab_media_automation-tdarr-1", Image: "x", Running: true, Health: "healthy", Project: "homelab_media_automation", Service: "tdarr"},
		})
		if env == nil {
			env = h.envMap()
		}
		h.restTdarr(context.Background(), env, home, now)
		return readCalls(t, calls)
	}
	setRecord := func(change func(*media.Record)) {
		t.Helper()
		rec := media.LoadRecord(root)
		change(&rec)
		if err := rec.Save(root); err != nil {
			t.Fatal(err)
		}
	}
	path := stopped.Path(root)

	// Kept up: a job used it a few minutes ago; a film is still with it;
	// it's converting one; or TIDY_TDARR_REST=false.
	setRecord(func(r *media.Record) { r.TdarrUsed = now.Add(-5 * time.Minute) })
	if log := tick(nil); strings.Contains(log, "stop") {
		t.Fatalf("rested 5 minutes after a job:\n%s", log)
	}
	setRecord(func(r *media.Record) { r.TdarrUsed = now.Add(-time.Hour) })
	work := filepath.Join(home, ".homelab-media", "movies.json")
	if err := os.MkdirAll(filepath.Dir(work), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(work, []byte(`{"pending": {"/media/movies/.staging/Heat (1995).mkv": {}}}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if log := tick(nil); strings.Contains(log, "stop") {
		t.Fatalf("rested with a film still with it:\n%s", log)
	}
	if err := os.Remove(work); err != nil {
		t.Fatal(err)
	}
	td.working = true
	if log := tick(nil); strings.Contains(log, "stop") {
		t.Fatalf("rested while converting:\n%s", log)
	}
	td.working = false
	off := h.envMap()
	off["TIDY_TDARR_REST"] = "false"
	if log := tick(off); strings.Contains(log, "stop") {
		t.Fatalf("rested with TIDY_TDARR_REST=false:\n%s", log)
	}

	// Idle, nothing with it, an hour since its last job: it rests, noted
	// as Tidy Up's.
	if log := tick(nil); !strings.Contains(log, "stop tdarr") {
		t.Fatalf("idle Tdarr not rested:\n%s", log)
	}
	if s, ok := stopped.Load(path)["tdarr"]; !ok || s.Why != whyTidy {
		t.Fatalf("stopped.json: %+v", stopped.Load(path))
	}
	if rec := media.LoadRecord(root); !rec.TdarrResting {
		t.Fatalf("the record doesn't say it's resting: %+v", rec)
	}

	// A job that needs it starts it, and takes it out of stopped.json.
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_media_automation-tdarr-1", Image: "x", Running: false, Project: "homelab_media_automation", Service: "tdarr"},
	})
	var said []string
	h.useTdarr(context.Background(), func(s string) { said = append(said, s) })
	if log := readCalls(t, calls); !strings.Contains(log, "start tdarr") {
		t.Fatalf("a job didn't start the resting Tdarr:\n%s", log)
	}
	if stopped.Load(path).Has("tdarr") || len(said) == 0 || !strings.Contains(said[0], "Starting Tdarr") {
		t.Fatalf("after waking: stopped.json %+v, said %q", stopped.Load(path), said)
	}
	rec := media.LoadRecord(root)
	if rec.TdarrResting || now.Sub(rec.TdarrUsed) > time.Minute {
		t.Fatalf("after waking: %+v", rec)
	}

	// Someone started it while it rested: it stays up until a job next
	// uses it, and rests a while after that job.
	setRecord(func(r *media.Record) { r.TdarrResting, r.TdarrUsed = true, now.Add(-time.Hour) })
	if log := tick(nil); strings.Contains(log, "stop") {
		t.Fatalf("stopped a Tdarr someone started:\n%s", log)
	}
	if rec := media.LoadRecord(root); rec.TdarrResting || !rec.TdarrLeftUp {
		t.Fatalf("someone's start not kept: %+v", rec)
	}
	if log := tick(nil); strings.Contains(log, "stop") {
		t.Fatalf("stopped a Tdarr someone started, on the next minute:\n%s", log)
	}
	fakeDocker(t, nil)
	h.useTdarr(context.Background(), func(string) {})
	if rec := media.LoadRecord(root); rec.TdarrLeftUp {
		t.Fatalf("a job's use didn't make it Tidy Up's again: %+v", rec)
	}
	setRecord(func(r *media.Record) { r.TdarrUsed = now.Add(-time.Hour) })
	if log := tick(nil); !strings.Contains(log, "stop tdarr") {
		t.Fatalf("not rested after the job:\n%s", log)
	}

	// A stop made by a person: never started by a job, never touched.
	if err := (stopped.Record{"tdarr": {Since: now.UTC()}}).Save(path); err != nil {
		t.Fatal(err)
	}
	setRecord(func(r *media.Record) { r.TdarrResting = false })
	calls = fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_media_automation-tdarr-1", Image: "x", Running: false, Project: "homelab_media_automation", Service: "tdarr"},
	})
	h.useTdarr(context.Background(), func(string) {})
	h.restTdarr(context.Background(), h.envMap(), home, now)
	if log := readCalls(t, calls); strings.Contains(log, "tdarr") {
		t.Fatalf("touched a Tdarr a person stopped:\n%s", log)
	}
	if s := stopped.Load(path)["tdarr"]; s.Why != "" {
		t.Fatalf("a person's stop changed: %+v", s)
	}
}

// What a run needs Tdarr for: its own jobs, filing a film or episode, and a
// sweep of the watched folders with a video in them.
func TestNeedsTdarr(t *testing.T) {
	video, none := func() bool { return true }, func() bool { return false }
	for _, c := range []struct {
		kind, action string
		apply        bool
		rest         []string
		video        func() bool
		want         bool
	}{
		{"movies", "run", false, nil, none, true},
		{"tv", "collect", false, nil, none, true},
		{"tdarr", "setup", false, nil, none, true},
		{"movies", "file", true, []string{"/dl/Heat.mkv"}, none, true},
		{"inbox", "scan", true, nil, video, true},
		{"inbox", "scan", true, nil, none, false},
		{"inbox", "scan", false, nil, video, false},
		{"inbox", "name", false, []string{"/dl/x.mkv", "movie", "Heat", "1995"}, none, true},
		{"inbox", "name", false, []string{"/dl/x", "album", "Rumours"}, none, false},
		{"movies", "scan", false, nil, none, false},
		{"music", "lyrics", false, nil, video, false},
	} {
		if got := needsTdarr(c.kind, c.action, c.apply, c.rest, c.video); got != c.want {
			t.Errorf("%s %s %v %v: %v, want %v", c.kind, c.action, c.apply, c.rest, got, c.want)
		}
	}
}
