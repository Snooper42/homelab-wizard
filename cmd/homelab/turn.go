package main

import (
	"context"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/turn"
)

// A command that changes the homelab waits its turn (internal/turn) behind
// any other that is changing it, from the app, a phone, the agent's
// nightly jobs, or a terminal, and says what it waits for. A preview never
// waits. Tidy Up keeps its own lock (media.Acquire); the agent and homelab
// serve run all the time and are not jobs, their jobs are.

// changes reports whether the command line changes the homelab: Start,
// Stop, and Restart always; one app's update (Update all only applied);
// an automatic restore test; and anything else once applied. A plan a
// person answers yes to in a terminal takes its turn then (goAhead).
func changes(cmd string, args []string) bool {
	switch cmd {
	case "media", "agent", "serve", "awake", "watchdog", "quit", "menu":
		return false
	case "start", "stop", "restart":
		return true
	case "update":
		return !hasArg(args, "--all") || applied(args)
	case "restore-test":
		return hasArg(args, "--auto") || applied(args)
	}
	return applied(args)
}

func applied(args []string) bool {
	return hasArg(args, "--apply") || hasArg(args, "--yes") || hasArg(args, "-y") || hasArg(args, "--apply=true")
}

func hasArg(args []string, a string) bool {
	for _, x := range args {
		if x == a {
			return true
		}
	}
	return false
}

// turnWhat is what a command does, as another job waiting for it says it.
func (h *homelab) turnWhat(cmd string, args []string) string {
	var names []string
	for _, a := range args {
		if strings.HasPrefix(a, "-") {
			continue
		}
		if app, ok := h.catalog.Get(a); ok {
			names = append(names, app.Name())
		}
	}
	apps := strings.Join(names, ", ")
	verb := map[string]string{"start": "Starting", "stop": "Stopping", "restart": "Restarting", "update": "Updating", "remove": "Removing", "rollback": "Rolling back"}[cmd]
	switch {
	case cmd == "update" && hasArg(args, "--nightly"):
		return "the nightly update"
	case cmd == "update" && hasArg(args, "--all"):
		return "Update all apps now"
	case verb != "" && apps != "":
		return verb + " " + apps
	case cmd == "backup":
		return "a backup"
	case cmd == "restore-test":
		return "a restore test"
	case cmd == "install" || cmd == "up":
		return "installing apps"
	case cmd == "fix":
		return "Fix it"
	case cmd == "cleanup":
		return "removing old containers"
	case cmd == "adopt":
		return "moving an app into the homelab"
	case cmd == "move":
		return "moving the homelab"
	case cmd == "upgrade":
		return "updating the homelab's files"
	case cmd == "uninstall":
		return "taking the homelab off this machine"
	case cmd == "person":
		return "a change to the household's people"
	}
	return "homelab " + cmd
}

// takeTurn waits for this command's turn, once; it is held until the
// command ends (run releases it).
func (h *homelab) takeTurn(ctx context.Context) error {
	if h.turnHeld != nil {
		return nil
	}
	release, err := turn.Take(ctx, h.root, h.turnAs, func(ahead turn.Ticket) {
		h.ui.Info("Waiting for “%s” to finish first…", ahead.What)
	})
	if err != nil {
		return err
	}
	h.turnHeld = release
	return nil
}

// releaseTurn gives the turn up, if this command took it.
func (h *homelab) releaseTurn() {
	if h.turnHeld != nil {
		h.turnHeld()
		h.turnHeld = nil
	}
}
