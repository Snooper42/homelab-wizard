package backup

import (
	"os"
	"path/filepath"
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
	got := Destinations(home, vols, filepath.Join(vols, "Media", "media"))
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
