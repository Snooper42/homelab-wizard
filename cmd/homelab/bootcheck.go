package main

import (
	"context"
	"os/exec"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/bootcheck"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
)

// macCommand runs one of macOS's own commands for bootcheck, briefly.
func macCommand(ctx context.Context, name string, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	return procattr.Hide(exec.CommandContext(ctx, name, args...)).CombinedOutput()
}

// afterRestart is doctor's "After a restart" on a Mac: whether the homelab
// comes back by itself after a restart or a power cut, and if not, what to
// do (ISSUE-0007). A Mac that waits for someone is told how it hears of
// that: the heartbeat (HEARTBEAT_URL) stops, and the outside monitor alerts.
func (h *homelab) afterRestart(ctx context.Context, run bootcheck.Runner) {
	u := h.ui
	u.Title("After a restart")
	rep := bootcheck.Assess(bootcheck.Read(ctx, run))
	for _, l := range rep.Lines {
		if l.OK {
			u.OK("%s", l.Text)
		} else {
			u.Warn("%s", l.Text)
		}
	}
	if rep.Unattended {
		return
	}
	if h.envMap()["HEARTBEAT_URL"] != "" {
		u.OK("while it waits, the heartbeat stops and your outside monitor (HEARTBEAT_URL) alerts you")
	} else {
		u.Info("to hear when it is waiting for someone, set HEARTBEAT_URL (healthchecks.io; docs/Monitoring.md): its alert comes when the pings stop")
	}
}
