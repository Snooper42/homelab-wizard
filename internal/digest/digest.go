// Package digest writes the weekly summary the nightly backup sends on
// Sundays: how the apps, the watchdog's other checks, backups, off-site
// jobs, and restore test are doing, the updates waiting, and the savings, so a quiet week is a
// confirmed one rather than an unknown.
package digest

import (
	"fmt"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/crowdsec"
	"github.com/Snooper42/homelab-wizard/internal/diskhealth"
	"github.com/Snooper42/homelab-wizard/internal/diskspace"
	"github.com/Snooper42/homelab-wizard/internal/duplicati"
	"github.com/Snooper42/homelab-wizard/internal/health"
)

// Input is what the summary reads.
type Input struct {
	Status   *api.Status // nil when the container runtime is not running
	Backups  backup.Overview
	Jobs     []duplicati.Job
	JobsErr  error           // why the off-site jobs could not be read
	Behind   int             // homelab changes waiting on GitHub
	Watchdog *health.Summary // its last run; nil when not read
	// What CrowdSec caught this week; nil when it or the proxy is not
	// running. Whether bans are enforced is the watchdog's to say.
	Protection *crowdsec.Protection
	// The disks the homelab writes to; nil when not read.
	Disks []diskspace.Volume
	// Each drive's health report; nil when smartctl is not installed.
	Drives   []diskhealth.Disk
	Now      time.Time
	Currency func(float64) string // formats the yearly savings
	// New is a homelab in its first week (setup.Grace): what is not set up
	// yet is listed as still to set up (◦), not counted as needing a look.
	New bool
}

