package main

import "github.com/Snooper42/homelab-wizard/internal/statusfolds"

// StatusFolds is each group on Status the household opened or folded, by
// name, as the computer keeps it for every device (internal/statusfolds).
func (a *App) StatusFolds() map[string]bool { return statusfolds.Load(a.root) }

// SetStatusFolds keeps the groups opened or folded, whole: what the phone
// and the phone's page then show too.
func (a *App) SetStatusFolds(open map[string]bool) error { return statusfolds.Save(a.root, open) }
