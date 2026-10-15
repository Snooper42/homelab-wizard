package main

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

func ghostfolioDB() []docker.FakeContainer {
	return []docker.FakeContainer{{Name: "homelab_ghostfolio-ghostfolio-db-1", Image: "docker.io/library/postgres:17", Running: true, Project: "homelab_ghostfolio", Service: "ghostfolio-db"}}
}

func TestDBUpgrade(t *testing.T) {
	calls := fakeDocker(t, ghostfolioDB())
	root, _ := repoCopy(t, "GHOSTFOLIO_DB_VERSION=17")
	if out, code := homelabCmd(t, root, "", "db", "upgrade", "ghostfolio-db", "--to", "16"); code == 0 || !strings.Contains(out, "later major version") {
		t.Errorf("going down (exit %d):\n%s", code, out)
	}
	if out, code := homelabCmd(t, root, "", "db", "upgrade", "immich-database"); code == 0 || !strings.Contains(out, "ghostfolio-db") {
		t.Errorf("a database it does not know (exit %d):\n%s", code, out)
	}
	out, code := homelabCmd(t, root, "", "db", "upgrade", "ghostfolio-db", "--apply")
	if code != 0 {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	log := readCalls(t, calls)
	for _, want := range []string{"pull --quiet docker.io/library/postgres:18", "pg_dumpall", "tar czf -", "stop ghostfolio-db", "rm -rf /v/*", "up --detach --no-deps ghostfolio-db", "pg_isready", "exec -i homelab_ghostfolio-ghostfolio-db-1"} {
		if !strings.Contains(log, want) {
			t.Errorf("missing %q in:\n%s", want, log)
		}
	}
	env, _ := envfile.Load(filepath.Join(root, ".env"))
	if v, _ := env.Get("GHOSTFOLIO_DB_VERSION"); v != "18" {
		t.Errorf("GHOSTFOLIO_DB_VERSION = %q", v)
	}
}

func TestDBUpgradeGoesBackWhenTheRestoreIsEmpty(t *testing.T) {
	calls := fakeDocker(t, ghostfolioDB())
	t.Setenv("FAKE_PG_DATABASES", "0")
	root, _ := repoCopy(t, "GHOSTFOLIO_DB_VERSION=17")
	out, code := homelabCmd(t, root, "", "db", "upgrade", "ghostfolio-db", "--apply")
	if code == 0 || !strings.Contains(out, "back on PostgreSQL 17") {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	if log := readCalls(t, calls); !strings.Contains(log, "tar xzf - -C /v") {
		t.Errorf("the volume was not restored:\n%s", log)
	}
	env, _ := envfile.Load(filepath.Join(root, ".env"))
	if v, _ := env.Get("GHOSTFOLIO_DB_VERSION"); v != "17" {
		t.Errorf("GHOSTFOLIO_DB_VERSION = %q after going back", v)
	}
}
