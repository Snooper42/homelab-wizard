package main

import (
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/started"
)

// noteStarted keeps why the homelab just started ids (data/started.json),
// for Status's "up 9 minutes" on hover. It never fails what it follows.
func (h *homelab) noteStarted(why string, ids ...string) {
	if err := started.Note(h.root, why, time.Now(), ids...); err != nil {
		h.ui.Warn("could not keep why %s started: %v", strings.Join(ids, ", "), err)
	}
}

// The reasons, for code where a local "started" hides the package.
const (
	whyBattery = started.Battery
	whyDrive   = started.Drive
	whyTimer   = started.Timer
)
