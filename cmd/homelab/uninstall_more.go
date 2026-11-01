package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	iofs "io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/host"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
	"github.com/Snooper42/homelab-wizard/internal/schedule"
	"github.com/Snooper42/homelab-wizard/internal/selfupdate"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// typed asks for a phrase to be typed out, for what cannot be undone.
func typed(u *ui.UI, phrase, prompt string) bool {
	got, err := u.Ask(prompt)
	return err == nil && strings.EqualFold(strings.TrimSpace(got), phrase)
}

// homelabFolderSafe refuses to delete a folder that does not look like a
// homelab folder, or one whose loss would take more than the homelab with
// it: the home folder, a drive, or a folder right under one.
func homelabFolderSafe(root string) error {
	abs, err := filepath.Abs(root)
	if err != nil {
		return err
	}
	home, _ := os.UserHomeDir()
	parent := filepath.Dir(abs)
	if abs == home || parent == abs || filepath.Dir(parent) == parent {
		return fmt.Errorf("%s is not a folder the homelab can delete as a whole (it is a home folder, a drive, or right under one): delete what you want of it by hand", abs)
	}
	for _, marker := range []string{"compose.yaml", ".env.example"} {
		if _, err := os.Stat(filepath.Join(abs, marker)); err != nil {
			return fmt.Errorf("%s has no %s, so it may not be a homelab folder: nothing was deleted", abs, marker)
		}
	}
	return nil
}

// backupFolders are the folders this machine's backups went to: Duplicati's
// (BACKUP_DESTINATION) and Kopia's (KOPIA_REPOSITORY). A folder in a cloud
// drive goes into cloud with the drive's name, never into dirs: deleting it
// here deletes it on every machine signed in to the drive. The media drive
// is left out of both.
func (h *homelab) backupFolders(env map[string]string) (dirs []string, cloud map[string]string) {
	cloud = map[string]string{}
	home, _ := os.UserHomeDir()
	seen := map[string]bool{}
	for _, key := range []string{"BACKUP_DESTINATION", "KOPIA_REPOSITORY"} {
		d := strings.TrimSpace(env[key])
		if d == "" {
			continue
		}
		if !filepath.IsAbs(d) && !strings.HasPrefix(d, `\\`) {
			d = filepath.Join(h.root, d)
		}
		d = filepath.Clean(d)
		if seen[d] {
			continue
		}
		seen[d] = true
		if st, err := os.Stat(d); err != nil || !st.IsDir() {
			continue
		}
		if m := env["MEDIA_ROOT"]; m != "" && (d == filepath.Clean(m) || strings.HasPrefix(filepath.Clean(m), d+string(filepath.Separator))) {
			continue // holds the media drive: never
		}
		if d == home || filepath.Dir(d) == d {
			continue
		}
		if drive := backup.InCloudDrive(h.host.OS, home, d); drive != "" {
			cloud[d] = drive
			continue
		}
		dirs = append(dirs, d)
	}
	return dirs, cloud
}

// removeTree deletes a folder. With Docker Engine run as root on Linux,
// the apps' files belong to root: a container empties the folder as root.
func (h *homelab) removeTree(ctx context.Context, client *docker.Client, dir string) error {
	err := removeAll(dir)
	if errors.Is(err, iofs.ErrPermission) && client != nil {
		if rerr := client.RunTo(ctx, io.Discard, "-v", dir+":/v", "alpine:3", "sh", "-c", "rm -rf /v/* /v/.[!.]* /v/..?*"); rerr == nil {
			err = removeAll(dir)
		}
	}
	return err
}

// leaveTailnet signs the homelab's Tailscale out, so its device leaves the
// tailnet (and its admin console) instead of staying there offline, with
// the name a new machine's homelab would then not get.
func (h *homelab) leaveTailnet(ctx context.Context, client *docker.Client) {
	ctrs, err := client.Containers(ctx)
	if err != nil {
		return
	}
	for _, c := range ctrs {
		if !isHomelabProject(c.Project()) || c.Service() != "tailscale" || !c.Running {
			continue
		}
		if _, err := client.Exec(ctx, strings.TrimPrefix(c.Name, "/"), "tailscale", "logout"); err != nil {
			h.ui.Warn("signing out of the tailnet: %v (remove this machine in Tailscale's admin console)", err)
			continue
		}
		h.ui.OK("signed this machine's homelab out of the tailnet")
	}
}

