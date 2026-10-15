package main

import (
	"context"
	"io"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
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
	if v, _ := env.Get(updates.HeldContainersKey); v != "homelab_media_automation-sonarr-1" {
		t.Errorf("UPDATES_HELD_CONTAINERS = %q", v)
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
