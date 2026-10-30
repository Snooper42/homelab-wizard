package core

import (
	"context"
	"sync"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/board"
	"github.com/Snooper42/homelab-wizard/internal/engine"
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

// ReadCards reads the cards in want and gives each to fn, one at a time, as
// soon as it is read: from the agent when one serves the homelab at root,
// so the window, the menu bar item, and the phone share one reading of
// each, and here with local for any the agent does not read, or for all of
// them when no agent answers or it stops partway.
func ReadCards(ctx context.Context, root string, n int, want []string, local board.Readers, fn func(board.Card)) {
	var mu sync.Mutex
	emit := func(c board.Card) {
		mu.Lock()
		defer mu.Unlock()
		fn(c)
	}
	missing := want
	if c, err := engine.Dial(ctx, root); err == nil {
		got := map[string]bool{}
		_ = c.Cards(ctx, n, want, func(card board.Card) {
			if card.Error == board.NotHere {
				return
			}
			got[card.Name] = true
			emit(card)
		})
		missing = nil
		for _, name := range want {
			if !got[name] {
				missing = append(missing, name)
			}
		}
	}
	if len(missing) > 0 {
		board.Read(ctx, local, n, missing, emit)
	}
}
