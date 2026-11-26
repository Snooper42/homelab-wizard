package main

import (
	"context"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/core"
	appusage "github.com/Snooper42/homelab-wizard/internal/usage"
)

// usageDue says whether the agent takes its next sample of what the apps use (every appusage.Every), counted on the
// wall clock as watchDue is, so a night asleep doesn't hold the next one back.
func usageDue(now, last time.Time) bool {
	return last.IsZero() || now.Round(0).Sub(last.Round(0)) >= appusage.Every
}

// sampleUsage keeps one sample of the apps' processor and memory, in all and each app's own, for Analytics' Day,
// Week and Month (lane D, D2). Nothing is kept while the runtime doesn't answer: a gap in the chart.
func (h *homelab) sampleUsage(ctx context.Context, now time.Time) error {
	ctx, cancel := context.WithTimeout(ctx, time.Minute)
	defer cancel()
	stats, err := core.Usage(ctx)
	if err != nil {
		return err
	}
	return appusage.Record(appusage.Path(h.root), now, appusage.FromStats(stats))
}

// nightlyJob notes that a nightly job started, so Analytics dots it on the chart.
func (h *homelab) nightlyJob(name string, at time.Time) {
	if err := appusage.RecordJob(appusage.Path(h.root), name, at); err != nil {
		h.ui.Warn("agent: noting the %s for Analytics: %v", name, err)
	}
}
