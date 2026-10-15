package main

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

const signupsKey = "VAULTWARDEN_SIGNUPS_ALLOWED"

// signups opens Vaultwarden sign-ups for a while, then closes them: on
// time, on Ctrl-C, or as soon as homelab signups close runs elsewhere.
func (h *homelab) signups(ctx context.Context, args []string) error {
	fs := newFlags("signups")
	apply := applyFlag(fs)
	dur := fs.Duration("for", 10*time.Minute, "")
	rest, err := parseFlags(fs, args)
	if err != nil {
		return err
	}
	action := "status"
	if len(rest) > 0 {
		action = rest[0]
	}
	u := h.ui
	switch action {
	case "status":
		if signupsOpen(h.envMap()) {
			u.Printf("Vaultwarden sign-ups are open (homelab signups close).\n")
		} else {
			u.Printf("Vaultwarden sign-ups are closed.\n")
		}
		return nil
	case "close":
		if err := h.setSignups(ctx, false); err != nil {
			return err
		}
		u.OK("sign-ups closed")
		return nil
	case "open":
		if err := h.goAhead(*apply, fmt.Sprintf("Open Vaultwarden sign-ups for %s?", *dur)); err != nil {
			return err
		}
		// The close is armed first: if opening fails halfway or is
		// interrupted, sign-ups must not stay open.
		closedElsewhere := false
		defer func() {
			if !closedElsewhere {
				// The command's context may be cancelled (Ctrl-C), so close with a fresh one.
				cctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
				defer cancel()
				if err := h.setSignups(cctx, false); err != nil {
					u.Fail("closing sign-ups: %v (run homelab signups close)", err)
					return
				}
			}
			u.OK("sign-ups closed")
		}()
		if err := h.setSignups(ctx, true); err != nil {
			return err
		}
		deadline := time.Now().Add(*dur)
		env := h.envMap()
		u.OK("sign-ups open until %s: create the accounts at https://passwords.%s (on this Mac, http://localhost:%s works too)", deadline.Format("15:04"), env["HOMELAB_DOMAIN"], env["VAULTWARDEN_PORT"])
		tick := time.NewTicker(5 * time.Second)
		defer tick.Stop()
		lastMinute := int(dur.Minutes())
		for {
			select {
			case <-ctx.Done():
				return nil
			case <-tick.C:
			}
			if !signupsOpen(h.envMap()) {
				closedElsewhere = true
				return nil
			}
			left := time.Until(deadline)
			if left <= 0 {
				return nil
			}
			if m := int(left.Minutes()) + 1; m < lastMinute {
				lastMinute = m
				u.Info("%d minute(s) left", m)
			}
		}
	}
	return fmt.Errorf("unknown signups command %q (status, open, close)", action)
}

func signupsOpen(env map[string]string) bool {
	v, _ := strconv.ParseBool(env[signupsKey])
	return v
}

// setSignups records the setting in .env and recreates Vaultwarden with it.
func (h *homelab) setSignups(ctx context.Context, open bool) error {
	f, err := envfile.Load(h.envFile)
	if err != nil {
		return err
	}
	f.Set(signupsKey, strconv.FormatBool(open))
	if err := f.Save(); err != nil {
		return err
	}
	a, ok := h.catalog.Get("vaultwarden")
	if !ok {
		return fmt.Errorf("the catalog has no vaultwarden app")
	}
	client, err := h.docker(ctx)
	if err != nil {
		return err
	}
	return client.Compose(ctx, h.project(a.File), a.Profiles, "up", "--detach", a.ID)
}
