package main

import (
	"context"
	"os"
	"os/exec"
	"runtime"
	"slices"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/battery"
	"github.com/Snooper42/homelab-wizard/internal/diskspace"
	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// externalDrive is the drive a path is on ("/Volumes/Hobbies",
// "/media/you/Hobbies", "E:\"), or "" for one on the internal disk.
func externalDrive(path string) string { return diskspace.ExternalDrive(path) }

// drives are the external drives the homelab's folder settings and its
// apps' mounted folders live on.
func (h *homelab) drives(containers []docker.Container) []string {
	var out []string
	add := func(p string) {
		if d := externalDrive(p); d != "" && !slices.Contains(out, d) {
			out = append(out, d)
		}
	}
	env := h.envMap()
	for _, s := range diskspace.Settings {
		add(env[s.Key])
	}
	for _, c := range containers {
		if strings.HasPrefix(c.Project(), "homelab") {
			for _, b := range c.Binds {
				add(b)
			}
		}
	}
	slices.Sort(out)
	return out
}

// waitForDrives waits up to limit for every drive the apps use to be
// mounted: after a restart the startup job runs before the system mounts them.
func (h *homelab) waitForDrives(ctx context.Context, limit time.Duration) {
	var containers []docker.Container
	if client, err := h.docker(ctx); err == nil {
		containers, _ = client.Containers(ctx)
	}
	deadline := time.Now().Add(limit)
	for {
		var missing []string
		for _, d := range h.drives(containers) {
			if !diskspace.Mounted(d) {
				missing = append(missing, d)
			}
		}
		// The media folder itself too, wherever it is.
		if m := h.envMap()["MEDIA_ROOT"]; m != "" && externalDrive(m) == "" {
			if _, err := os.Stat(m); err != nil {
				missing = append(missing, m)
			}
		}
		if len(missing) == 0 {
			return
		}
		if time.Now().After(deadline) {
			h.ui.Warn("%s still not mounted after %s; apps that need it start once it is (the watchdog checks every 15 minutes)", strings.Join(missing, ", "), limit)
			return
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(5 * time.Second):
		}
	}
}

// failedToStart reports whether Docker meant to run c but could not, or it
// died on its own: not one stopped by hand. strict asks for Docker's own
// start error (a folder that was missing), which is all the watchdog acts on.
func failedToStart(c docker.Container, strict bool) bool {
	if c.Running || !strings.HasPrefix(c.Project(), "homelab") {
		return false
	}
	if c.RestartPolicy != "unless-stopped" && c.RestartPolicy != "always" {
		return false
	}
	if c.Error != "" {
		return true
	}
	if strict || c.StartedAt.IsZero() {
		return false
	}
	switch c.ExitCode {
	case 0, 137, 143: // stopped by hand, or by a shutdown that stopped it cleanly
		return false
	}
	return true
}

// startFailed starts the homelab's containers that could not start (a
// drive mounted late, after a restart) once every folder they mount is
// there, and returns their names.
func (h *homelab) startFailed(ctx context.Context, strict bool) []string {
	client, err := h.docker(ctx)
	if err != nil {
		return nil
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return nil
	}
	paused := battery.Load(battery.Path(h.root)).Paused
	var started []string
	for _, c := range containers {
		if !failedToStart(c, strict) || slices.Contains(paused, c.Service()) {
			continue
		}
		ready := true
		for _, b := range c.Binds {
			if _, err := os.Stat(b); err != nil {
				ready = false
			}
		}
		if !ready {
			continue
		}
		if _, err := client.Runner.Output(ctx, client.Bin, "start", c.ID); err == nil {
			started = append(started, c.Name)
		}
	}
	return started
}

// openMacApps opens the native Mac apps (Jellyfin) that are installed but
// not answering, after a restart: their media is on the drives waited for.
func (h *homelab) openMacApps(ctx context.Context) []string {
	if runtime.GOOS != "darwin" {
		return nil
	}
	var opened []string
	for _, a := range h.catalog.Apps {
		n := a.Native()
		if n == nil || !strings.Contains(n.Install, "--cask") || api.NativeUp(ctx, n.Port) {
			continue
		}
		for _, name := range []string{a.Name(), a.Name() + " Server"} {
			if exec.CommandContext(ctx, "open", "-g", "-a", name).Run() == nil {
				opened = append(opened, a.Name())
				break
			}
		}
	}
	return opened
}
