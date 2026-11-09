package main

import (
	"context"
	"errors"
	"os"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/history"
)

// actorEnv names who asked for a command run as its own process: a
// phone's call through the companion sets it to the phone's name.
const actorEnv = "HOMELAB_ACTOR"

// who is who's doing what this process does: the phone that asked for it,
// else this computer (its window, the menu bar, or a terminal).
func (h *homelab) who() string {
	if a := strings.TrimSpace(os.Getenv(actorEnv)); a != "" {
		return a
	}
	return history.ThisComputer
}

// whoAsked is who a phone's call came from, by the phone's name; this
// computer when it wasn't a phone's.
func whoAsked(ctx context.Context) string {
	if d, ok := companion.Caller(ctx); ok && strings.TrimSpace(d.Name) != "" {
		return d.Name
	}
	return history.ThisComputer
}

// record keeps a line in the record of what was done (internal/history),
// best effort.
func (h *homelab) record(kind, app, who, text string) {
	history.Record(h.root, history.Entry{Kind: kind, App: app, Who: who, Text: text})
}

// appName is an app's name, or its id when the catalog doesn't know it.
func (h *homelab) appName(id string) string {
	if a, ok := h.catalog.Get(id); ok {
		return a.Name()
	}
	return id
}

// lifecycleWords are how each action reads in the record.
var lifecycleWords = map[string]string{
	"start": "Started %s", "stop": "Stopped %s", "restart": "Restarted %s",
	"update": "Updated %s", "remove": "Removed %s (its data is kept)",
}

// recordLifecycle keeps what lifecycle did to each app.
func (h *homelab) recordLifecycle(action string, nightly bool, ids []string) {
	words, ok := lifecycleWords[action]
	if !ok {
		return
	}
	who := h.who()
	if nightly {
		who = history.Nightly
	}
	for _, id := range ids {
		h.record(action, id, who, strings.Replace(words, "%s", h.appName(id), 1))
	}
}

// recordFinances keeps a Finances change, in words only (never an amount),
// and only for the household's own Finances: a member's are theirs.
func (h *homelab) recordFinances(froot, who, text string) {
	if froot == h.root {
		h.record("finances", "", who, text)
	}
}

// history is homelab history: what was done, newest first.
func (h *homelab) history(_ context.Context, args []string) error {
	fs := newFlags("history")
	var app, search string
	var limit int
	fs.StringVar(&app, "app", "", "")
	fs.StringVar(&search, "search", "", "")
	fs.IntVar(&limit, "limit", 50, "")
	rest, err := parseFlags(fs, args)
	if err != nil {
		return err
	}
	if len(rest) > 0 {
		return errors.New("homelab history [--app <id>] [--search <words>] [--limit <n>]")
	}
	entries, err := history.List(h.root, history.Filter{App: app, Search: search, Limit: limit})
	if err != nil {
		return err
	}
	u := h.ui
	if u.JSON {
		emit(u, "history", entries)
		return nil
	}
	if len(entries) == 0 {
		u.Println("Nothing done yet that's kept here (starts, stops, updates, the watchdog's restarts, settings, Finances).")
		return nil
	}
	for _, e := range entries {
		u.Printf("%s  %s  (%s)\n", e.At.Local().Format("Mon 2 Jan 15:04"), e.Text, e.Who)
	}
	return nil
}
