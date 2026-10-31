package main

import (
	"context"
	"fmt"
	"runtime"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/awake"
	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/battery"
	"github.com/Snooper42/homelab-wizard/internal/domain"
	"github.com/Snooper42/homelab-wizard/internal/explain"
	"github.com/Snooper42/homelab-wizard/internal/setup"
)

// setupChecklist shows the first-time bring-up as a checklist with live
// checks (internal/setup). The desktop app's Setup screen shows the same.
func (h *homelab) setupChecklist(ctx context.Context, args []string) error {
	if _, err := parseFlags(newFlags("setup"), args); err != nil {
		return err
	}
	steps := setup.Steps(ctx, h.setupInputs(ctx))
	u := h.ui
	if u.JSON {
		emit(u, "setup", steps)
		return nil
	}
	u.Title("First-time setup")
	done, counted, later := 0, 0, 0
	for i, s := range steps {
		// A step that can wait counts once it is done.
		if !s.Later || s.State == "done" {
			counted++
		} else {
			later++
		}
		mark := u.Yellow("•")
		switch s.State {
		case "done":
			mark, done = u.Green("✓"), done+1
			u.Printf("  %s %2d. %s\n", mark, i+1, s.Title)
			continue
		case "waiting":
			mark = u.Dim("·")
		}
		state := s.State
		if s.Later {
			state += ", can wait a week"
		}
		u.Printf("  %s %2d. %s %s\n", mark, i+1, s.Title, u.Dim("("+state+")"))
		if s.Detail != "" {
			u.Printf("        %s\n", u.Dim(s.Detail))
		}
		if s.State == "waiting" {
			continue
		}
		if len(s.Settings) > 0 {
			u.Printf("        %s %s\n", u.Dim("settings:"), strings.Join(s.Settings, ", "))
		}
		for _, r := range s.Run {
			u.Printf("        %s homelab %s\n", u.Dim("run:"), strings.Join(r, " "))
		}
		for _, c := range s.Choices {
			for _, r := range c.Run {
				u.Printf("        %s homelab %s\n", u.Dim(strings.ToLower(c.Label[:1])+c.Label[1:]+":"), strings.Join(quoteArgs(r), " "))
			}
		}
		if s.Open != "" {
			u.Printf("        %s %s\n", u.Dim("open:"), u.Cyan(s.Open))
		}
		if s.Manual {
			u.Printf("        %s\n", u.Dim("mark it done on the app's Setup screen"))
		}
	}
	summary := fmt.Sprintf("%d of %d steps done", done, counted)
	if later > 0 {
		summary += fmt.Sprintf("; %d more can wait a week", later)
	}
	u.Printf("\n  %s\n", u.Dim(summary+"."))
	return nil
}

// setupInputs gathers what the checklist reads; a stopped runtime or a
// missing scheduler just leaves those steps to do.
func (h *homelab) setupInputs(ctx context.Context) setup.Inputs {
	env := h.envMap()
	in := setup.Inputs{Env: env, Host: h.host, Done: setup.LoadDone(h.root), Since: setup.FirstSeen(h.root), Probe: setup.NetProbe{}, Backups: setup.DuplicatiJobs(ctx, env), Power: battery.Power,
		Ollama: func() bool { return explain.Up(ctx) }, AwakeRefused: func() bool { return awake.Refused(ctx) }}
	in.ThisMac = domain.FindsByName
	restore := backup.LoadRestoreLog(h.restoreLogPath())
	in.Restore = &restore
	if runtime.GOOS == "darwin" {
		in.ThisMac = setup.MacFinds
	}
	if client, err := h.docker(ctx); err == nil {
		if containers, err := client.Containers(ctx); err == nil {
			st := api.StatusOf(ctx, h.catalog, containers, env, false)
			in.Status = &st
		}
	} else {
		in.RuntimeErr = err
	}
	if l, err := h.scheduler(); err == nil {
		in.Jobs = func() (int, int) {
			n := 0
			for _, j := range jobs() {
				if l.Status(j.Label).Loaded {
					n++
				}
			}
			return n, len(jobs())
		}
	}
	return in
}

// quoteArgs quotes the arguments with spaces, so a line can be pasted.
func quoteArgs(args []string) []string {
	out := make([]string, len(args))
	for i, a := range args {
		if strings.ContainsAny(a, " '\"") {
			a = "'" + strings.ReplaceAll(a, "'", `'\''`) + "'"
		}
		out[i] = a
	}
	return out
}
