package main

import (
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/ui"
	"github.com/Snooper42/homelab-wizard/internal/updates"
)

func sonarr(imageID, health string) docker.FakeContainer {
	return docker.FakeContainer{Name: "homelab_media_automation-sonarr-1", Image: "lscr.io/linuxserver/sonarr:latest", ImageID: imageID, Running: true, Health: health,
		Project: "homelab_media_automation", Service: "sonarr"}
}

func TestUpdatesAreKeptAndRolledBack(t *testing.T) {
	root, _ := repoCopy(t, "AUTO_ROLLBACK=true")
	c, err := catalog.Load(root)
	if err != nil {
		t.Fatal(err)
	}
	h := &homelab{root: root, envFile: filepath.Join(root, ".env"), ui: &ui.UI{Out: io.Discard}, catalog: c}
	fake := &docker.FakeRunner{Containers: []docker.FakeContainer{sonarr("sha256:old", "")}}
	client := &docker.Client{Runner: fake, Bin: "docker"}
	ctx := context.Background()
	look := func() []string {
		cs, err := client.Containers(ctx)
		if err != nil {
			t.Fatal(err)
		}
		return h.trackUpdates(ctx, client, cs, true)
	}

	look() // the first look notes the image
	fake.Containers = []docker.FakeContainer{sonarr("sha256:new", "unhealthy")}
	fake.Calls = nil
	if notes := look(); len(notes) != 0 {
		t.Fatalf("too soon to roll back: %v", notes)
	}
	if calls := strings.Join(fake.Calls, "\n"); !strings.Contains(calls, "image tag sha256:old homelab-rollback/sonarr:previous") {
		t.Fatalf("the old image is not kept:\n%s", calls)
	}
	path := updates.HistoryPath(root)
	hist := updates.LoadHistory(path)
	if !hist.CanRollBack("sonarr") {
		t.Fatalf("history: %+v", hist.Apps["sonarr"])
	}

	// Half an hour after the update it is still unhealthy: back it goes.
	hist.Apps["sonarr"].Updated = time.Now().Add(-30 * time.Minute)
	if err := hist.Save(path); err != nil {
		t.Fatal(err)
	}
	fake.Calls = nil
	notes := look()
	calls := strings.Join(fake.Calls, "\n")
	if len(notes) != 1 || !strings.Contains(notes[0], "went back") ||
		!strings.Contains(calls, "image tag homelab-rollback/sonarr:previous lscr.io/linuxserver/sonarr:latest") ||
		!strings.Contains(calls, "up --detach --no-deps --force-recreate sonarr") {
		t.Fatalf("rollback (%v):\n%s", notes, calls)
	}
	env, _ := envfile.Load(h.envFile)
	if v, _ := env.Get(updates.HeldKey); v != "sonarr" {
		t.Errorf("UPDATES_HELD = %q", v)
	}
	if updates.LoadHistory(path).CanRollBack("sonarr") {
		t.Error("after a rollback there is nothing left to go back to")
	}
}

func TestRollbackCommand(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{sonarr("sha256:new", "")})
	root, _ := repoCopy(t)
	hist := updates.LoadHistory(updates.HistoryPath(root))
	hist.Apps["sonarr"] = &updates.Record{Ref: "lscr.io/linuxserver/sonarr:latest", Current: "sha256:new", Previous: "sha256:old", Updated: time.Now().Add(-2 * time.Hour)}
	if err := hist.Save(updates.HistoryPath(root)); err != nil {
		t.Fatal(err)
	}
	if out, code := homelabCmd(t, root, "", "rollback", "radarr", "--apply"); code == 0 || !strings.Contains(out, "not installed") {
		t.Errorf("radarr is not installed (exit %d):\n%s", code, out)
	}
	out, code := homelabCmd(t, root, "", "rollback", "sonarr", "--apply")
	if code != 0 || !strings.Contains(readCalls(t, calls), "up --detach --no-deps --force-recreate sonarr") {
		t.Fatalf("exit %d:\n%s\n%s", code, out, readCalls(t, calls))
	}
	if out, _ := homelabCmd(t, root, "", "updates"); !strings.Contains(out, "Held (not updated): sonarr") {
		t.Errorf("updates status:\n%s", out)
	}
	if out, code := homelabCmd(t, root, "", "updates", "release", "sonarr"); code != 0 {
		t.Fatalf("release (exit %d):\n%s", code, out)
	}
	env, _ := envfile.Load(filepath.Join(root, ".env"))
	if v, _ := env.Get(updates.HeldKey); v != "" {
		t.Errorf("released, yet UPDATES_HELD = %q", v)
	}
}

