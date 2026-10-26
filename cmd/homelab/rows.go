package main

import (
	"context"
	"strings"
	"sync"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/progress"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// appRows is what Compose prints, shown in a terminal as a line per app
// as its stage changes ("✓ Navidrome  Running"), as the app's window shows
// its rows: the same app's line is drawn again in place while its download
// moves. Lines that say something else (an error) pass through as they are.
type appRows struct {
	u    *ui.UI
	apps *progress.Tracker

	mu   sync.Mutex
	buf  []byte
	last string // the app whose line the cursor is on, to draw it again
	seen map[string]string
}

func newAppRows(u *ui.UI, apps *progress.Tracker) *appRows {
	return &appRows{u: u, apps: apps, seen: map[string]string{}}
}

func (r *appRows) Write(p []byte) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.buf = append(r.buf, p...)
	for {
		i := strings.IndexAny(string(r.buf), "\r\n")
		if i < 0 {
			break
		}
		r.line(string(r.buf[:i]))
		r.buf = r.buf[i+1:]
	}
	return len(p), nil
}

// Flush ends the line the cursor is on, and passes on a last line that had
// no newline.
func (r *appRows) Flush() {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.buf) > 0 {
		r.line(string(r.buf))
		r.buf = nil
	}
	r.end()
}

func (r *appRows) end() {
	if r.last != "" {
		r.u.Printf("\n")
		r.last = ""
	}
}

func (r *appRows) line(s string) {
	if strings.TrimSpace(s) == "" {
		return
	}
	ups, text := r.apps.Line(s)
	failed := false
	for _, up := range ups {
		failed = failed || up.Failed
		row := r.row(up)
		if r.seen[up.App] == row {
			continue
		}
		r.seen[up.App] = row
		if r.last == up.App {
			r.u.Printf("\r\033[K%s", row)
		} else {
			r.end()
			r.u.Printf("%s", row)
		}
		r.last = up.App
		if up.Done {
			r.end()
		}
	}
	// The plain words of a line that became a row are the row; a line that
	// did not, or a failure, is shown as it is, except Compose's routine
	// progress (a network made, a layer).
	routine := strings.HasPrefix(strings.TrimSpace(s), "{") && !strings.Contains(s, `"Error"`) && !strings.Contains(s, `"error"`)
	if text != "" && (failed || len(ups) == 0 && !routine) {
		r.end()
		r.u.Printf("    %s\n", r.u.Dim(text))
	}
}

func (r *appRows) row(up progress.Update) string {
	mark := r.u.Dim("•")
	switch {
	case up.Failed:
		mark = r.u.Red("✗")
	case up.Done:
		mark = r.u.Green("✓")
	}
	return "  " + mark + " " + up.Name + "  " + r.u.Dim(up.Words)
}

// rowsRunner runs Docker with its output through rows, and ends the rows'
// last line when each command does, before the CLI prints its own.
type rowsRunner struct {
	docker.ExecRunner
	rows *appRows
}

func (r rowsRunner) Stream(ctx context.Context, dir, name string, args ...string) error {
	defer r.rows.Flush()
	return r.ExecRunner.Stream(ctx, dir, name, args...)
}
