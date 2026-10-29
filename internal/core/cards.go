package core

import (
	"context"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/board"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/savings"
	"github.com/Snooper42/homelab-wizard/internal/storage"
)

// cardTimeout is how long a card may take before it says so; the others
// come meanwhile.
const cardTimeout = 20 * time.Second

// Cards are the cards beside Status that read the homelab at root, for
// board.Read: what the window and the phone both show.
func Cards(root string) board.Readers {
	timed := func(fn func(ctx context.Context) (any, error)) board.Reader {
		return func(ctx context.Context) (any, error) {
			ctx, cancel := context.WithTimeout(ctx, cardTimeout)
			defer cancel()
			return fn(ctx)
		}
	}
	return board.Readers{
		// The watchdog's last run, and each app's share of passing checks
		// this week.
		"watchdog": func(context.Context) (any, error) {
			return health.LoadState(health.StatePath(root)).Summary(), nil
		},
		// The yearly saving the nightly backup recorded each day.
		"savings": func(context.Context) (any, error) {
			return savings.LoadHistory(savings.HistoryPath(root)), nil
		},
		// A crash Status should mention; nil when there is none.
		"crash": func(context.Context) (any, error) { return LastCrash(root), nil },
		// What each person's photos take, as the nightly backup read it.
		"storage": func(context.Context) (any, error) {
			return storage.Load(storage.Path(root)), nil
		},
		"protection": timed(func(ctx context.Context) (any, error) { return Protection(ctx, root) }),
		"alerts":     timed(func(ctx context.Context) (any, error) { return RecentAlerts(ctx, root) }),
		"usage":      timed(func(ctx context.Context) (any, error) { return Usage(ctx) }),
	}
}
