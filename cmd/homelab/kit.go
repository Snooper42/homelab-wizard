package main

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/kit"
)

// kitCmd is the homelab folder as the desktop app carries it:
//
//	homelab kit                    which kit this folder was made from
//	homelab kit pack -o FILE       write a kit of this checkout (release builds)
//	homelab kit update FILE        update a folder the app made from a newer kit
func (h *homelab) kitCmd(ctx context.Context, args []string) error {
	fs := newFlags("kit")
	out := fs.String("o", kit.FileName, "")
	commit := fs.String("commit", "", "")
	apply := applyFlag(fs)
	rest, err := parseFlags(fs, args)
	if err != nil {
		return err
	}
	sub := ""
	if len(rest) > 0 {
		sub, rest = rest[0], rest[1:]
	}
	switch sub {
	case "":
		m, ok := kit.Installed(h.root)
		if !ok {
			h.ui.Info("%s is a git checkout: homelab upgrade updates it from GitHub", h.root)
			return nil
		}
		h.ui.OK("made by the desktop app from kit %s (version %s); new app versions bring updates", m.Short(), m.Version)
		return nil
	case "pack":
		return h.kitPack(ctx, *out, *commit)
	case "update":
		if len(rest) != 1 {
			return fmt.Errorf("usage: homelab kit update <%s>", kit.FileName)
		}
		return h.kitUpdate(ctx, rest[0], *apply)
	}
	return fmt.Errorf("unknown kit command %q (pack, update)", sub)
}

func (h *homelab) kitPack(ctx context.Context, out, commit string) error {
	git := func(args ...string) (string, error) {
		c := exec.CommandContext(ctx, "git", append([]string{"-C", h.root}, args...)...)
		b, err := c.Output()
		return strings.TrimSpace(string(b)), err
	}
	list, err := git("ls-files", "-z")
	if err != nil {
		return fmt.Errorf("kit pack needs the git checkout: %w", err)
	}
	if commit == "" {
		if commit, err = git("rev-parse", "HEAD"); err != nil {
			return err
		}
	}
	var buf bytes.Buffer
	m, err := kit.Pack(&buf, h.root, strings.Split(strings.Trim(list, "\x00"), "\x00"), h.repoVersion(), commit)
	if err != nil {
		return err
	}
	if err := os.WriteFile(out, buf.Bytes(), 0o644); err != nil {
		return err
	}
	h.ui.OK("wrote %s: %d files from %s, %d KB", out, len(m.Files), m.Short(), buf.Len()/1024)
	return nil
}

func (h *homelab) kitUpdate(ctx context.Context, archive string, apply bool) error {
	old, ok := kit.Installed(h.root)
	if !ok {
		return fmt.Errorf("%s is a git checkout: update it with homelab upgrade", h.root)
	}
	m, err := kit.Info(archive)
	if err != nil {
		return err
	}
	if m.Commit == old.Commit {
		h.ui.OK("already at kit %s", m.Short())
		return nil
	}
	if err := h.goAhead(apply, fmt.Sprintf("Update the homelab folder from kit %s to %s? Settings, data, and your own apps are kept; a file you changed is saved beside it as .local.", old.Short(), m.Short())); err != nil {
		return err
	}
	m, changes, err := kit.Update(archive, h.root)
	if err != nil {
		return err
	}
	for _, c := range changes {
		h.ui.Println(fmt.Sprintf("  %s: %s", c.Path, c.What))
	}
	h.ui.OK("updated to kit %s (%d files changed); run homelab up to apply it", m.Short(), len(changes))
	return nil
}
