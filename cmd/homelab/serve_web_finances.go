package main

// The web page's parity with the computer, part 4: Finances. Update balances
// from Firefly III and Ghostfolio, Recurring from Wallos, a company's real
// logo, and the calendar feed's link, for a device that may change
// Finances (or see them, for the link). Export and Print are the browser's
// own on the web page (companion.js): a download, and a page that prints.

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/finance"
	"github.com/Snooper42/homelab-wizard/internal/financeapps"
	"github.com/Snooper42/homelab-wizard/internal/sitelogo"
)

// webFinanceMethods are part 4's methods.
func (h *homelab) webFinanceMethods() map[string]companion.Method {
	root := h.root
	edit := func(fn func(ctx context.Context, args []json.RawMessage) (any, error)) companion.Method {
		return companion.Method{Finances: companion.FinancesEdit, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			v, err := fn(ctx, args)
			return v, nil, err
		}}
	}
	return map[string]companion.Method{
		"FinancesFromFirefly": edit(func(ctx context.Context, _ []json.RawMessage) (any, error) {
			env := core.Env(root)
			return financeapps.Firefly(ctx, financeapps.FireflyBase(env), env)
		}),
		"FinancesFromWallos": edit(func(ctx context.Context, _ []json.RawMessage) (any, error) {
			env := core.Env(root)
			return financeapps.Wallos(ctx, financeapps.WallosBase(env), env)
		}),
		"FinancesFromGhostfolio": edit(func(ctx context.Context, _ []json.RawMessage) (any, error) {
			return financeapps.Ghostfolio(ctx, core.Env(root))
		}),
		// Get the real logo: one request to that company's website, from the computer, only when asked.
		"FinancesFetchLogo": edit(func(ctx context.Context, args []json.RawMessage) (any, error) {
			a, err := strArgs(args, 1)
			if err != nil {
				return nil, errors.New("FinancesFetchLogo takes a website")
			}
			ctx, cancel := context.WithTimeout(ctx, 25*time.Second)
			defer cancel()
			return sitelogo.Fetch(ctx, a[0])
		}),
		// The calendar feed's link, for this device's calendar to subscribe to: the https address only.
		"FinancesCalendar": {Finances: companion.FinancesView, Call: func(context.Context, []json.RawMessage) (any, []string, error) {
			p, err := finance.Load(finance.Path(root))
			if err != nil || p.CalendarKey == "" {
				return "", nil, err
			}
			base := companion.SecureBase(core.Env(root))
			if base == "" {
				return nil, nil, errors.New("the calendar needs Tailscale or the homelab's own domain: it is never sent over the home Wi-Fi")
			}
			return base + "/finances.ics?key=" + p.CalendarKey, nil, nil
		}},
	}
}
