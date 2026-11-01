package main

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/core"
)

// UninstallOptions are what Settings › This machine › Take the homelab off
// this machine removes besides the containers, images, and jobs, as
// homelab uninstall's flags.
type UninstallOptions struct {
	Data           bool `json:"data"`           // the apps' data (--data)
	Folder         bool `json:"folder"`         // the homelab folder, .env included (--folder)
	Backups        bool `json:"backups"`        // the backups on this machine, never a cloud drive's (--backups)
	App            bool `json:"app"`            // Homelab Wizard itself (--app)
	EverythingElse bool `json:"everythingElse"` // every other container, image, and volume (--everything-else)
}

func (o UninstallOptions) args() []string {
	args := []string{"uninstall"}
	for _, f := range []struct {
		on   bool
		flag string
	}{{o.Data, "--data"}, {o.Folder, "--folder"}, {o.Backups, "--backups"}, {o.App, "--app"}, {o.EverythingElse, "--everything-else"}} {
		if f.on {
			args = append(args, f.flag)
		}
	}
	return args
}

// UninstallPlan is what Uninstall would do with these options, in the
// homelab's own words: the folders it names, the backups it keeps because
// a cloud drive syncs them. It changes nothing.
func (a *App) UninstallPlan(o UninstallOptions) (string, error) {
	ctx, cancel := context.WithTimeout(a.ctx, 30*time.Second)
	defer cancel()
	out, err := core.CLIContext(ctx, a.root, o.args()...).CombinedOutput()
	plan := strings.TrimSpace(strings.Replace(string(out), "Preview only: nothing was changed. Run again with --apply to go ahead.", "", 1))
	if err != nil && plan == "" {
		return "", err
	}
	return plan, nil
}

// Uninstall takes the homelab off this machine (homelab uninstall --apply
// with the options), its lines on "cli:log". Settings asks first, with the
// plan and the words typed out. With App, the app quits once it is done,
// so its uninstaller (Windows) or the Trash (a Mac) can take it.
func (a *App) Uninstall(o UninstallOptions) error {
	if !a.install.TryLock() {
		return errors.New("another install or setup step is running")
	}
	defer a.install.Unlock()
	args := append(o.args(), "--apply")
	emitEvent(a.ctx, "cli:log", "$ homelab "+strings.Join(args, " "))
	err := a.stream(core.CLI(a.root, args...), "cli:log")
	if o.App && err == nil {
		a.uninstalled.Store(true)
		go func() {
			time.Sleep(2 * time.Second) // the last lines shown
			quitApp(a.ctx)
		}()
	}
	return err
}
