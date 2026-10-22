package backup

import (
	"os"
	"path/filepath"
	"slices"
	"testing"
)

func TestDestinations(t *testing.T) {
	home, vols := t.TempDir(), t.TempDir()
	for _, d := range []string{"Library/CloudStorage/ProtonDrive-me@proton.me-folder", "Library/CloudStorage/GoogleDrive-me@gmail.com", "Library/Mobile Documents/com~apple~CloudDocs"} {
		_ = os.MkdirAll(filepath.Join(home, d), 0o755)
	}
	for _, d := range []string{"Media/media", "Backup", ".Spotlight-V100", "com.apple.TimeMachine.localsnapshots"} {
		_ = os.MkdirAll(filepath.Join(vols, d), 0o755)
	}
	_ = os.Symlink("/", filepath.Join(vols, "Macintosh HD"))
	got := Destinations("darwin", home, DrivesIn(vols, nil), filepath.Join(vols, "Media", "media"))
	want := []string{"Proton Drive", "Google Drive", "iCloud Drive", "the Backup drive"}
	if len(got) != len(want) {
		t.Fatalf("got %+v", got)
	}
	for i, d := range got {
		if d.Label != want[i] || filepath.Base(d.Path) != FolderName {
			t.Errorf("%d: %+v, want %s", i, d, want[i])
		}
	}
}

func TestDestinationsElsewhere(t *testing.T) {
	home, vols := t.TempDir(), t.TempDir()
	for _, d := range []string{"Dropbox", "OneDrive - Contoso", "OneDrive", "Library/CloudStorage/ProtonDrive-x", "iCloudDrive"} {
		_ = os.MkdirAll(filepath.Join(home, d), 0o755)
	}
	for _, d := range []string{"Backup", "Media/media", "Google/My Drive"} {
		_ = os.MkdirAll(filepath.Join(vols, d), 0o755)
	}
	labels := func(goos string, mounted func(string) bool) []string {
		var out []string
		for _, d := range Destinations(goos, home, DrivesIn(vols, mounted), filepath.Join(vols, "Media", "media")) {
			if filepath.Base(d.Path) != FolderName {
				t.Errorf("%s: %+v", goos, d)
			}
			out = append(out, d.Label)
		}
		return out
	}
	// Linux: no Mac or Windows folders, and only drives that are mounted.
	got := labels("linux", func(p string) bool { return filepath.Base(p) != "Google" })
	want := []string{"Dropbox", "OneDrive", "OneDrive - Contoso", "the Backup drive"}
	if !slices.Equal(got, want) {
		t.Errorf("linux: %q, want %q", got, want)
	}
	// Windows: iCloud Drive, but not Google Drive's own drive.
	got = labels("windows", nil)
	want = []string{"OneDrive", "OneDrive - Contoso", "Dropbox", "iCloud Drive", "the Backup drive"}
	if !slices.Equal(got, want) {
		t.Errorf("windows: %q, want %q", got, want)
	}
}

func TestDriveName(t *testing.T) {
	for in, want := range map[string]string{`D:\`: "D:", "E:": "E:", "/Volumes/Backup": "Backup", "/media/me/Backup": "Backup"} {
		if got := driveName(in); got != want {
			t.Errorf("%s: %s, want %s", in, got, want)
		}
	}
}
