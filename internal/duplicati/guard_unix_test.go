//go:build unix

package duplicati

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// The guard itself, run by sh as Duplicati runs it: it stops the backup
// while the folder is missing, empty, or holds only hidden files (an
// unplugged drive's folder, Finder's .DS_Store in it), and lets it run once
// a photo is there.
func TestGuardScriptRuns(t *testing.T) {
	src := filepath.Join(t.TempDir(), "photos") + "/"
	j := HomelabJob{Name: "Homelab Photos", Folder: "photos", Sources: []string{src}, Large: true}
	script := filepath.Join(t.TempDir(), "photos.sh")
	if err := os.WriteFile(script, []byte(GuardScript(j)), 0o755); err != nil {
		t.Fatal(err)
	}
	run := func() (int, string) {
		out, err := exec.Command("sh", script).CombinedOutput()
		if e, ok := err.(*exec.ExitError); ok {
			return e.ExitCode(), string(out)
		}
		if err != nil {
			t.Fatal(err)
		}
		return 0, string(out)
	}
	if code, out := run(); code == 0 || !strings.Contains(out, "is empty or missing (is its drive plugged in?)") {
		t.Errorf("missing folder: %d %q", code, out)
	}
	_ = os.MkdirAll(src, 0o755)
	if code, _ := run(); code == 0 {
		t.Error("an empty folder backed up")
	}
	_ = os.WriteFile(filepath.Join(src, ".DS_Store"), []byte("x"), 0o644)
	if code, _ := run(); code == 0 {
		t.Error("a folder of hidden files backed up")
	}
	_ = os.WriteFile(filepath.Join(src, "IMG_1.HEIC"), []byte("x"), 0o644)
	if code, out := run(); code != 0 {
		t.Errorf("a folder with a photo stopped: %d %q", code, out)
	}
	// A name with a space and a quote, as a drive's can have, stays one path.
	odd := filepath.Join(t.TempDir(), "Media's photos") + "/"
	_ = os.MkdirAll(odd, 0o755)
	_ = os.WriteFile(filepath.Join(odd, "IMG_2.HEIC"), []byte("x"), 0o644)
	j.Sources = []string{odd}
	_ = os.WriteFile(script, []byte(GuardScript(j)), 0o755)
	if code, out := run(); code != 0 {
		t.Errorf("a folder whose name has a space and a quote: %d %q", code, out)
	}
}
