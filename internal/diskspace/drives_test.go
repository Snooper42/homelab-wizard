package diskspace

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

// The drives a person can pick for the libraries: this computer's own
// first, then each one plugged in by name; a top that isn't mounted, a
// hidden one, one whose space can't be read, and the system's disk listed
// again under another name are left out.
func TestDrivesListsThisComputerThenEachPluggedIn(t *testing.T) {
	vols := t.TempDir()
	for _, n := range []string{"Zeta", "hobbies", ".Trashes", "Gone", "Asleep"} {
		_ = os.MkdirAll(filepath.Join(vols, n), 0o755)
	}
	tops := subfolders(vols)
	_ = os.Symlink("/", filepath.Join(vols, "Macintosh HD"))
	if len(subfolders(vols)) != len(tops) {
		t.Fatal("a link to the system's disk counted as a drive")
	}
	mounted := func(p string) bool { return filepath.Base(p) != "Gone" }
	space := func(p string) (uint64, uint64, error) {
		if filepath.Base(p) == "Asleep" {
			return 0, 0, errors.New("not answering")
		}
		return 1 << 30, 4 << 30, nil
	}
	device := func(p string) string { // each folder its own drive, as a plugged-in one is
		if p == "/" {
			return "system"
		}
		return p
	}
	got := drives("/", append(tops, "/"), mounted, space, device)
	var names []string
	for _, d := range got {
		names = append(names, d.Name)
	}
	if len(got) != 3 || !got[0].Internal || got[0].Path != "/" || names[1] != "hobbies" || names[2] != "Zeta" {
		t.Errorf("drives: %q %+v", names, got)
	}
	if got[1].Free != 1<<30 || got[1].Total != 4<<30 || got[1].Internal {
		t.Errorf("a drive's space: %+v", got[1])
	}
}
