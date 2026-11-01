package main

import (
	"context"
	"errors"
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
// network. The homelab folder, its data, and the backups stay unless asked:
//
//	--data             the apps' data folders and volumes (and signs this
//	                   machine's homelab out of the tailnet, whose state goes)
//	--folder           the whole homelab folder, .env included (implies --data)
//	--backups          the backup folders, never one in a cloud drive
//	--app              Homelab Wizard itself, its settings, and its caches
//	--everything-else  every other container, image, volume, and network in
//	                   the container runtime, the homelab's or not
//
// The media drive is never touched.
func (h *homelab) uninstall(ctx context.Context, args []string) error {
	fs := newFlags("uninstall")
	apply := applyFlag(fs)
	data := fs.Bool("data", false, "")
	folder := fs.Bool("folder", false, "")
	backups := fs.Bool("backups", false, "")
	app := fs.Bool("app", false, "")
	everythingElse := fs.Bool("everything-else", false, "")
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	if *folder {
		*data = true
	}
	u := h.ui
	env := h.envMap()
	dataDirs := []string{"data", "appdata", "recovery-staging"}
	if *folder {
		if err := homelabFolderSafe(h.root); err != nil {
			return err
		}
	}
	backupDirs, cloudDirs, heldDirs := h.backupFolders(env)
	var folderKeeps []string
	if *folder {
		folderKeeps = h.folderKeeps(env, backupDirs, cloudDirs, heldDirs, *backups)
	}
	installed := installedApp()

	u.Title("Uninstall the homelab")
	u.Info("stop and remove every app's containers, and the images they use")
	u.Info("remove the images the homelab made itself: the copies kept to undo an update (homelab-rollback/…) and the backup's helper (%s)", backup.SQLiteImage)
	u.Info("remove the scheduled jobs (%s)", h.host.Scheduler)
	tray := trayName()
	u.Info("stop %s starting at login", tray)
	u.Info("remove the homelab network")
	switch {
	case *folder:
		u.Warn("DELETE the homelab folder %s, with .env: its passwords, and the passphrase that opens the backups (keep the recovery kit if you may restore them)", h.root)
		for _, k := range folderKeeps {
			u.Info("keep %s, inside it: only the rest of the folder goes", k)
		}
		u.Warn("DELETE the apps' data: their volumes too")
	case *data:
		u.Warn("DELETE the apps' data: their volumes, and %s in %s", joinQuoted(dataDirs), h.root)
	default:
		u.Info("keep the homelab folder, .env, and every app's data (--data deletes the data, --folder the folder too)")
	}
	if *data {
		u.Info("sign this machine's homelab out of the tailnet, so it leaves the Tailscale admin console")
	}
	if *backups {
		for _, d := range backupDirs {
			u.Warn("DELETE the backups in %s", d)
		}
		if len(backupDirs) == 0 {
			u.Info("no backup folder on this machine to delete")
		}
	} else {
		u.Info("keep the backups (--backups deletes the ones on this machine)")
	}
	for d, drive := range cloudDirs {
		u.Info("keep %s: it is in %s, so deleting it here would delete it on every machine signed in to it", d, drive)
	}
	for d, why := range heldDirs {
		u.Info("keep %s: %s", d, why)
	}
	if *app {
		u.Warn("remove Homelab Wizard: %s, its settings, and its caches", appDescription(installed, h.host))
	}
	if *everythingElse {
		u.Warn("DELETE EVERYTHING ELSE in %s: every other container, image, volume (with its data), and network, the homelab's or not, and the build cache", h.host.Runtime)
	}
	u.Info("keep the media drive")
	if err := h.goAhead(*apply, "\nUninstall?"); err != nil {
		return err
	}
	// The dangerous ones are typed out in a terminal; the app asks for its
	// own confirmation, and a script passes --apply.
	if !*apply && h.ui.Interactive {
		if *everythingElse && !typed(u, "delete everything", "Type delete everything to remove every other container, image, and volume in "+h.host.Runtime+" too") {
			return errCancelled
		}
		if (*folder || (*backups && len(backupDirs) > 0)) && !typed(u, "delete", "Type delete to delete the folders listed above") {
			return errCancelled
		}
	}

	client, cerr := h.docker(ctx)
	if cerr != nil {
		u.Warn("the container runtime is not running, so containers stay: %v", cerr)
	} else {
		if *data {
			h.leaveTailnet(ctx, client)
		}
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
		if *everythingElse {
			h.removeEverythingElse(ctx, client)
		} else if len(others) > 0 {
			u.Info("not the homelab's, so left as they are: %s", strings.Join(others, ", "))
			u.Printf("  %s\n", u.Dim("They share "+h.host.Runtime+" with it. If you do not need them, remove them there, with docker compose -p <name> down --rmi all, or with homelab uninstall --everything-else."))
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

	failed := false
	if *data && !*folder {
		for _, d := range dataDirs {
			if err := h.removeTree(ctx, client, filepath.Join(h.root, d)); err != nil {
				return err
			}
		}
		u.OK("deleted the apps' data")
	}
	if *backups {
		for _, d := range backupDirs {
			others, err := h.removeBackups(ctx, client, d)
			if err != nil {
				u.Warn("%s: %v", d, err)
				failed = true
				continue
			}
			u.OK("deleted the backups in %s", d)
			if len(others) > 0 {
				u.Info("kept the folder %s: it also holds %s, which the homelab's backups did not write", d, strings.Join(others, ", "))
			}
		}
	}
	if *folder {
		home, _ := os.UserHomeDir()
		_ = os.Chdir(home) // a folder Windows is standing in cannot go
		if kept, err := h.removeKeeping(ctx, client, h.root, folderKeeps); err != nil {
			u.Warn("the homelab folder %s: %v", h.root, err)
			failed = true
		} else if len(kept) > 0 {
			u.OK("deleted the homelab folder %s but %s", h.root, strings.Join(kept, ", "))
		} else {
			u.OK("deleted the homelab folder %s", h.root)
		}
	}
	if *app {
		if !h.removeHomelabWizard(installed) {
			failed = true
		}
	}

	if h.findsByName() {
		u.Info("%s still finds its apps by name: homelab domain resolver --undo takes that back (it asks for the administrator's password)", h.host.Machine)
	}
	var left []string
	if !*folder {
		left = append(left, "the homelab folder ("+h.root+")")
	}
	if !*backups && len(backupDirs) > 0 {
		left = append(left, "the backups")
	}
	if len(cloudDirs) > 0 {
		left = append(left, "the backups in the cloud drive (delete them there once no machine uses them)")
	}
	if !*app {
		left = append(left, "Homelab Wizard ("+removeApp(h.host)+", or homelab uninstall --app)")
	}
	left = append(left, h.host.Runtime+" itself ("+removeRuntime(h.host)+")")
	u.Printf("\n  %s\n", u.Dim("Left for you: "+strings.Join(left, ", ")+","))
	u.Printf("  %s\n", u.Dim("and anything outside this machine: Cloudflare's tunnel and DNS records, the apps your phones point at this machine."))
	if failed {
		return errors.New("some of it could not be removed: the lines above say which")
	}
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
