package backup

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"time"
)

// HydrateEach is how long one file may take to come down from the cloud
// before Hydrate gives up on it: a backup's volumes are 50 MB each.
const HydrateEach = 5 * time.Minute

// Hydrate makes every file under dir that the cloud drive keeps online only
// (dataless says which: on a Mac, macOS's SF_DATALESS flag) a real file on
// this machine, by reading it through here, and returns how many it read.
//
// Why: a cloud drive on a Mac (Proton Drive, iCloud Drive, Google Drive)
// keeps files as placeholders until a Mac program reads them, which makes
// the drive fetch them. Duplicati reads the backup from inside Docker's
// Linux machine, which a placeholder does not answer the same way, so a
// restore on a new Mac (homelab rebuild), whose cloud drive has just synced
// the folder as placeholders, can fail or stall halfway
// (docs/Known Issues.md, ISSUE-0003). Reading them here first, each within
// each, is what makes the restore see whole files. Files already here are
// not read again, and a folder that is not on this machine has nothing to
// fetch.
func Hydrate(ctx context.Context, dir string, dataless func(fs.FileInfo) bool, each time.Duration) (int, error) {
	if _, err := os.Stat(dir); errors.Is(err, fs.ErrNotExist) {
		return 0, nil // not on this machine (Duplicati's own destination): nothing to fetch
	}
	var todo []string
	err := filepath.WalkDir(dir, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.Type().IsRegular() {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		if dataless(info) {
			todo = append(todo, p)
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	for i, p := range todo {
		if err := readWithin(ctx, p, each); err != nil {
			return i, err
		}
	}
	return len(todo), nil
}

// errSlow is a file the cloud drive did not hand over in time.
var errSlow = errors.New("the cloud drive did not download it in time: open its app, let it finish syncing, and try again")

func readWithin(ctx context.Context, path string, limit time.Duration) error {
	done := make(chan error, 1)
	go func() {
		f, err := os.Open(path)
		if err != nil {
			done <- err
			return
		}
		_, err = io.Copy(io.Discard, f)
		_ = f.Close()
		done <- err
	}()
	timer := time.NewTimer(limit)
	defer timer.Stop()
	select {
	case err := <-done:
		if err != nil {
			return fmt.Errorf("reading %s from the cloud drive: %w", path, err)
		}
		return nil
	case <-timer.C:
		// The read may still finish: it is left to, as an open file in a
		// cloud drive can't be told to stop.
		return fmt.Errorf("%s: %w", path, errSlow)
	case <-ctx.Done():
		return ctx.Err()
	}
}
