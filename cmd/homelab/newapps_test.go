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
	// recovery-staging), with its container running
	dumps []string
}{
	{id: "actual-budget", project: "homelab_finance", folders: []string{"data/appdata/actual-budget"}, dumps: []string{"databases/actual-budget/actual-budget-*.sqlite.gz"}},
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

			fakeDocker(t, []docker.FakeContainer{{Name: app.project + "-" + app.id + "-1", Image: "example/" + app.id, Running: true, Project: app.project, Service: app.id}})
			out, code = homelabCmd(t, root, "", "backup", "--apply")
			if code != 0 {
				t.Fatalf("backup exit %d:\n%s", code, out)
			}
			for _, d := range app.dumps {
				if got, _ := filepath.Glob(filepath.Join(root, "recovery-staging", filepath.FromSlash(d))); len(got) != 1 {
					t.Errorf("backup wrote %v for %s:\n%s", got, d, out)
				}
			}
		})
	}
}