// removeEverythingElse empties the container runtime: every container,
// volume, image, and network left after the homelab's, and the build cache.
func (h *homelab) removeEverythingElse(ctx context.Context, client *docker.Client) {
	u := h.ui
	run := func(args ...string) ([]byte, error) { return client.Runner.Output(ctx, client.Bin, args...) }
	n := 0
	ctrs, _ := client.Containers(ctx)
	for _, c := range ctrs {
		if err := client.RemoveContainer(ctx, c.ID); err != nil {
			u.Warn("%s: %v", c.Name, err)
			continue
		}
		n++
	}
	u.OK("removed %d other container(s)", n)
	out, _ := run("volume", "ls", "--quiet")
	n = 0
	for _, v := range strings.Fields(string(out)) {
		if _, err := run("volume", "rm", "--force", v); err != nil {
			u.Warn("volume %s: %v", v, err)
			continue
		}
		n++
	}
	u.OK("removed %d other volume(s)", n)
	out, _ = run("image", "ls", "--all", "--quiet")
	n = 0
	seen := map[string]bool{}
	for _, id := range strings.Fields(string(out)) {
		if seen[id] {
			continue
		}
		seen[id] = true
		if _, err := run("image", "rm", "--force", id); err != nil {
			continue // a layer of an image already removed
		}
		n++
	}
	u.OK("removed %d other image(s)", n)
	out, _ = run("network", "ls", "--format", "{{.Name}}")
	n = 0
	for _, name := range strings.Fields(string(out)) {
		if name == "bridge" || name == "host" || name == "none" || name == "homelab" {
			continue
		}
		if _, err := run("network", "rm", name); err == nil {
			n++
		}
	}
	u.OK("removed %d other network(s)", n)
	if _, err := run("builder", "prune", "--all", "--force"); err == nil {
		u.OK("emptied the build cache")
	}
}

// installedApp is how Homelab Wizard is installed here: the copy this
// program came with, else the usual place on each system (a homelab run
// from git may still have the app installed).
var installedApp = func() selfupdate.Installed {
	if in := selfupdate.Current(); in.Kind != "" {
		return in
	}
	exists := func(p string) bool { _, err := os.Stat(p); return err == nil }
	switch runtime.GOOS {
	case "darwin":
		if exists(schedule.AppBundle) {
			return selfupdate.Installed{Kind: selfupdate.KindMac, Path: schedule.AppBundle}
		}
	case "windows":
		for _, dir := range []string{
			filepath.Join(os.Getenv("ProgramFiles"), "Snooper42", "Homelab Wizard"),
			filepath.Join(os.Getenv("LOCALAPPDATA"), "Programs", "Homelab Wizard"),
		} {
			if exists(filepath.Join(dir, "uninstall.exe")) {
				return selfupdate.Installed{Kind: selfupdate.KindWindows, Path: dir}
			}
		}
	case "linux":
		const program = "/usr/bin/homelab-wizard"
		switch {
		case exists("/var/lib/dpkg/info/homelab-wizard.list"):
			return selfupdate.Installed{Kind: selfupdate.KindDeb, Path: program}
		case exists(program) && exists("/usr/bin/pacman"):
			return selfupdate.Installed{Kind: selfupdate.KindArch, Path: program}
		case exists(program) && exists("/usr/bin/rpm"):
			return selfupdate.Installed{Kind: selfupdate.KindRPM, Path: program}
		}
	}
	return selfupdate.Installed{}
}

// appDescription says which copy of the app goes, for the plan.
func appDescription(in selfupdate.Installed, p host.Profile) string {
	switch in.Kind {
	case "":
		return "(no installed copy found; " + removeApp(p) + " if there is one)"
	case selfupdate.KindDeb, selfupdate.KindRPM, selfupdate.KindArch:
		return in.Path + " (the " + packageRemove(in.Kind) + " command to finish, as it needs your password)"
	}
	return in.Path
}

// packageRemove is the command that removes the app's Linux package.
func packageRemove(kind string) string {
	switch kind {
	case selfupdate.KindDeb:
		return "sudo apt remove homelab-wizard"
	case selfupdate.KindRPM:
		return "sudo dnf remove homelab-wizard"
	case selfupdate.KindArch:
		return "sudo pacman -R homelab-wizard"
	}
	return ""
}

// appFolders are the app's own folders outside the homelab folder: its
// settings and window (config), its downloaded updates and the agent's
// socket (cache), the scheduled jobs' scripts on Windows, and the app menu
// entry an AppImage added on Linux.
func appFolders(goos string) []string {
	var out []string
	if dir, err := os.UserConfigDir(); err == nil {
		out = append(out, filepath.Join(dir, "Homelab Wizard"))
	}
	if dir, err := os.UserCacheDir(); err == nil {
		out = append(out, filepath.Join(dir, "Homelab Wizard"), filepath.Join(dir, "homelab-wizard"))
	}
	switch goos {
	case "windows":
		if dir := os.Getenv("LOCALAPPDATA"); dir != "" {
			out = append(out, filepath.Join(dir, "Homelab"))
		}
	case "linux":
		data := os.Getenv("XDG_DATA_HOME")
		if data == "" {
			home, _ := os.UserHomeDir()
			data = filepath.Join(home, ".local", "share")
		}
		out = append(out,
			filepath.Join(data, "applications", "io.github.snooper42.HomelabWizard.AppImage.desktop"),
			filepath.Join(data, "icons", "hicolor", "256x256", "apps", "homelab-wizard.png"))
	}
	return out
}

