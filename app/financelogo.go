package main

import (
	"context"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/sitelogo"
)

// AppLogo is a company's own logo found on its website: the image as a
// data URL in its own type (the screen makes it a small PNG to keep), and
// the address it came from.
type AppLogo struct {
	Image string `json:"image"`
	From  string `json:"from"`
}

// FinancesFetchLogo finds the real logo on a company's website (Get the
// real logo, in a logo's picker or Finances' Logos), only when asked:
// that one request goes to that website from this computer, and what it
// finds is kept only in the household's plan (internal/sitelogo).
func (a *App) FinancesFetchLogo(site string) (AppLogo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()
	l, err := sitelogo.Fetch(ctx, site)
	return AppLogo(l), err
}
