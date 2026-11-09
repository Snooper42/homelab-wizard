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

// Where each system looks for drives: macOS's /Volumes, a Linux desktop's
// mounts for this user and /mnt, and Windows' drive letters with its own
// drive as the system's.
func TestDrivePlaces(t *testing.T) {
	var asked []string
	sub := func(dir string) []string { asked = append(asked, dir); return []string{dir + "/One"} }
	if sys, tops := places("darwin", "you", "", sub); sys != "/" || len(tops) != 1 || tops[0] != "/Volumes/One" {
		t.Errorf("macOS: %q %q", sys, tops)
	}
	asked = nil
	if sys, tops := places("linux", "you", "", sub); sys != "/" || len(tops) != 3 || asked[0] != "/media/you" || asked[1] != "/run/media/you" || asked[2] != "/mnt" {
		t.Errorf("Linux: %q %q %q", sys, tops, asked)
	}
	sys, tops := places("windows", "", "d:", sub)
	if sys != `D:\` || len(tops) != 26 || tops[4] != `E:\` {
		t.Errorf("Windows: %q %q", sys, tops)
	}
	// A Windows drive is named by its letter.
	got := drives(`C:\`, []string{`C:\`, `E:\`}, func(string) bool { return true },
		func(string) (uint64, uint64, error) { return 1, 2, nil }, func(p string) string { return p })
	if len(got) != 2 || got[1].Name != "E:" || !got[0].Internal {
		t.Errorf("Windows drives: %+v", got)
	}
	if _, tops := places("plan9", "", "", sub); tops != nil {
		t.Errorf("elsewhere: %q", tops)
	}
	if subfolders(filepath.Join(t.TempDir(), "missing")) != nil {
		t.Error("a folder that isn't there has drives")
	}
}

// On this machine: its own disk first, with its space.
func TestDrivesOnThisMachine(t *testing.T) {
	got := Drives()
	if len(got) == 0 || !got[0].Internal || got[0].Total == 0 {
		t.Errorf("this machine's drives: %+v", got)
	}
}