func TestUpdateDumpsTheDatabaseFirst(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		{Name: "paperless", Image: "ghcr.io/paperless-ngx/paperless-ngx:latest", ImageID: "sha256:p1", Running: true, Project: "homelab_paperless", Service: "paperless"},
		{Name: "paperless-db", Image: "postgres:16", ImageID: "sha256:d1", Running: true, Project: "homelab_paperless", Service: "paperless-db"},
	})
	root, _ := repoCopy(t)
	out, code := homelabCmd(t, root, "", "update", "paperless")
	if code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	log := readCalls(t, calls)
	dump, pull := strings.Index(log, "pg_dumpall"), strings.Index(log, " pull ")
	if dump < 0 || pull < 0 || dump > pull {
		t.Fatalf("the dump must come before the pull:\n%s", log)
	}
	if !strings.Contains(out, "dumping paperless-db first") {
		t.Errorf("output:\n%s", out)
	}
}

func TestUpdateAll(t *testing.T) {
	calls := fakeDocker(t, []docker.FakeContainer{
		sonarr("sha256:s1", ""),
		{Name: "paperless", Image: "ghcr.io/paperless-ngx/paperless-ngx:latest", ImageID: "sha256:p1", Running: true, Project: "homelab_paperless", Service: "paperless"},
		{Name: "paperless-db", Image: "postgres:16", ImageID: "sha256:d1", Running: true, Project: "homelab_paperless", Service: "paperless-db"},
	})
	root, _ := repoCopy(t)
	out, _ := homelabCmd(t, root, "", "update", "--all")
	// In plain words, by name (usability task 4, item 11): the two nightly
	// apps, not the database; whose data is copied first; nothing a terminal
	// says before anything has happened.
	if !strings.Contains(out, "These 2 apps have updates: Paperless-ngx, Sonarr.") && !strings.Contains(out, "These 2 apps have updates: Sonarr, Paperless-ngx.") {
		t.Fatalf("the plan should name the two nightly apps, not the database:\n%s", out)
	}
	if !strings.Contains(out, "Their data is copied first, so each update can be undone: Paperless-ngx.") {
		t.Errorf("the plan doesn't say Paperless's data is copied first:\n%s", out)
	}
	for _, mark := range []string{"✓", "→", "paperless-db", "sonarr,"} {
		if strings.Contains(out, mark) {
			t.Errorf("the plan says %q before anything happened:\n%s", mark, out)
		}
	}
	if strings.Contains(readCalls(t, calls), " pull ") {
		t.Fatalf("pulled without --apply:\n%s", readCalls(t, calls))
	}

	env, _ := envfile.Load(filepath.Join(root, ".env"))
	env.Set(updates.HeldKey, "sonarr")
	if err := env.Save(); err != nil {
		t.Fatal(err)
	}
	out, code := homelabCmd(t, root, "", "update", "--all", "--apply")
	if code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	log := readCalls(t, calls)
	pulled := false
	for _, line := range strings.Split(log, "\n") {
		if strings.Contains(line, "pull --ignore-buildable") {
			pulled = pulled || strings.Contains(line, " paperless")
			if strings.Contains(line, "paperless-db") {
				t.Errorf("the database was pulled: %s", line)
			}
		}
	}
	if !pulled {
		t.Errorf("paperless was not pulled:\n%s", log)
	}
	if strings.Contains(log, "pull --ignore-buildable sonarr") || !strings.Contains(out, "Held, so left alone: Sonarr") {
		t.Errorf("held sonarr should be left alone:\n%s\n%s", out, log)
	}
}

