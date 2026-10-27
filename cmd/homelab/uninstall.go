package main

import (
	"context"
	"errors"
	"io"
	iofs "io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"

	"github.com/Snooper42/homelab-wizard/internal/host"
	"github.com/Snooper42/homelab-wizard/internal/notify"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
	"github.com/Snooper42/homelab-wizard/internal/schedule"
)

// trayAutostartID is how the desktop app's menu bar item starts at login
// (app/autostart.go): a LaunchAgent, an autostart entry, or a Run value.
const trayAutostartID = "io.github.snooper42.HomelabWizard.tray"

// uninstall takes the homelab off this machine: every container and its
// images, the scheduled jobs, the menu bar item at login, and the shared
// network. The homelab folder, its data, and the backups stay unless
// --data, which also removes the apps' data folders and volumes (never
// the backups or the media drive).
func (h *homelab) uninstall(ctx context.Context, args []string) error {
	fs := newFlags("uninstall")
	apply := applyFlag(fs)
	data := fs.Bool("data", false, "")
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	u := h.ui
	dataDirs := []string{"data", "appdata", "recovery-staging"}
	u.Title("Uninstall the homelab")
	u.Info("stop and remove every app's containers, and the images they use")
	u.Info("remove the scheduled jobs (%s)", h.host.Scheduler)
	tray := trayName()
	u.Info("stop %s starting at login", tray)
	u.Info("remove the homelab network")
	if *data {
		u.Warn("DELETE the apps' data: their volumes, and %s in %s", joinQuoted(dataDirs), h.root)
		u.Info("keep the backups (BACKUP_DESTINATION) and the media drive")
	} else {
		u.Info("keep the homelab folder, .env, every app's data, and the backups (homelab uninstall --data deletes the data)")
	}
	if err := h.goAhead(*apply, "\nUninstall?"); err != nil {
		return err
	}

	client, cerr := h.docker(ctx)
	if cerr != nil {
		u.Warn("the container runtime is not running, so containers stay: %v", cerr)
	} else {
		for _, f := range h.catalog.Files {
			profiles := []string{"optional"}
			down := []string{"down", "--remove-orphans", "--rmi", "all"}
			if *data {
				down = append(down, "--volumes")
			}
			if err := client.Compose(ctx, h.project(f), profiles, down...); err != nil {
				u.Warn("%s: %v", f.Name, err)
				continue
			}
			u.OK("removed %s", f.Name)
		}
		if _, err := client.Runner.Output(ctx, client.Bin, "network", "rm", "homelab"); err == nil {
			u.OK("removed the homelab network")
		}
	}

	if l, err := schedule.For(h.host); err == nil {
		failed := 0
		for _, j := range schedule.Jobs() {
			if err := l.Remove(j.Label); err != nil {
				u.Warn("%s: %v", j.Label, err)
				failed++
			}
		}
		if failed == 0 {
			u.OK("removed the scheduled jobs")
		}
	}
	if err := removeTrayAutostart(); err != nil {
		u.Warn("%s at login: %v", tray, err)
	} else {
		u.OK("%s no longer starts at login", tray)
	}
	if runtime.GOOS == "windows" {
		_ = notify.UnregisterToastApp()
	}

	if *data {
		for _, d := range dataDirs {
			dir := filepath.Join(h.root, d)
			err := removeAll(dir)
			if errors.Is(err, iofs.ErrPermission) && client != nil {
				// With Docker Engine run as root on Linux, the apps' files
				// belong to root: a container empties the folder as root.
				if rerr := client.RunTo(ctx, io.Discard, "-v", dir+":/v", "alpine:3", "sh", "-c", "rm -rf /v/* /v/.[!.]* /v/..?*"); rerr == nil {
					err = removeAll(dir)
				}
			}
			if err != nil {
				return err
			}
		}
		u.OK("deleted the apps' data")
	}
	if h.findsByName() {
		u.Info("%s still finds its apps by name: homelab domain resolver --undo takes that back (it asks for the administrator's password)", h.host.Machine)
	}
	u.Printf("\n  %s\n", u.Dim("Left for you: the homelab folder ("+h.root+"), the backups, Homelab Wizard ("+removeApp(h.host)+"),"))
	u.Printf("  %s\n", u.Dim("and anything outside this machine: Cloudflare's tunnel and DNS records, the Tailscale device."))
	return nil
}

// removeTrayAutostart undoes the desktop app's Start at login.
func removeTrayAutostart() error {
	home, _ := os.UserHomeDir()
	switch runtime.GOOS {
	case "darwin":
		return removeIfThere(filepath.Join(home, "Library", "LaunchAgents", trayAutostartID+".plist"))
	case "windows":
		const run = `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
		if procattr.Hide(exec.Command("reg", "query", run, "/v", trayAutostartID)).Run() != nil {
			return nil // not there
		}
		return procattr.Hide(exec.Command("reg", "delete", run, "/v", trayAutostartID, "/f")).Run()
	default:
		dir := os.Getenv("XDG_CONFIG_HOME")
		if dir == "" {
			dir = filepath.Join(home, ".config")
		}
		return removeIfThere(filepath.Join(dir, "autostart", trayAutostartID+".desktop"))
	}
}

func removeIfThere(path string) error {
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func joinQuoted(list []string) string {
	out := ""
	for i, s := range list {
		if i > 0 {
			out += ", "
		}
		out += s + "/"
	}
	return out
}

// removeAll deletes a folder and what is in it; tests replace it.
var removeAll = os.RemoveAll

// trayName is the tray item as this system calls it.
func trayName() string {
	if runtime.GOOS == "darwin" {
		return "the menu bar item"
	}
	return "the tray icon"
}

// removeApp is how the desktop app itself is removed on each system: on
// Linux its package (apt, dnf, or pacman), or the AppImage SteamOS runs.
func removeApp(p host.Profile) string {
	switch {
	case p.OS == "darwin":
		return "drag it to the Trash"
	case p.OS == "windows":
		return "Settings › Apps › Installed apps"
	case p.SteamOS:
		return "delete its AppImage"
	}
	return "remove the homelab-wizard package, or delete its AppImage"
}
