package upgrade

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/kit"
)

// Point is the version the folder had before the last upgrade, to go back to.
type Point struct {
	Version string    `json:"version"`
	Commit  string    `json:"commit"`
	When    time.Time `json:"when"`
	// Kit: the folder's files then, as a kit (a folder the app made).
	Kit string `json:"kit,omitempty"`
}

// PointPath is where the last Point is kept.
func PointPath(root string) string { return filepath.Join(root, "data", "upgrade", "previous.json") }

// LoadPoint reads the last Point; ok is false when there is none.
func LoadPoint(root string) (Point, bool) {
	var p Point
	data, err := os.ReadFile(PointPath(root))
	if err != nil || json.Unmarshal(data, &p) != nil || p.Commit == "" {
		return p, false
	}
	return p, true
}

// Mark records the folder as it is now, before an upgrade: the commit for
// a git checkout, or a kit of its files for a folder the app made.
func Mark(ctx context.Context, root string, c Check) (Point, error) {
	p := Point{Version: c.Version, When: time.Now()}
	dir := filepath.Dir(PointPath(root))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return p, err
	}
	if m, ok := kit.Installed(root); ok {
		p.Commit, p.Kit = m.Commit, filepath.Join(dir, "previous-"+kit.FileName)
		files := make([]string, 0, len(m.Files))
		for f := range m.Files {
			files = append(files, f)
		}
		sort.Strings(files)
		f, err := os.Create(p.Kit)
		if err != nil {
			return p, err
		}
		_, err = kit.Pack(f, root, files, m.Version, m.Commit)
		if cerr := f.Close(); err == nil {
			err = cerr
		}
		if err != nil {
			return p, err
		}
	} else {
		head, err := git(ctx, root, "rev-parse", "HEAD")
		if err != nil {
			return p, err
		}
		p.Commit = head
	}
	data, _ := json.MarshalIndent(p, "", "  ")
	return p, os.WriteFile(PointPath(root), append(data, '\n'), 0o644)
}

// Back returns the folder to the Point: a git checkout moves back to its
// commit (keeping edits, as git reset --keep does), a folder the app made
// gets its files from the kit saved then. The Point is used up.
func Back(ctx context.Context, root string, p Point) error {
	if p.Kit != "" {
		if _, _, err := kit.Update(p.Kit, root); err != nil {
			return err
		}
	} else {
		// --keep keeps edits, and refuses only where an edit and the move
		// touch the same file.
		if _, err := git(ctx, root, "reset", "--keep", p.Commit); err != nil {
			return fmt.Errorf("going back: %w", err)
		}
	}
	if err := os.Remove(PointPath(root)); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	if p.Kit != "" {
		_ = os.Remove(p.Kit)
	}
	return nil
}
