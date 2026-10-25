package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/rootless"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// runtimeCmd sets up the container runtime where the homelab can do it
// itself: Docker in the home folder, run as this user (internal/rootless),
// for SteamOS and any Linux without Docker. It needs no homelab folder, so
// it runs before one exists.
//
//	homelab runtime install [--apply]
func runtimeCmd(ctx context.Context, u *ui.UI, args []string) error {
	if len(args) == 0 || args[0] != "install" {
		return errors.New("usage: homelab runtime install [--apply]")
	}
	fs := newFlags("runtime install")
	apply := applyFlag(fs)
	if _, err := parseFlags(fs, args[1:]); err != nil {
		return err
	}
	if runtime.GOOS != "linux" {
		return errors.New("the homelab sets up Docker itself only on Linux: on a Mac install OrbStack, on Windows Docker Desktop")
	}
	me, err := user.Current()
	if err != nil {
		return err
	}
	if me.Uid == "0" {
		return errors.New("run it as yourself, not as root: Docker runs as the user who sets it up")
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	uid, _ := strconv.Atoi(me.Uid)
	check := rootless.Host.Inspect(me.Username, uid)
	if c, err := docker.New(); err == nil {
		if _, err := c.Info(ctx); err == nil {
			u.OK("Docker is already running here; nothing to set up")
			return nil
		}
	}

	u.Title("Set up Docker in your home folder")
	u.Info("Docker %s and Compose %s, from Docker's own downloads (about 110 MB), checked against their checksums, into %s", rootless.Version, rootless.ComposeVersion, rootless.Dir(home))
	if script := check.RootScript(); script != "" {
		var what []string
		if !check.SubIDs {
			what = append(what, "give your account the ID ranges containers use (/etc/subuid and /etc/subgid)")
		}
		if !check.LowPorts {
			what = append(what, fmt.Sprintf("let your account use the ports from %d up, which AdGuard Home and the proxy need (%s)", rootless.LowestPort, rootless.PortsFile))
		}
		u.Info("asks for your password once, to %s", strings.Join(what, ", and "))
	}
	u.Info("Docker's setup makes it a service of yours (systemctl --user docker) and points the docker command at it")
	if !check.Linger {
		u.Info("keeps your services running when no one is logged in (loginctl enable-linger), so the apps start at boot")
	}
	u.Info("%s", u.Dim("Your home folder and /etc are kept across SteamOS updates, so it stays set up."))
	if problems := check.Problems(); len(problems) > 0 {
		return fmt.Errorf("Docker cannot run as you here: %s", strings.Join(problems, "; "))
	}
	if err := (&homelab{ui: u}).goAhead(*apply, "\nSet it up?"); err != nil {
		return err
	}

	steps := 3
	n := 0
	step := func(text string) { n++; u.Step(n, steps, "%s", text) }
	step("Downloading Docker")
	if err := rootless.Download(ctx, home, runtime.GOARCH, nil, func(s string) { u.Info("%s", s) }); err != nil {
		return err
	}
	u.OK("Docker %s is in %s", rootless.Version, rootless.Dir(home))

	step("Preparing this system")
	if script := check.RootScript(); script != "" {
		if err := asAdmin(ctx, script); err != nil {
			return fmt.Errorf("preparing the system: %w", err)
		}
		u.OK("your account has the ID ranges and the ports it needs")
	}
	if !check.Linger {
		if out, err := exec.CommandContext(ctx, "loginctl", "enable-linger", me.Username).CombinedOutput(); err != nil {
			u.Warn("could not keep your services running without a login: %v %s (loginctl enable-linger %s)", err, strings.TrimSpace(string(out)), me.Username)
		} else {
			u.OK("your services keep running without a login")
		}
	}

	step("Starting Docker")
	c := rootless.SetupCommand(ctx, home)
	c.Stdout, c.Stderr = u.Out, u.Out
	if err := c.Run(); err != nil {
		return fmt.Errorf("Docker's setup: %w", err)
	}
	// The service takes a moment to answer.
	client, err := docker.New()
	if err != nil {
		return err
	}
	for i := 0; ; i++ {
		if _, err := client.Info(ctx); err == nil {
			break
		} else if i == 30 {
			return fmt.Errorf("Docker was set up but does not answer yet: %w (systemctl --user status docker says why)", err)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(time.Second):
		}
	}
	u.OK("Docker is running as you; the homelab can start")
	return nil
}

// asAdmin runs a shell script as root: with sudo in a terminal, else with
// pkexec, which asks for the password in a window (the app has no terminal).
func asAdmin(ctx context.Context, script string) error {
	var c *exec.Cmd
	if fi, err := os.Stdin.Stat(); err == nil && fi.Mode()&os.ModeCharDevice != 0 {
		c = exec.CommandContext(ctx, "sudo", "sh", "-c", script)
		c.Stdin = os.Stdin
	} else {
		if _, err := exec.LookPath("pkexec"); err != nil {
			return errors.New("it needs the administrator's password: run homelab runtime install --apply in a terminal")
		}
		c = exec.CommandContext(ctx, "pkexec", "sh", "-c", script)
	}
	if out, err := c.CombinedOutput(); err != nil {
		return fmt.Errorf("%v %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}