// Summary is the week's title and body, and how many things need a look.
func Summary(in Input) (title, body string, problems int) {
	var lines []string
	add := func(problem bool, format string, args ...any) {
		mark := "✓ "
		if problem {
			mark, problems = "• ", problems+1
		}
		lines = append(lines, mark+fmt.Sprintf(format, args...))
	}
	// setUp is a line about something a new homelab has not set up yet.
	toSet := 0
	setUp := func(format string, args ...any) {
		if !in.New {
			add(true, format, args...)
			return
		}
		toSet++
		lines = append(lines, "◦ "+fmt.Sprintf(format, args...))
	}

	listed := map[string]bool{} // apps the first line names
	if in.Status == nil {
		add(true, "The container runtime is not running")
	} else {
		running, total := 0, 0
		var unwell []string
		for _, a := range in.Status.Apps {
			total++
			switch {
			case a.State == "running" && a.Health != "unhealthy" && a.Health != "restarting":
				running++
			case a.State == "running":
				running++
				unwell = append(unwell, a.Name+" ("+a.Health+")")
				listed[a.ID] = true
			case a.State == "missing":
				unwell = append(unwell, a.Name+" (not running)")
				listed[a.ID] = true
			default:
				total-- // stopped optional apps were stopped on purpose
			}
		}
		if len(unwell) == 0 {
			add(false, "%d apps running and healthy", running)
		} else {
			add(true, "%d of %d apps well; needs a look: %s", total-len(unwell), total, strings.Join(unwell, ", "))
		}
	}

	if w := in.Watchdog; w != nil {
		// Apps, database copies, Duplicati jobs, and disks have their own lines.
		var other []string
		for _, f := range w.Failing {
			if !listed[f.Name] && !strings.HasSuffix(f.Name, " backup") && !strings.HasPrefix(f.Name, "duplicati ") && (in.Disks == nil || !strings.HasPrefix(f.Name, "disk space ")) && (in.Drives == nil || !strings.HasPrefix(f.Name, "drive health ")) {
				other = append(other, f.Name)
			}
		}
		switch {
		case w.LastRun.IsZero():
			setUp("The watchdog has not run yet (Setup › Install the jobs)")
		case in.Now.Sub(w.LastRun) > time.Hour:
			add(true, "The watchdog has not run since %s (homelab schedule status)", w.LastRun.In(in.Now.Location()).Format("Mon 15:04"))
		case len(other) > 0:
			add(true, "Watchdog: failing: %s", strings.Join(other, ", "))
		default:
			add(false, "Watchdog: %d checks passing", w.Checks-len(w.Failing))
		}
	}

	o := in.Backups
	switch {
	case len(o.Copies) == 0:
		setUp("No database copies yet (the nightly backup has not run)")
	case o.Stale > 0:
		var stale []string
		for _, c := range o.Copies {
			if c.State != "fresh" {
				stale = append(stale, c.Name)
			}
		}
		add(true, "Backups: %d stale (%s)", o.Stale, strings.Join(stale, ", "))
	default:
		word := "copies"
		if len(o.Copies) == 1 {
			word = "copy"
		}
		add(false, "Backups: %d %s, all fresh", len(o.Copies), word)
	}
	if !o.DestinationOK {
		setUp("The backup folder (Settings › Backups go to) is not set, or not found")
	}

	switch {
	case in.JobsErr != nil:
		add(true, "Off-site jobs: %v", in.JobsErr)
	case len(in.Jobs) == 0:
		setUp("Off-site jobs: none yet (Setup › Create the backup jobs)")
	default:
		var bad []string
		for _, j := range in.Jobs {
			if j.State == "failed" || j.State == "stale" {
				bad = append(bad, j.Name)
			}
		}
		if len(bad) == 0 {
			add(false, "Off-site jobs: all %d ran", len(in.Jobs))
		} else {
			add(true, "Off-site jobs need a look: %s", strings.Join(bad, ", "))
		}
	}

	if f, failed := o.RestoreTest.LastFailed(); failed {
		add(true, "The last restore test failed (%s): %s", days(in.Now.Sub(f.When)), f.Summary)
	} else if t := o.RestoreTest.LastTest; t.IsZero() {
		setUp("No restore test yet (Backups › Test a restore)")
	} else if o.RestoreDue {
		add(true, "Restore test due: the last was %s", days(in.Now.Sub(t)))
	} else if d := o.RestoreTest.LastTook(); d > 0 {
		add(false, "Restore proven %s, in %s", days(in.Now.Sub(t)), shortDuration(d))
	} else {
		add(false, "Restore proven %s", days(in.Now.Sub(t)))
	}
	if len(o.PlainExports) > 0 {
		add(true, "Delete the readable vault export in recovery-staging/secrets")
	} else if o.VaultDue {
		setUp("Vault export due (Backups › Password vault export)")
	}

	if len(in.Disks) > 0 {
		var low []string
		for _, v := range in.Disks {
			if v.Low() {
				low = append(low, fmt.Sprintf("%s, %s", v.Label(), v.Describe()))
			}
		}
		switch least := diskspace.Lowest(in.Disks)[0]; {
		case len(low) > 0:
			add(true, "Disk space low: %s", strings.Join(low, "; "))
		case len(in.Disks) == 1:
			add(false, "Disk space: %s", least.Describe())
		default:
			add(false, "Disk space: at least %s free on each of %d disks", diskspace.Size(least.Free), len(in.Disks))
		}
	}

	if len(in.Drives) > 0 {
		var failing, worn []string
		passing := 0
		for _, d := range in.Drives {
			switch {
			case d.Failing():
				failing = append(failing, d.Label())
			case !d.Readable:
			case len(d.Warnings) > 0:
				worn = append(worn, fmt.Sprintf("%s (%s)", d.Label(), strings.Join(d.Warnings, ", ")))
			default:
				passing++
			}
		}
		switch {
		case len(failing) > 0:
			add(true, "Drive failing: %s; copy what matters off it now", strings.Join(failing, ", "))
		case len(worn) > 0:
			add(true, "Drive wearing: %s; plan to replace it", strings.Join(worn, "; "))
		case passing > 0:
			add(false, "Drive health: %d passing", passing)
		}
	}

	if p := in.Protection; p != nil && p.Week > 0 {
		word := "attacks"
		if p.Week == 1 {
			word = "attack"
		}
		lines = append(lines, fmt.Sprintf("CrowdSec caught %d %s this week", p.Week, word))
	}
	if in.Behind > 0 {
		lines = append(lines, fmt.Sprintf("↑ %d homelab update(s) waiting: Setup › Update", in.Behind))
	}
	if in.Status != nil && in.Status.Savings > 0 && in.Currency != nil {
		lines = append(lines, "Replacing "+in.Currency(in.Status.Savings)+" a year in subscriptions")
	}

	title = "Homelab this week: all well"
	if problems == 0 && toSet > 0 {
		title = fmt.Sprintf("Homelab this week: getting started, %d still to set up (Setup)", toSet)
	}
	if problems == 1 {
		title = "Homelab this week: 1 thing needs a look"
	} else if problems > 1 {
		title = fmt.Sprintf("Homelab this week: %d things need a look", problems)
	}
	return title, strings.Join(lines, "\n"), problems
}

// Due says whether this week's summary should go now: on Sundays, once.
func Due(now, lastSent time.Time) bool {
	if now.Weekday() != time.Sunday {
		return false
	}
	y1, w1 := now.ISOWeek()
	y2, w2 := lastSent.ISOWeek()
	return lastSent.IsZero() || y1 != y2 || w1 != w2
}

// shortDuration is how long something took: "50 seconds", "4 minutes".
func shortDuration(d time.Duration) string {
	if d < 2*time.Minute {
		return fmt.Sprintf("%d seconds", int(d.Seconds()))
	}
	return fmt.Sprintf("%d minutes", int(d.Round(time.Minute).Minutes()))
}

func days(d time.Duration) string {
	n := int(d.Hours() / 24)
	switch n {
	case 0:
		return "today"
	case 1:
		return "yesterday"
	}
	return fmt.Sprintf("%d days ago", n)
}
