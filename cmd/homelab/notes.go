package main

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/explain"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
	"github.com/Snooper42/homelab-wizard/internal/releases"
)

// notesWait is how long update waits for release notes before going on
// without them.
var notesWait = 10 * time.Second

// previews are the release notes of the running apps among ids that say
// where theirs are published, in ids' order. GitHub not answering leaves
// an app out.
func (h *homelab) previews(ctx context.Context, ids []string) []releases.Preview {
	client, err := h.docker(ctx)
	if err != nil {
		return nil
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return nil
	}
	report := detect.Analyze(h.catalog, containers)
	ctx, cancel := context.WithTimeout(ctx, notesWait)
	defer cancel()
	out := make([]releases.Preview, len(ids))
	var wg sync.WaitGroup
	for i, id := range ids {
		a, ok := h.catalog.Get(id)
		if !ok {
			continue
		}
		ctr, running := runningContainer(report, id)
		if !running {
			continue
		}
		wg.Add(1)
		go func() {
			defer wg.Done()
			if p, err := releases.For(ctx, releases.CachePath(h.root), id, a.Meta.Releases, ctr.Image, ctr.Labels); err == nil && p.Repo != "" {
				out[i] = p
			}
		}()
	}
	wg.Wait()
	var found []releases.Preview
	for _, p := range out {
		if p.App != "" {
			found = append(found, p)
		}
	}
	return found
}

// whatsNew prints one line per app on what its update brings.
func (h *homelab) whatsNew(ctx context.Context, ids []string) {
	ps := h.previews(ctx, ids)
	if len(ps) == 0 {
		return
	}
	h.ui.Info("what is new (homelab updates notes <app> has the notes):")
	for _, p := range ps {
		name := p.App
		if a, ok := h.catalog.Get(p.App); ok {
			name = a.Name()
		}
		h.ui.Printf("  %s: %s\n", name, p.Summary())
	}
}

// releaseNotes prints what updating one app brings: each newer release
// with the start of its notes (homelab updates notes <app>).
func (h *homelab) releaseNotes(ctx context.Context, id string) error {
	a, ok := h.catalog.Get(id)
	if !ok || a.Native() != nil {
		return fmt.Errorf("unknown container app %q", id)
	}
	client, err := h.docker(ctx)
	if err != nil {
		return err
	}
	containers, err := client.Containers(ctx)
	if err != nil {
		return err
	}
	ctr, running := runningContainer(detect.Analyze(h.catalog, containers), a.ID)
	if !running {
		return fmt.Errorf("%s is not running", a.ID)
	}
	p, err := releases.For(ctx, releases.CachePath(h.root), a.ID, a.Meta.Releases, ctr.Image, ctr.Labels)
	u := h.ui
	if u.JSON {
		if err != nil {
			return err
		}
		emit(u, "release-notes", p)
		return nil
	}
	if p.Repo == "" {
		u.Printf("%s's image does not say where its releases are published.\n", a.Name())
		return nil
	}
	if err != nil {
		return fmt.Errorf("%s's releases (%s): %w", a.Name(), p.Page, err)
	}
	u.Printf("%s: %s\n", a.Name(), p.Summary())
	for _, r := range p.Releases {
		title := r.Tag
		if r.Name != "" {
			title += " — " + r.Name
		}
		if !r.When.IsZero() {
			title += " (" + r.When.Format("2 Jan 2006") + ")"
		}
		u.Printf("\n%s\n", u.Bold(title))
		if r.Notes != "" {
			u.Printf("  %s\n", strings.ReplaceAll(r.Notes, "\n", "\n  "))
		}
		u.Printf("  %s\n", r.URL)
	}
	if len(p.Releases) > 0 {
		u.Printf("\nAll releases: %s\n", p.Page)
	}
	return nil
}

// explainLogs asks the Ollama on this machine what a's log says.
func (h *homelab) explainLogs(ctx context.Context, client *docker.Client, a *catalog.App, logArgs []string) error {
	model, err := explain.Model(ctx, h.envMap()["OLLAMA_MODEL"])
	if err != nil {
		return err
	}
	cmd := exec.CommandContext(ctx, client.Bin, append(h.project(a.File).ComposeArgs(a.Profiles), logArgs...)...)
	out, err := procattr.Hide(cmd).CombinedOutput()
	if err != nil {
		return fmt.Errorf("reading %s's log: %w", a.ID, err)
	}
	h.ui.Info("asking %s on this machine what %s's log says (it stays here)", model, a.Name())
	answer, err := explain.Explain(ctx, model, a.Name(), string(out))
	if err != nil {
		return err
	}
	h.ui.Printf("\n%s\n", answer)
	return nil
}
