package main

import (
	"context"
	"fmt"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/duplicati"
)

// The weekly integrity check: once a week (Sunday from verifyHour, after
// the night's off-site runs), each Duplicati job's backup is checked with
// Duplicati's own Verify: a sample of its files downloaded and compared
// with the hashes it recorded. A damaged file there means a version may
// not restore; the watchdog then counts the job as failing (and alerts),
// and Backups says so beside it, until a check passes again.
const verifyHour = 7

// verifyWait is how long one job's check may take: Duplicati retries a
// bad file a few times (about a minute) and a large sample takes longer.
var verifyWait = 30 * time.Minute

// verifyDue reports whether the weekly check should run now: past this
// week's Sunday at verifyHour, and none since.
func verifyDue(now, last time.Time) bool {
	slot := time.Date(now.Year(), now.Month(), now.Day(), verifyHour, 0, 0, 0, now.Location())
	slot = slot.AddDate(0, 0, -int(slot.Weekday()))
	if now.Before(slot) {
		slot = slot.AddDate(0, 0, -7)
	}
	return last.Before(slot)
}

// backupCheck checks each Duplicati job's backup now (homelab
// backup-check; the agent runs it weekly).
func (h *homelab) backupCheck(ctx context.Context, args []string) error {
	fs := newFlags("backup-check")
	quiet := fs.Bool("quiet", false, "")
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	env := h.envMap()
	path := duplicati.CheckPath(h.root)
	checks := duplicati.LoadChecks(path)
	checks.At = time.Now()
	done := func() error { return checks.Save(path) }
	if env["DUPLICATI_PASSWORD"] == "" {
		if !*quiet {
			h.ui.Info("Duplicati is not set up yet, so there is nothing to check (Setup › Backups)")
		}
		return done()
	}
	client, err := h.docker(ctx)
	if err != nil {
		return err
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return err
	}
	if st, _ := detect.Analyze(h.catalog, containers).State("duplicati"); st != detect.Running {
		if !*quiet {
			h.ui.Info("Duplicati is not running, so its backups were not checked")
		}
		return done()
	}
	port := env["DUPLICATI_PORT"]
	if port == "" {
		port = "8200"
	}
	c, err := duplicati.Login(ctx, "http://127.0.0.1:"+port, env["DUPLICATI_PASSWORD"])
	if err != nil {
		return err
	}
	jobs, err := c.Jobs(ctx, time.Now())
	if err != nil {
		return err
	}
	kept := map[string]duplicati.Check{}
	failed := 0
	for _, j := range jobs {
		if j.State == "never" {
			continue // nothing at the destination yet
		}
		problem, err := c.Verify(ctx, j.ID, verifyWait)
		if err != nil {
			h.ui.Warn("%s: the check did not run: %v", j.Name, err)
			if k, ok := checks.Jobs[j.Name]; ok {
				kept[j.Name] = k // what the last one found still stands
			}
			continue
		}
		problem = duplicati.ShortProblem(problem)
		k := duplicati.Check{When: time.Now(), Problem: problem}
		if problem == "" {
			k.Cleared = checks.Jobs[j.Name].Problem
		}
		kept[j.Name] = k
		if problem != "" {
			failed++
			h.ui.Fail("%s: %s", j.Name, problem)
		} else if !*quiet {
			h.ui.OK("%s: a sample of its files matches what Duplicati recorded", j.Name)
		}
	}
	checks.Jobs = kept
	if err := done(); err != nil {
		return err
	}
	if failed > 0 {
		return fmt.Errorf("%d backup(s) failed the check: a version may not restore. Open the job in Duplicati, or homelab report for help", failed)
	}
	return nil
}