// After an update, it says what changed (usability task 4, item 12): an
// app on a new image with the versions its tags say, one on a newer build of
// the same tag, and one already up to date, each by its name.
func TestUpdateSaysWhatChanged(t *testing.T) {
	paperless := func(tag, id string) docker.FakeContainer {
		return docker.FakeContainer{Name: "paperless", Image: "ghcr.io/paperless-ngx/paperless-ngx:" + tag, ImageID: id, Running: true, Project: "homelab_paperless", Service: "paperless"}
	}
	db := docker.FakeContainer{Name: "paperless-db", Image: "postgres:16", ImageID: "sha256:d1", Running: true, Project: "homelab_paperless", Service: "paperless-db"}
	before := []docker.FakeContainer{sonarr("sha256:s1", ""), paperless("2.11.0", "sha256:p1"), db}
	fakeDocker(t, before)
	after := []docker.FakeContainer{sonarr("sha256:s1", ""), paperless("2.12.1", "sha256:p2"), db}
	inspect, _ := (&docker.FakeRunner{Containers: after}).Output(context.Background(), "docker", "inspect")
	src := filepath.Join(t.TempDir(), "after.json")
	if err := os.WriteFile(src, inspect, 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("FAKE_AFTER_UP", src)
	root, _ := repoCopy(t)
	out, code := homelabCmd(t, root, "", "update", "--all", "--apply")
	if code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	if !strings.Contains(out, "Updated: Paperless-ngx 2.11.0 → 2.12.1.") {
		t.Errorf("not said what Paperless went from and to:\n%s", out)
	}
	if !strings.Contains(out, "Already up to date: Sonarr.") {
		t.Errorf("not said Sonarr was already up to date:\n%s", out)
	}

	c, err := catalog.Load(root)
	if err != nil {
		t.Fatal(err)
	}
	var buf strings.Builder
	h := &homelab{root: root, ui: &ui.UI{Out: &buf}, catalog: c}
	h.sayUpdated(map[string]ranImage{"x": {"sha256:1", "latest"}}, map[string]ranImage{"x": {"sha256:2", "latest"}}, []string{"x"})
	if !strings.Contains(buf.String(), "Updated: x (a newer build).") {
		t.Errorf("a newer build of the same tag: %q", buf.String())
	}
}

func TestAnUpdateThatStopsAnsweringIsRolledBack(t *testing.T) {
	root, _ := repoCopy(t, "AUTO_ROLLBACK=true")
	c, err := catalog.Load(root)
	if err != nil {
		t.Fatal(err)
	}
	h := &homelab{root: root, envFile: filepath.Join(root, ".env"), ui: &ui.UI{Out: io.Discard}, catalog: c}
	fake := &docker.FakeRunner{Containers: []docker.FakeContainer{sonarr("sha256:old", "")}}
	client := &docker.Client{Runner: fake, Bin: "docker"}
	ctx := context.Background()
	look := func() []string {
		cs, err := client.Containers(ctx)
		if err != nil {
			t.Fatal(err)
		}
		return h.trackUpdates(ctx, client, cs, true)
	}
	look()
	fake.Containers = []docker.FakeContainer{sonarr("sha256:new", "")} // no health check: it just runs
	look()
	path := updates.HistoryPath(root)
	hist := updates.LoadHistory(path)
	hist.Apps["sonarr"].Updated = time.Now().Add(-30 * time.Minute)
	if err := hist.Save(path); err != nil {
		t.Fatal(err)
	}
	answers := api.Answers
	defer func() { api.Answers = answers }()
	api.Answers = func(_ context.Context, urls []string) map[string]string {
		out := map[string]string{}
		for _, u := range urls {
			out[u] = "HTTP 502"
		}
		return out
	}

	// Once is not enough: the watchdog's last run has to have seen it too.
	if notes := look(); len(notes) != 0 {
		t.Fatalf("rolled back on one failure: %v", notes)
	}
	state := health.LoadState(health.StatePath(root))
	state.Update([]health.Result{{Name: "sonarr", Err: errors.New("HTTP 502")}}, time.Now())
	if err := state.Save(health.StatePath(root)); err != nil {
		t.Fatal(err)
	}
	if notes := look(); len(notes) != 1 || !strings.Contains(notes[0], "Sonarr was not answering (HTTP 502) after its update, so it went back") {
		t.Fatalf("not rolled back: %v", notes)
	}
}

// TestTheWatchdogPutsDataBackOnlyIfItNeverCameUpWell: the copy made
// before the update goes back with the image when the app was never well
// after it (nothing new can have been written), and stays a step for a
// person otherwise (ADR-0020).
func TestTheWatchdogPutsDataBackOnlyIfItNeverCameUpWell(t *testing.T) {
	for _, wellFirst := range []bool{false, true} {
		root, _ := repoCopy(t, "AUTO_ROLLBACK=true")
		calls := fakeDocker(t, nil) // the docker on PATH, for loading the copy back
		c, err := catalog.Load(root)
		if err != nil {
			t.Fatal(err)
		}
		h := &homelab{root: root, envFile: filepath.Join(root, ".env"), ui: &ui.UI{Out: io.Discard}, catalog: c}
		fake := &docker.FakeRunner{Containers: []docker.FakeContainer{sonarr("sha256:old", "")}}
		client := &docker.Client{Runner: fake, Bin: "docker"}
		ctx := context.Background()
		look := func() []string {
			cs, err := client.Containers(ctx)
			if err != nil {
				t.Fatal(err)
			}
			return h.trackUpdates(ctx, client, cs, true)
		}
		answers := api.Answers
		api.Answers = func(_ context.Context, urls []string) map[string]string { return map[string]string{} }
		look()
		// The copy homelab update made of Sonarr's data on the old image.
		cp := backup.NewCopy(h.stagingDir(), "sonarr", "sha256:old", time.Now().Add(-31*time.Minute))
		_ = os.MkdirAll(cp.Dir, 0o700)
		_ = os.WriteFile(filepath.Join(cp.Dir, "1-sonarr.tar.gz"), []byte("archive"), 0o600)
		cp.Mounts = []backup.CopiedMount{{Kind: "folder", Source: filepath.Join(root, "data", "appdata", "sonarr"), Archive: "1-sonarr.tar.gz"}}
		if err := cp.Save(); err != nil {
			t.Fatal(err)
		}
		check := "starting"
		if wellFirst {
			check = "healthy"
		}
		fake.Containers = []docker.FakeContainer{sonarr("sha256:new", check)}
		look()
		path := updates.HistoryPath(root)
		hist := updates.LoadHistory(path)
		if r := hist.Apps["sonarr"]; r.HealthyAfter.IsZero() == wellFirst {
			t.Fatalf("well first %v: HealthyAfter %v", wellFirst, r.HealthyAfter)
		}
		hist.Apps["sonarr"].Updated = time.Now().Add(-30 * time.Minute)
		if err := hist.Save(path); err != nil {
			t.Fatal(err)
		}
		fake.Containers = []docker.FakeContainer{sonarr("sha256:new", "unhealthy")}
		notes := look()
		api.Answers = answers
		if len(notes) != 1 || !strings.Contains(notes[0], "went back to the image it ran before") {
			t.Fatalf("well first %v: %v", wellFirst, notes)
		}
		loaded := strings.Contains(readCalls(t, calls), "tar xzf")
		switch {
		case !wellFirst && (!loaded || !strings.Contains(notes[0], "with its data from just before the update")):
			t.Errorf("never well: the data should go back (%v): %v\n%s", loaded, notes, readCalls(t, calls))
		case wellFirst && (loaded || !strings.Contains(notes[0], "homelab rollback sonarr --data")):
			t.Errorf("well for a while: today's data stays, and --data is offered (%v): %v", loaded, notes)
		}
	}
}
