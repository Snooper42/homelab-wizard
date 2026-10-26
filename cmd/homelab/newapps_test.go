package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// newApps are the apps added to the catalog since October 2026, each
// installed and backed up end to end against the fake docker. The nightly
// run (test/realdocker) starts the same apps for real.
var newApps = []struct {
	id, project string
	// folders install makes for the app's data, under the homelab
	folders []string
	// dumps are the files the nightly backup writes for it (globs under
	// recovery-staging), with its containers running
	dumps []string
	// running are its services that run for the backup: the app alone
	// when empty, else its database too
	running []string
}{
	{id: "actual-budget", project: "homelab_finance", folders: []string{"data/appdata/actual-budget"}, dumps: []string{"databases/actual-budget/actual-budget-*.sqlite.gz"}},
	{id: "beszel", project: "homelab_beszel", folders: []string{"appdata/beszel"}, dumps: []string{"databases/beszel/beszel-*.sqlite.gz"}},
	{id: "firefly-iii", project: "homelab_firefly_iii", dumps: []string{"databases/firefly-iii-db/firefly-iii-db-*.sql.gz", "volumes/firefly-iii-upload/*"}, running: []string{"firefly-iii", "firefly-iii-db"}},
	// Kiwix has nothing to back up: its library list is rebuilt at each start.
	{id: "kiwix", project: "homelab_documents", folders: []string{"data/appdata/kiwix/library.xml"}},
	{id: "tandoor", project: "homelab_tandoor", folders: []string{"appdata/tandoor/media"}, dumps: []string{"databases/tandoor-db/tandoor-db-*.sql.gz"}, running: []string{"tandoor", "tandoor-db"}},
	{id: "nextcloud", project: "homelab_nextcloud", folders: []string{"appdata/nextcloud/html", "appdata/nextcloud/data"}, dumps: []string{"databases/nextcloud-db/nextcloud-db-*.sql.gz"}, running: []string{"nextcloud", "nextcloud-db"}},
	{id: "linkwarden", project: "homelab_linkwarden", folders: []string{"appdata/linkwarden"}, dumps: []string{"databases/linkwarden-db/linkwarden-db-*.sql.gz"}, running: []string{"linkwarden", "linkwarden-db"}},
}

func TestNewAppsInstallAndBackUp(t *testing.T) {
	for _, app := range newApps {
		t.Run(app.id, func(t *testing.T) {
			calls := fakeDocker(t, nil)
			root, _ := repoCopy(t)
			out, code := homelabCmd(t, root, "", "install", app.id, "--apply")
			if code != 0 {
				t.Fatalf("install exit %d:\n%s", code, out)
			}
			log := readCalls(t, calls)
			if !strings.Contains(log, "-p "+app.project+" ") || !strings.Contains(log, "--profile optional up --detach --no-recreate "+app.id) {
				t.Errorf("%s was not started in %s:\n%s", app.id, app.project, log)
			}
			for _, f := range app.folders {
				if _, err := os.Stat(filepath.Join(root, filepath.FromSlash(f))); err != nil {
					t.Errorf("install did not make %s", f)
				}
			}

			running := app.running
			if len(running) == 0 {
				running = []string{app.id}
			}
			var ctrs []docker.FakeContainer
			for _, s := range running {
				ctrs = append(ctrs, docker.FakeContainer{Name: app.project + "-" + s + "-1", Image: "example/" + s, Running: true, Project: app.project, Service: s})
			}
			fakeDocker(t, ctrs)
			out, code = homelabCmd(t, root, "", "backup", "--apply")
			if code != 0 {
				t.Fatalf("backup exit %d:\n%s", code, out)
			}
			for _, d := range app.dumps {
				if got, _ := filepath.Glob(filepath.Join(root, "recovery-staging", filepath.FromSlash(d))); len(got) != 1 {
					all, _ := filepath.Glob(filepath.Join(root, "recovery-staging", "databases", "*", "*"))
					t.Errorf("backup wrote %v for %s (all: %v):\n%s", got, d, all, out)
				}
			}
		})
	}
}
