package main

import (
	"context"
	"fmt"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

// pin puts an app at the top of Status and of the menu bar's Open an app
// (data/pinned.json, in the order pinned); unpin puts it back in its
// group. Nothing about the app itself changes.
func (h *homelab) pin(on bool) func(context.Context, []string) error {
	verb := map[bool]string{true: "pin", false: "unpin"}[on]
	return func(_ context.Context, args []string) error {
		if len(args) != 1 {
			return fmt.Errorf("usage: homelab %s <app>", verb)
		}
		a, ok := h.catalog.Get(args[0])
		if !ok {
			return fmt.Errorf("unknown app %q", args[0])
		}
		// A list still in .env from before goes into the record first.
		f, err := envfile.Load(h.envFile)
		if err != nil {
			return err
		}
		if moved, err := api.CarryPinned(h.root, f); err != nil {
			return err
		} else if moved {
			if err := f.Save(); err != nil {
				return err
			}
		}
		if err := api.SetPinned(h.root, a.ID, on); err != nil {
			return err
		}
		if on {
			h.ui.OK("%s is pinned to the top of Status (homelab unpin %s)", a.Name(), a.ID)
		} else {
			h.ui.OK("%s is back in its group on Status", a.Name())
		}
		return nil
	}
}
