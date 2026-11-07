// Package proc says whether a process that wrote a lock or a ticket is
// still the one running: Tidy Up's media lock and the homelab's queue for
// changes (internal/turn) both keep a process ID.
package proc

import "time"

// Process is how this machine answers; tests give their own.
type Process struct {
	// Alive reports whether pid runs.
	Alive func(pid int) bool
	// Started is when pid started; false when this system can't say.
	Started func(pid int) (time.Time, bool)
}

// System is this machine's processes.
var System = Process{Alive: processAlive, Started: processStart}

// Alive reports whether pid runs on this machine.
func Alive(pid int) bool { return processAlive(pid) }

// Started is when pid started on this machine; false when it can't say.
func Started(pid int) (time.Time, bool) { return processStart(pid) }

// ReuseSlack is how much later than since a process may seem to have
// started (ps says it to the second) and still be the one that wrote it.
const ReuseSlack = 5 * time.Second

// Holds reports whether pid still runs as the process that wrote something
// at since. One that started after that is another program given the same
// ID later (after the computer restarted, say): the writer is gone. Where
// the start time can't be read, or since is unknown, a process that runs
// is taken for the writer.
func (p Process) Holds(pid int, since time.Time) bool {
	if pid <= 0 || !p.Alive(pid) {
		return false
	}
	if since.IsZero() || p.Started == nil {
		return true
	}
	if began, ok := p.Started(pid); ok && began.After(since.Add(ReuseSlack)) {
		return false
	}
	return true
}