// startDetached starts a program that outlives this one; tests replace it.
var startDetached = func(name string, args ...string) error {
	c := procattr.Hide(exec.Command(name, args...))
	if err := c.Start(); err != nil {
		return err
	}
	return c.Process.Release()
}

// stopFrom is PowerShell that stops every program run from a folder: the
// app, and the tray icon, which runs on its own (--tray) and holds its
// files open.
func stopFrom(dir string) string {
	return "Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith(" + psQuote(dir+`\`) + ", [StringComparison]::OrdinalIgnoreCase) } | Stop-Process -Force -ErrorAction SilentlyContinue; "
}

// psQuote is a PowerShell single-quoted string.
func psQuote(s string) string { return "'" + strings.ReplaceAll(s, "'", "''") + "'" }

// removeHomelabWizard removes the app: its own folders, then the app in
// each system's way. It reports whether all of it went (a Linux package
// is left for its command, which needs a password, and counts as done).
func (h *homelab) removeHomelabWizard(in selfupdate.Installed) bool {
	u := h.ui
	ok := true
	for _, d := range appFolders(h.host.OS) {
		if _, err := os.Lstat(d); err != nil {
			continue
		}
		if err := removeAll(d); err != nil {
			u.Warn("%s: %v", d, err)
			ok = false
			continue
		}
		u.OK("removed %s", d)
	}
	switch in.Kind {
	case selfupdate.KindMac:
		if !h.trashMacApp(in.Path) {
			return false
		}
	case selfupdate.KindWindows:
		// The installer's own uninstaller, once this program and the app
		// have quit, as an administrator (Windows asks).
		un := filepath.Join(in.Path, "uninstall.exe")
		script := "Start-Sleep -Seconds 3; " + stopFrom(in.Path) + "Start-Process -FilePath " + psQuote(un) + " -ArgumentList '/S' -Verb RunAs"
		if err := startDetached("powershell.exe", "-NoProfile", "-WindowStyle", "Hidden", "-Command", script); err != nil {
			u.Warn("starting the uninstaller: %v (Settings > Apps > Installed apps)", err)
			return false
		}
		u.OK("Homelab Wizard's uninstaller starts in a few seconds: Windows asks for your approval")
	case selfupdate.KindWindowsPortable:
		script := "Start-Sleep -Seconds 3; " + stopFrom(in.Path) + "Remove-Item -LiteralPath " + psQuote(in.Path) + " -Recurse -Force"
		if err := startDetached("powershell.exe", "-NoProfile", "-WindowStyle", "Hidden", "-Command", script); err != nil {
			u.Warn("removing %s: %v (delete the folder)", in.Path, err)
			return false
		}
		u.OK("%s is removed in a few seconds, once Homelab Wizard has quit", in.Path)
	case selfupdate.KindAppImage:
		if err := os.Remove(in.Path); err != nil {
			u.Warn("removing %s: %v", in.Path, err)
			return false
		}
		u.OK("removed %s", in.Path)
	case selfupdate.KindDeb, selfupdate.KindRPM, selfupdate.KindArch:
		u.Info("to finish, remove the package (it asks for your password): %s", packageRemove(in.Kind))
	default:
		u.Info("no installed copy of Homelab Wizard found: %s if there is one", removeApp(h.host))
	}
	return ok
}

// removeRuntime is how to take the container runtime off this machine.
func removeRuntime(p host.Profile) string {
	if p.RemoveRuntime != "" {
		return p.RemoveRuntime
	}
	return "remove " + p.Runtime
}

// trashMacApp moves the app to the Trash, as dragging it there would: it
// can be put back.
func (h *homelab) trashMacApp(app string) bool {
	if h.host.OS == "darwin" {
		home, _ := os.UserHomeDir()
		to := filepath.Join(home, ".Trash", filepath.Base(app))
		if _, err := os.Lstat(to); err == nil {
			to = filepath.Join(home, ".Trash", strings.TrimSuffix(filepath.Base(app), ".app")+" "+time.Now().Format("15.04.05")+".app")
		}
		if err := os.Rename(app, to); err != nil {
			h.ui.Warn("moving %s to the Trash: %v (drag it there)", app, err)
			return false
		}
		h.ui.OK("moved %s to the Trash", app)
	}
	return true
}
