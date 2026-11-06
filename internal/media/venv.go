package media

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/procattr"
)

// VenvPath is the music engine's venv, where its one-time setup installs
// beets (music_organizer.py's bootstrap).
func VenvPath(home string) string {
	return filepath.Join(home, ".music-cleanup", "venv")
}

func venvPython(venv string) string {
	if runtime.GOOS == "windows" {
		return filepath.Join(venv, "Scripts", "python.exe")
	}
	return filepath.Join(venv, "bin", "python")
}

// RepairVenv removes the music engine's venv when its Python no longer
// starts, so the engine's one-time setup makes it again on the next run.
// A venv points at the Python it was made with; when that Python is
// upgraded away (Homebrew, the python.org installer, an Xcode update),
// the venv's python is a link to nothing, and "python -m venv" can't make
// a venv over it, so every music job, and the inbox filing songs, failed
// with "couldn't create …venv". Only the venv goes: beets' library and
// settings beside it stay. A venv whose Python starts is left alone, as
// is a missing one.
func RepairVenv(ctx context.Context, home string) (bool, error) {
	if home == "" {
		return false, nil
	}
	venv := VenvPath(home)
	py := venvPython(venv)
	if _, err := os.Lstat(py); err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			if _, derr := os.Stat(venv); derr != nil {
				return false, nil // no venv yet
			}
			// A venv without its python: one that was half made.
			return true, os.RemoveAll(venv)
		}
		return false, nil
	}
	if !starts(ctx, py) {
		return true, os.RemoveAll(venv)
	}
	return false, nil
}

// starts reports whether a Python runs at all.
func starts(ctx context.Context, py string) bool {
	if _, err := os.Stat(py); err != nil {
		return false // a link to a Python that's gone
	}
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, py, "-c", "import sys")
	procattr.Hide(cmd)
	if err := cmd.Run(); err != nil {
		// Cut off (the job was stopped, or the machine is very slow) says
		// nothing about the venv: keep it.
		return ctx.Err() != nil
	}
	return true
}
