package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/kit"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
	"github.com/Snooper42/homelab-wizard/internal/upgrade"
)

// upgradeCmd checks the homelab folder against GitHub and, on --apply (or
// a yes), fast-forwards it and runs the new version's up.
func (h *homelab) upgradeCmd(ctx context.Context, args []string) error {
	fs := newFlags("upgrade")
	apply := applyFlag(fs)
	back := fs.Bool("back", false, "")
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	u := h.ui
	if *back {
		return h.upgradeBack(ctx, *apply)
	}
	c, err := upgrade.Inspect(ctx, h.root, true)
	if u.JSON {
		if err != nil {
			return err
		}
		emit(u, "upgrade", c)
		return nil
	}
	if err != nil {
		return err
	}
	u.Title("Homelab files")
	if c.FetchError != "" {
		u.Warn("could not reach GitHub, so this compares with the last check: %s", c.FetchError)
	}
	if c.Ahead > 0 {
		u.Warn("%s has %d commit(s) of its own that are not on GitHub; a fast-forward is not possible until they are pushed or dropped", c.Branch, c.Ahead)
	}
	where := c.Upstream
	if c.Channel == upgrade.Stable {
		if c.Target == "" {
			u.OK("no release on the stable channel yet (%s stays at %s); UPDATE_CHANNEL=testing follows %s", c.Branch, c.Version, c.Upstream)
			return nil
		}
		where = c.Target + " (stable)"
	}
	if c.Behind == 0 {
		u.OK("up to date with %s (%s)", where, c.Version)
		return nil
	}
	u.Info("%d change(s) on %s:", c.Behind, where)
	for _, ch := range c.Changes {
		u.Printf("    %s %s %s\n", u.Dim(ch.Hash), ch.Subject, u.Dim("("+ago(ch.When)+")"))
	}
	if c.Behind > len(c.Changes) {
		u.Printf("    %s\n", u.Dim(fmt.Sprintf("and %d older", c.Behind-len(c.Changes))))
	}
	if c.NewVersion != "" && c.NewVersion != c.Version {
		u.Info("version %s → %s", c.Version, c.NewVersion)
	}
	if len(c.Notes) > 0 {
		u.Info("what is new (CHANGELOG.md):")
		for _, n := range c.Notes {
			u.Printf("    • %s\n", n)
		}
	}
	if c.SettingsChanged {
		u.Info("new settings: up adds them to .env, generating any secrets")
	}
	if c.AppChanged {
		u.Info("the desktop app changed too: get the newest build afterwards (docs/Upgrading.md)")
	}
	if len(c.Dirty) > 0 && c.Kit {
		u.Warn("edited here; where the update changes one too, your copy is kept beside it as .local: %s", strings.Join(c.Dirty, ", "))
	} else if len(c.Dirty) > 0 {
		u.Warn("edited here, kept unless the update changes them too (then git stops and nothing changes): %s", strings.Join(c.Dirty, ", "))
	}
	u.Info("docs/Upgrading.md says what each batch of changes asks of you")
	if err := h.goAhead(*apply, "Get the update and restart what changed?"); err != nil {
		return err
	}
	// Where to come back to: homelab upgrade --back.
	if _, err := upgrade.Mark(ctx, h.root, c); err != nil {
		return fmt.Errorf("noting the version to come back to: %w", err)
	}
	if c.Kit {
		m, changes, err := kit.Update(c.KitPath, h.root)
		if err != nil {
			return err
		}
		for _, ch := range changes {
			if strings.HasPrefix(ch.What, "kept") {
				u.Warn("%s: %s", ch.Path, ch.What)
			}
		}
		u.OK("now at %s (%d files changed)", m.Short(), len(changes))
	} else {
		if _, err := upgrade.PullTo(ctx, h.root, c); err != nil {
			return err
		}
		u.OK("now at %s", where)
	}
	// Apps an update moved to another Compose project move first (with a
	// backup); then the new version's up. Both through the launcher, so the
	// CLI is rebuilt from the new sources first.
	mig := h.launcher(ctx, "migrate", "--apply")
	mig.Stdout, mig.Stderr = u.Out, u.Out
	if err := mig.Run(); err != nil {
		return fmt.Errorf("homelab migrate: %w", err)
	}
	cmd := h.launcher(ctx, "up", "--apply")
	cmd.Stdout, cmd.Stderr = u.Out, u.Out
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("homelab up: %w", err)
	}
	return nil
}

// upgradeBack returns the folder to where it was before the last upgrade,
// then runs that version's up.
func (h *homelab) upgradeBack(ctx context.Context, apply bool) error {
	u := h.ui
	p, ok := upgrade.LoadPoint(h.root)
	if !ok {
		return fmt.Errorf("there is no earlier version to go back to: homelab upgrade notes one each time it updates")
	}
	short := p.Commit
	if len(short) > 7 {
		short = short[:7]
	}
	u.Title("Back to the previous version")
	u.Info("go back to %s (%s), as it was before the upgrade on %s", p.Version, short, p.When.Local().Format("Mon 2 Jan 15:04"))
	u.Info("settings, data, and your own apps stay as they are")
	if err := h.goAhead(apply, "Go back and restart what changed?"); err != nil {
		return err
	}
	if err := upgrade.Back(ctx, h.root, p); err != nil {
		return err
	}
	u.OK("back at %s (%s)", p.Version, short)
	cmd := h.launcher(ctx, "up", "--apply")
	cmd.Stdout, cmd.Stderr = u.Out, u.Out
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("homelab up: %w", err)
	}
	return nil
}

// launcher runs another homelab command: the repository's launcher, which
// rebuilds the CLI when its sources changed, or this binary when Go is not
// installed (the copy that ships with the desktop app).
func (h *homelab) launcher(ctx context.Context, args ...string) *exec.Cmd {
	if !h.ui.Color {
		args = append(args, "--no-color")
	}
	script := filepath.Join(h.root, "homelab")
	if runtime.GOOS == "windows" {
		script += ".cmd"
	}
	_, goErr := exec.LookPath("go")
	if _, err := os.Stat(script); err == nil && goErr == nil {
		cmd := procattr.Hide(exec.CommandContext(ctx, script, args...))
		cmd.Dir = h.root
		return cmd
	}
	self, _ := os.Executable()
	cmd := procattr.Hide(exec.CommandContext(ctx, self, append([]string{"--root", h.root}, args...)...))
	cmd.Dir = h.root
	return cmd
}

// ago is a short "3 hours ago" for a past time.
func ago(t time.Time) string {
	d := time.Since(t)
	switch {
	case d < time.Minute:
		return "just now"
	case d < time.Hour:
		return fmt.Sprintf("%d min ago", int(d.Minutes()))
	case d < 48*time.Hour:
		return fmt.Sprintf("%d hours ago", int(d.Hours()))
	default:
		return fmt.Sprintf("%d days ago", int(d.Hours()/24))
	}
}

// until is ago for a time ahead: "in 5 hours".
func until(t time.Time) string {
	d := time.Until(t)
	switch {
	case d < time.Minute:
		return "now"
	case d < time.Hour:
		return fmt.Sprintf("in %d min", int(d.Minutes()))
	case d < 48*time.Hour:
		return fmt.Sprintf("in %d hours", int(d.Hours()))
	default:
		return fmt.Sprintf("in %d days", int(d.Hours()/24))
	}
}
