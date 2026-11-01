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
	"sort"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/docker"
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
	u.Info("remove the images the homelab made itself: the copies kept to undo an update (homelab-rollback/…) and the backup's helper (%s)", backup.SQLiteImage)
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
		others := h.removeLeftovers(ctx, client, *data)
		if _, err := client.Runner.Output(ctx, client.Bin, "network", "rm", "homelab"); err == nil {
			u.OK("removed the homelab network")
		}
		if len(others) > 0 {
			u.Info("not the homelab's, so left as they are: %s", strings.Join(others, ", "))
			u.Printf("  %s\n", u.Dim("They share the container runtime with it. If you do not need them, remove them in Docker Desktop or OrbStack, or with docker compose -p <name> down --rmi all."))
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

// removeLeftovers removes what compose down does not reach: containers of a
// homelab_ project no compose file lists any more (an app taken out of the
// catalog), with --data their volumes, and the images the homelab made
// outside compose. It returns the containers that are not the homelab's,
// by compose project (or name), so uninstall can say they are left.
func (h *homelab) removeLeftovers(ctx context.Context, client *docker.Client, data bool) (others []string) {
	u := h.ui
	ctrs, _ := client.Containers(ctx)
	seen := map[string]bool{}
	removed := 0
	for _, c := range ctrs {
		if isHomelabProject(c.Project()) {
			if err := client.RemoveContainer(ctx, c.ID); err != nil {
				u.Warn("%s: %v", c.Name, err)
				continue
			}
			removed++
			continue
		}
		name := c.Project()
		if name == "" {
			name = strings.TrimPrefix(c.Name, "/")
		}
		if name != "" && !seen[name] {
			seen[name] = true
			others = append(others, name)
		}
	}
	if removed > 0 {
		u.OK("removed %d leftover container(s) of the homelab", removed)
	}
	if data {
		out, _ := client.Runner.Output(ctx, client.Bin, "volume", "ls", "--format", `{{.Name}} {{.Label "com.docker.compose.project"}}`)
		n := 0
		for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
			name, project, _ := strings.Cut(line, " ")
			if name == "" || !isHomelabProject(project) {
				continue
			}
			if _, err := client.Runner.Output(ctx, client.Bin, "volume", "rm", name); err != nil {
				u.Warn("volume %s: %v", name, err)
				continue
			}
			n++
		}
		if n > 0 {
			u.OK("removed %d leftover volume(s) of the homelab", n)
		}
	}
	out, _ := client.Runner.Output(ctx, client.Bin, "image", "ls", "--format", "{{.Repository}}:{{.Tag}}")
	n := 0
	for _, ref := range strings.Fields(string(out)) {
		if !homelabImage(ref) {
			continue
		}
		if err := client.RemoveImage(ctx, ref); err != nil {
			u.Warn("image %s: %v", ref, err)
			continue
		}
		n++
	}
	if n > 0 {
		u.OK("removed %d image(s) the homelab made itself", n)
	}
	sort.Strings(others)
	return others
}

// isHomelabProject is a compose project the homelab started: every one of
// its compose files is named homelab_<something>.
func isHomelabProject(project string) bool { return strings.HasPrefix(project, "homelab_") }

// homelabImage is an image the homelab made outside any compose file: the
// copy an update keeps for its undo (updates.RollbackRef), and the backup's
// SQLite helper.
func homelabImage(ref string) bool {
	return strings.HasPrefix(ref, "homelab-rollback/") || ref == backup.SQLiteImage
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
