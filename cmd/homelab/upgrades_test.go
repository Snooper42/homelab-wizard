package main

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/people"
	"github.com/Snooper42/homelab-wizard/internal/savings"
	"github.com/Snooper42/homelab-wizard/internal/setup"
	"github.com/Snooper42/homelab-wizard/internal/updates"
)

// TestEachReleasesFolderUpgrades opens the state each release's homelab
// folder keeps (testdata/upgrades/<tag>, made by that release's own code
// with make.sh; its .env as homelab.env) with this build: the newest compose files and
// .env.example, then install, Setup, and Status as after an upgrade. No
// question is asked, every setting stays as it was, and the phones, the
// update history and held updates, Setup's steps, the restore tests, the
// watchdog's state, the savings, and the household all read back.
func TestEachReleasesFolderUpgrades(t *testing.T) {
	sets, _ := filepath.Glob(filepath.Join(repoDir(), "testdata", "upgrades", "v*"))
	if len(sets) < 8 {
		t.Fatalf("testdata/upgrades holds %d releases, want 0.2.0 to 0.9.0-beta: %v", len(sets), sets)
	}
	day := time.Date(2026, 6, 1, 3, 30, 0, 0, time.UTC)
	for _, set := range sets {
		t.Run(filepath.Base(set), func(t *testing.T) {
			// Nothing running yet, as after a restart into the new version.
			calls := fakeDocker(t, nil)
			root, _ := repoCopy(t)
			if err := copyTree(set, root, false); err != nil {
				t.Fatal(err)
			}
			if err := os.Rename(filepath.Join(root, "homelab.env"), filepath.Join(root, ".env")); err != nil {
				t.Fatal(err)
			}
			before := envMapOf(t, root)

			installed := ""
			for _, args := range [][]string{{"install", "ntfy", "--apply"}, {"setup"}, {"status"}} {
				// No input: a question would read nothing and stop.
				out, code := homelabCmd(t, root, "", args...)
				if code != 0 {
					t.Fatalf("homelab %s (exit %d):\n%s", strings.Join(args, " "), code, out)
				}
				if args[0] == "install" {
					installed = out
				}
			}

			if log := readCalls(t, calls); !strings.Contains(log, "up --detach") {
				t.Errorf("install started nothing:\n%s", log)
			}
			after := envMapOf(t, root)
			// A value changes only where it was still the template's (or
			// empty) and install filled in this machine's own, as it says
			// (envfile.Prepare: the home network, AdGuard's address);
			// never one a person set.
			example := envMapOf(t, root, ".env.example")
			for k, v := range before {
				if after[k] == v {
					continue
				}
				if (v == "" || v == example[k]) && strings.Contains(installed, k+": this machine's") {
					t.Logf("%s: the template's %q, now this machine's %q", k, v, after[k])
					continue
				}
				t.Errorf("%s was %q, now %q", k, v, after[k])
			}
			if after["TZ"] != "Europe/Amsterdam" || after["NTFY_PORT"] != "9393" {
				t.Errorf("the settings changed in Settings: TZ=%q NTFY_PORT=%q", after["TZ"], after["NTFY_PORT"])
			}
			// And it has this build's new settings, from .env.example.
			added := 0
			for k := range example {
				if _, ok := after[k]; !ok {
					t.Errorf("%s, new in .env.example, is not in .env", k)
				}
				if _, had := before[k]; !had {
					added++
				}
			}
			t.Logf("%d settings kept, %d added", len(before), added)

			var names []string
			for _, d := range companion.NewStore(companion.StorePath(root)).Devices() {
				names = append(names, d.Name)
				if d.Name == "Kitchen iPad" && !d.CanChange || d.Name == "Grandma's phone" && d.CanChange {
					t.Errorf("%s may make changes: %v", d.Name, d.CanChange)
				}
			}
			if slices.Sort(names); !slices.Equal(names, []string{"Grandma's phone", "Kitchen iPad"}) {
				t.Errorf("paired phones: %v", names)
			}

			hist := updates.LoadHistory(updates.HistoryPath(root))
			if r := hist.Apps["ntfy"]; r == nil || r.Previous != "sha256:"+strings.Repeat("1", 64) || !r.Updated.Equal(day.Add(-48*time.Hour)) {
				t.Errorf("ntfy's update record: %+v", r)
			}
			if !slices.Contains(updates.Held(after), "ntfy") {
				t.Errorf("ntfy's updates are no longer held: %v", updates.Held(after))
			}

			if done := setup.LoadDone(root); !done["tunnel"] || !done["alerts"] {
				t.Errorf("Setup's steps marked done: %v", done)
			}

			rl := backup.LoadRestoreLog(filepath.Join(root, "scripts", "logs", "restore-test.json"))
			if !rl.LastTest.Equal(day.Add(-10*24*time.Hour)) || len(rl.History) != 1 || rl.History[0].Job != "Homelab AppData" || rl.LastTook() != 42*time.Second {
				t.Errorf("the restore tests: %+v", rl)
			}

			if st := health.LoadState(health.StatePath(root)); !st.Failing["paperless"].Equal(day.Add(-2 * time.Hour)) {
				t.Errorf("the watchdog's state: %+v", st)
			}

			if points := savings.LoadHistory(savings.HistoryPath(root)); len(points) != 7 {
				t.Errorf("the savings: %d days, want 7", len(points))
			}

			household, err := people.Load(filepath.Join(root, "data", "people.json"))
			if err != nil || len(household) != 1 || household[0].Name != "Sam" || !slices.Equal(household[0].Apps, []string{"immich-server", "vaultwarden"}) {
				t.Errorf("the household: %+v, %v", household, err)
			}
		})
	}
}

func envMapOf(t *testing.T, root string, name ...string) map[string]string {
	t.Helper()
	file := ".env"
	if len(name) > 0 {
		file = name[0]
	}
	f, err := envfile.Load(filepath.Join(root, file))
	if err != nil {
		t.Fatal(err)
	}
	return f.Map()
}
