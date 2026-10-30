//go:build ignore

// The state a homelab folder of one release keeps, written by that
// release's own code: make.sh copies this file into a checkout of each tag
// and runs it there, after the tag's own CLI has made .env. Only APIs every
// release from 0.2.0 has are used, so it builds against each.
//
//	go run ./cmd/fixture/main.go <homelab folder>
package main

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/people"
	"github.com/Snooper42/homelab-wizard/internal/savings"
	"github.com/Snooper42/homelab-wizard/internal/setup"
	"github.com/Snooper42/homelab-wizard/internal/updates"
)

func main() {
	if err := write(os.Args[1]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

// The day the fixture's homelab lived, so each release's files read alike.
var day = time.Date(2026, 6, 1, 3, 30, 0, 0, time.UTC)

func write(root string) error {
	// A phone paired, allowed to make changes, and one that may only look.
	phones := companion.NewStore(companion.StorePath(root))
	phones.Now = func() time.Time { return day }
	for _, p := range []struct {
		name      string
		canChange bool
	}{{"Kitchen iPad", true}, {"Grandma's phone", false}} {
		code, err := phones.NewPairing(p.name, p.canChange)
		if err != nil {
			return err
		}
		if _, _, err := phones.Pair(code, p.name); err != nil {
			return err
		}
	}

	// ntfy updated two days before, its previous image kept, and its
	// updates held (UPDATES_HELD, set by make.sh through the CLI).
	h := updates.History{Apps: map[string]*updates.Record{
		"ntfy": {Ref: "binwiederhier/ntfy:latest", Current: "sha256:" + hex('2'), Previous: "sha256:" + hex('1'), Updated: day.Add(-48 * time.Hour)},
		"uptime-kuma": {Ref: "louislam/uptime-kuma:2", Current: "sha256:" + hex('3'), Updated: day.Add(-30 * 24 * time.Hour)},
	}}
	if err := h.Save(updates.HistoryPath(root)); err != nil {
		return err
	}

	// Setup's manual steps marked done.
	for _, id := range []string{"tunnel", "alerts"} {
		if err := setup.MarkDone(root, id, true); err != nil {
			return err
		}
	}

	// A passing restore test, and the reminders sent.
	logs := filepath.Join(root, "scripts", "logs")
	rl := backup.RestoreLog{LastReminder: day.Add(-40 * 24 * time.Hour)}
	rl.Record(backup.RestoreRun{When: day.Add(-10 * 24 * time.Hour), Seconds: 42, Passed: true, Summary: "12 of 12 sampled files identical", Job: "Homelab AppData"})
	if err := rl.Save(filepath.Join(logs, "restore-test.json")); err != nil {
		return err
	}

	// The watchdog's last run, with Paperless failing since the night.
	st := health.State{Failing: map[string]time.Time{"paperless": day.Add(-2 * time.Hour)}, LastRun: day, Checks: 7, Problems: map[string]string{"paperless": "no answer in time"}}
	if err := st.Save(health.StatePath(root)); err != nil {
		return err
	}

	// A week of savings.
	for i := 6; i >= 0; i-- {
		if err := savings.Record(savings.HistoryPath(root), day.Add(-time.Duration(i)*24*time.Hour), 1074.73); err != nil {
			return err
		}
	}

	// Someone in the household, with the apps they use.
	return people.Save(filepath.Join(root, "data", "people.json"), []people.Person{{Username: "sam", Name: "Sam", Email: "sam@example.com", PocketID: "p-1", Added: day.Add(-90 * 24 * time.Hour), Apps: []string{"immich-server", "vaultwarden"}}})
}

func hex(c byte) string {
	b := make([]byte, 64)
	for i := range b {
		b[i] = c
	}
	return string(b)
}
