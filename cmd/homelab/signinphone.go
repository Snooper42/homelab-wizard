package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"slices"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/kept"
	"github.com/Snooper42/homelab-wizard/internal/wiring"
)

// Sign-in details on the phone (arr-loop.md item 1c; the owner, Nov 19,
// 2026: yes, behind Face ID). The phone lists each app's passwords and keys
// by label, never by value, and copies one at a time into the password
// manager. Only what the computer's ⚙ sheet shows is offered (core.Secrets:
// the catalog's login, keys and recovery, and a key an app keeps itself);
// internal secrets such as database passwords are never sent.

// phoneSignIn is one row of an app's Sign-in details, as a phone sees it.
type phoneSignIn struct {
	App   string `json:"app"`
	Key   string `json:"key"`
	Label string `json:"label"`
	// Section: "sign-in", "paste" (into another app) or "keep-safe" (opens the backups).
	Section string `json:"section"`
	Saved   bool   `json:"saved"`
}

// signInRows are the Sign-in details of the installed apps (or only app,
// when it isn't ""), with no value in them.
func (h *homelab) signInRows(ctx context.Context, app string) ([]phoneSignIn, error) {
	st, err := core.Status(ctx, h.root)
	if err != nil {
		return nil, err
	}
	saved := kept.Load(h.root)
	out := []phoneSignIn{}
	for _, s := range core.Secrets(h.root, h.catalog, &st) {
		if app != "" && s.App != app {
			continue
		}
		out = append(out, phoneSignIn{App: s.App, Key: s.Key, Label: s.Label, Section: h.signInSection(s), Saved: saved[s.Key]})
	}
	return out, nil
}

func (h *homelab) signInSection(s kept.Secret) string {
	if s.Recovery {
		return "keep-safe"
	}
	if a, ok := h.catalog.Get(s.App); ok && slices.Contains(a.Meta.Login, s.Key) {
		return "sign-in"
	}
	return "paste"
}

// copySignIn is one value from an app's Sign-in details, for the phone to
// put on its clipboard; only a row signInRows lists, and every copy is kept
// in the app's history with the phone's name (never the value).
func (h *homelab) copySignIn(ctx context.Context, app, key string) (string, error) {
	rows, err := h.signInRows(ctx, app)
	if err != nil {
		return "", err
	}
	var row *phoneSignIn
	for i := range rows {
		if rows[i].Key == key {
			row = &rows[i]
		}
	}
	if app == "" || row == nil {
		return "", fmt.Errorf("%q isn't in %s's Sign-in details", key, h.appName(app))
	}
	var v string
	if strings.HasPrefix(key, "app:") {
		a, _ := h.catalog.Get(app)
		home, _ := os.UserHomeDir()
		dir := wiring.AppsFrom(h.catalog, func(x string) bool { return x == app }, core.Env(h.root), home)[app].ConfigDir
		if v, err = wiring.KeptKey(dir, a.Meta.KeyFile); err != nil {
			return "", fmt.Errorf("%s: %w", a.Name(), err)
		}
	} else {
		v = strings.TrimSpace(core.Env(h.root)[key])
	}
	if v == "" {
		return "", errors.New(row.Label + " isn't set")
	}
	what := strings.TrimPrefix(strings.TrimPrefix(row.Label, h.appName(app)+": "), "its ")
	h.record("copy", app, whoAsked(ctx), fmt.Sprintf("%s's %s copied on %s", h.appName(app), what, whoAsked(ctx)))
	return v, nil
}

// markSignIn ticks (or unticks) one row as saved in the password manager.
func (h *homelab) markSignIn(ctx context.Context, app, key string, saved bool) error {
	rows, err := h.signInRows(ctx, app)
	if err != nil {
		return err
	}
	if app == "" || !slices.ContainsFunc(rows, func(r phoneSignIn) bool { return r.Key == key }) {
		return fmt.Errorf("%q isn't in %s's Sign-in details", key, h.appName(app))
	}
	return kept.Mark(h.root, key, saved)
}

// signInArgs reads (app, key) from a phone's call.
func signInArgs(args []json.RawMessage, n int) ([]string, error) {
	out := make([]string, n)
	if len(args) < n {
		return nil, fmt.Errorf("takes %d arguments", n)
	}
	for i := range out {
		if json.Unmarshal(args[i], &out[i]) != nil || len(out[i]) > 100 {
			return nil, errors.New("each argument is a name")
		}
	}
	return out, nil
}
