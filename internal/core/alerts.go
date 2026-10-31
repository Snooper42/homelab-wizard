package core

import (
	"context"
	"slices"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/notify"
)

// The alerts whose problem can be seen to clear: the watchdog's (on its
// topic) and the nightly backup's (on Duplicati's).
const (
	DownTitle         = "Homelab: something is down"
	BackupFailedTitle = "Homelab backup failed"
)

// DownLine is a failing check, as the watchdog's alert names it.
func DownLine(r health.Result) string { return r.Name + ": " + r.Problem() }

// NotRunningLine and OutsideLine are an app the nightly backup skipped, as
// its alert names it.
func NotRunningLine(id string) string { return id + " is not running, so it was not backed up" }
func OutsideLine(id string) string {
	return id + " runs outside the homelab, so it was not backed up (homelab adopt " + id + ")"
}

// skipped is the app a line of the backup's alert says it skipped.
func skipped(line string) (string, bool) {
	id, _, _ := strings.Cut(line, " ")
	return id, line == NotRunningLine(id) || line == OutsideLine(id)
}

// Current leaves out the alerts whose problem has cleared since they were
// sent: the watchdog's once a later run passed every check it named, and
// the backup's once every app it skipped runs in the homelab again (the
// watchdog notices a dump that stays too old). running is asked only when
// a backup's alert is there. The rest stay until ntfy forgets them.
func Current(events []notify.Event, watch health.State, running func() func(id string) bool) []notify.Event {
	var runs func(id string) bool
	cleared := func(e notify.Event) bool {
		lines := strings.Split(strings.TrimSpace(e.Message), "\n")
		switch {
		case e.Topic == "tunnel-watchdog" && e.Title == DownTitle:
			if !watch.LastRun.After(e.Time) {
				return false
			}
			return !slices.ContainsFunc(lines, func(l string) bool {
				name, _, _ := strings.Cut(l, ": ")
				_, failing := watch.Failing[name]
				_, pending := watch.Pending[name]
				return failing || pending
			})
		case e.Topic == "duplicati-alerts" && e.Title == BackupFailedTitle:
			if runs == nil {
				runs = running()
			}
			return !slices.ContainsFunc(lines, func(l string) bool {
				id, ok := skipped(l)
				return !ok || !runs(id)
			})
		}
		return false
	}
	return slices.DeleteFunc(events, cleared)
}

// runningApps asks the runtime which apps run in the homelab now; none
// when it cannot tell, so no alert is taken for cleared.
func runningApps(ctx context.Context, root string) func(id string) bool {
	c, err := Catalog(root)
	if err != nil {
		return func(string) bool { return false }
	}
	_, containers, err := Containers(ctx)
	if err != nil {
		return func(string) bool { return false }
	}
	report := detect.Analyze(c, containers)
	return func(id string) bool {
		st, _ := report.State(id)
		return st == detect.Running
	}
}
