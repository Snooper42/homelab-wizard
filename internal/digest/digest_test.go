package digest

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/crowdsec"
	"github.com/Snooper42/homelab-wizard/internal/diskhealth"
	"github.com/Snooper42/homelab-wizard/internal/diskspace"
	"github.com/Snooper42/homelab-wizard/internal/duplicati"
	"github.com/Snooper42/homelab-wizard/internal/health"
)

func TestSummary(t *testing.T) {
	now := time.Date(2026, 10, 18, 4, 40, 0, 0, time.UTC)
	well := Input{
		Status: &api.Status{Savings: 3935.33, Apps: []api.AppStatus{
			{Name: "Vaultwarden", State: "running", Health: "healthy"}, {Name: "Immich", State: "running"},
			{Name: "Mealie", State: "stopped"},
		}},
		Backups: backup.Overview{DestinationOK: true, Copies: []backup.Copy{{Name: "Vaultwarden", State: "fresh"}},
			RestoreTest: backup.RestoreLog{LastTest: now.Add(-12 * 24 * time.Hour)}},
		Jobs:       []duplicati.Job{{Name: "Homelab Secrets", State: "ok"}},
		Watchdog:   &health.Summary{LastRun: now.Add(-10 * time.Minute), Checks: 41},
		Protection: &crowdsec.Protection{Enforced: true, Week: 14},
		Now:        now,
		Currency:   func(f float64) string { return "$3,935" },
	}
	title, body, n := Summary(well)
	if n != 0 || title != "Homelab this week: all well" {
		t.Fatalf("%q (%d):\n%s", title, n, body)
	}
	for _, want := range []string{"✓ 2 apps running and healthy", "✓ Backups: 1 copy, all fresh", "✓ Off-site jobs: all 1 ran", "✓ Restore proven 12 days ago", "✓ Watchdog: 41 checks passing", "CrowdSec caught 14 attacks this week", "Replacing $3,935 a year"} {
		if !strings.Contains(body, want) {
			t.Errorf("missing %q in:\n%s", want, body)
		}
	}

	bad := well
	bad.Status = &api.Status{Apps: []api.AppStatus{{Name: "Vaultwarden", State: "running", Health: "unhealthy"}, {Name: "ntfy", State: "missing"}}}
	bad.Backups.Stale, bad.Backups.Copies = 1, []backup.Copy{{Name: "Mealie", State: "stale"}}
	bad.Backups.RestoreDue = true
	bad.Backups.RestoreTest.LastTest = now.Add(-40 * 24 * time.Hour)
	bad.JobsErr = errors.New("Duplicati refused DUPLICATI_PASSWORD")
	bad.Behind = 3
	// The apps and backups the watchdog also caught are counted once.
	bad.Status.Apps[0].ID, bad.Status.Apps[1].ID = "vaultwarden", "ntfy"
	bad.Watchdog = &health.Summary{LastRun: now.Add(-10 * time.Minute), Checks: 41, Failing: []health.Failure{
		{Name: "vaultwarden"}, {Name: "mealie backup"}, {Name: "duplicati jobs"}, {Name: "crowdsec bouncer"}, {Name: "photos.example.com"}}}
	title, body, n = Summary(bad)
	if n != 5 || title != "Homelab this week: 5 things need a look" {
		t.Fatalf("%q (%d):\n%s", title, n, body)
	}
	for _, want := range []string{"• 0 of 2 apps well; needs a look: Vaultwarden (unhealthy), ntfy (not running)", "• Backups: 1 stale (Mealie)", "• Off-site jobs: Duplicati refused", "• Restore test due: the last was 40 days ago", "• Watchdog: failing: crowdsec bouncer, photos.example.com", "↑ 3 homelab update(s) waiting"} {
		if !strings.Contains(body, want) {
			t.Errorf("missing %q in:\n%s", want, body)
		}
	}

	if title, _, n := Summary(Input{Now: now}); n < 3 || !strings.Contains(title, "need a look") {
		t.Errorf("nothing set up: %q %d", title, n)
	}
	for _, c := range []struct {
		w    health.Summary
		want string
	}{
		{health.Summary{}, "• The watchdog has not run yet"},
		{health.Summary{LastRun: now.Add(-5 * time.Hour), Checks: 41}, "• The watchdog has not run since Sat 23:40"},
	} {
		in := well
		in.Watchdog = &c.w
		if _, body, _ := Summary(in); !strings.Contains(body, c.want) {
			t.Errorf("missing %q in:\n%s", c.want, body)
		}
	}

	// Disks: the least free space when all have room; a low one counted
	// once, though the watchdog also fails it.
	const gb = 1 << 30
	roomy := diskspace.Volume{Names: []string{"homelab folder", "backups"}, Free: 412 * gb, Total: 994 * gb}
	media := diskspace.Volume{Names: []string{"photos", "media"}, Free: 1600 * gb, Total: 3600 * gb}
	disks := well
	disks.Disks = []diskspace.Volume{roomy}
	if _, body, _ := Summary(disks); !strings.Contains(body, "✓ Disk space: 412 GB free of 994 GB (41%)") {
		t.Errorf("one disk:\n%s", body)
	}
	disks.Disks = []diskspace.Volume{media, roomy}
	if _, body, _ := Summary(disks); !strings.Contains(body, "✓ Disk space: at least 412 GB free on each of 2 disks") {
		t.Errorf("two disks:\n%s", body)
	}
	low := roomy
	low.Free = 6 * gb
	disks.Disks = []diskspace.Volume{media, low}
	disks.Watchdog = &health.Summary{LastRun: now.Add(-10 * time.Minute), Checks: 41, Failing: []health.Failure{{Name: "disk space (homelab folder)"}}}
	if _, body, n := Summary(disks); n != 1 || !strings.Contains(body, "• Disk space low: homelab folder, backups, 6.0 GB free of 994 GB (0%)") || strings.Contains(body, "Watchdog: failing") {
		t.Errorf("low disk (%d):\n%s", n, body)
	}

	// Drives: passing ones counted, a failing one named once (not again
	// under the watchdog), wear named with its signs.
	drives := well
	drives.Drives = []diskhealth.Disk{{Model: "APPLE SSD", Readable: true, Passed: true}, {Device: "/dev/disk5"}}
	if _, body, _ := Summary(drives); !strings.Contains(body, "✓ Drive health: 1 passing") {
		t.Errorf("passing drive:\n%s", body)
	}
	drives.Drives = append(drives.Drives, diskhealth.Disk{Model: "WDC", Readable: true})
	drives.Watchdog = &health.Summary{LastRun: now.Add(-10 * time.Minute), Checks: 41, Failing: []health.Failure{{Name: "drive health (WDC)"}}}
	if _, body, n := Summary(drives); n != 1 || !strings.Contains(body, "• Drive failing: WDC") || strings.Contains(body, "Watchdog: failing") {
		t.Errorf("failing drive (%d):\n%s", n, body)
	}
	drives.Drives, drives.Watchdog = []diskhealth.Disk{{Model: "SSD", Readable: true, Passed: true, Warnings: []string{"2 media errors"}}}, well.Watchdog
	if _, body, _ := Summary(drives); !strings.Contains(body, "• Drive wearing: SSD (2 media errors)") {
		t.Errorf("worn drive:\n%s", body)
	}

	// Restore drills: how long the last one took, and a failure since.
	passed := backup.RestoreRun{When: now.Add(-12 * 24 * time.Hour), Seconds: 185, Passed: true}
	timed := well
	timed.Backups.RestoreTest.History = []backup.RestoreRun{passed}
	if _, body, _ := Summary(timed); !strings.Contains(body, "✓ Restore proven 12 days ago, in 3 minutes") {
		t.Errorf("no timing in:\n%s", body)
	}
	failed := well
	failed.Backups.RestoreTest.History = []backup.RestoreRun{passed, {When: now.Add(-2 * 24 * time.Hour), Seconds: 60, Summary: "2 of 12 sampled files differ"}}
	if _, body, n := Summary(failed); n != 1 || !strings.Contains(body, "• The last restore test failed (2 days ago): 2 of 12 sampled files differ") {
		t.Errorf("failure not reported (%d):\n%s", n, body)
	}
}

func TestDue(t *testing.T) {
	sunday := time.Date(2026, 10, 18, 4, 40, 0, 0, time.UTC)
	if !Due(sunday, time.Time{}) || !Due(sunday, sunday.AddDate(0, 0, -7)) {
		t.Error("Sunday, not sent this week: due")
	}
	if Due(sunday.Add(2*time.Hour), sunday) {
		t.Error("already sent today")
	}
	if Due(sunday.AddDate(0, 0, 1), time.Time{}) {
		t.Error("a Monday is never due")
	}
}
