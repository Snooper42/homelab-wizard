package media

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

// The music engine's venv (~/.music-cleanup/venv) links to the Python it was
// made with. When that Python goes (Homebrew moves to a newer one, an
// Xcode update), the venv can't run and can't be made again over itself:
// every music job, and the inbox filing songs, fails. A venv whose Python
// doesn't start is removed, so the engine's one-time setup makes it anew;
// one that runs is left as it is, and so is the rest of ~/.music-cleanup.
func TestABrokenMusicVenvIsMadeAgain(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("a venv's Python is a link only off Windows")
	}
	ctx := context.Background()
	home := t.TempDir()
	venv := VenvPath(home)
	bin := filepath.Join(venv, "bin")
	if err := os.MkdirAll(bin, 0o755); err != nil {
		t.Fatal(err)
	}
	keep := filepath.Join(home, ".music-cleanup", "library.db")
	if err := os.WriteFile(keep, []byte("beets"), 0o644); err != nil {
		t.Fatal(err)
	}
	// Its Python was removed: the link points nowhere.
	if err := os.Symlink(filepath.Join(home, "gone", "python3.13"), filepath.Join(bin, "python")); err != nil {
		t.Fatal(err)
	}
	if removed, err := RepairVenv(ctx, home); err != nil || !removed {
		t.Fatalf("a venv whose Python is gone: removed %v, %v", removed, err)
	}
	if _, err := os.Stat(venv); !os.IsNotExist(err) {
		t.Errorf("the venv stayed: %v", err)
	}
	if _, err := os.Stat(keep); err != nil {
		t.Errorf("beets' own files went with it: %v", err)
	}
	// A venv whose Python runs is kept.
	if err := os.MkdirAll(bin, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(bin, "python"), []byte("#!/bin/sh\nexit 0\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	if removed, err := RepairVenv(ctx, home); err != nil || removed {
		t.Errorf("a working venv: removed %v, %v", removed, err)
	}
	// No venv yet: nothing to do.
	if removed, err := RepairVenv(ctx, t.TempDir()); err != nil || removed {
		t.Errorf("no venv: removed %v, %v", removed, err)
	}
}
