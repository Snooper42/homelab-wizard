package backup

import (
	"os"
	"path/filepath"
	"testing"
)

// A backup folder in a cloud drive is on every machine signed in to it:
// uninstall must never delete it there (it would sync), however the drive
// is mounted.
func TestInCloudDrive(t *testing.T) {
	home := t.TempDir()
	proton := filepath.Join(home, "Library", "CloudStorage", "ProtonDrive-anna@example.com")
	if err := os.MkdirAll(proton, 0o755); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		goos, path, want string
	}{
		{"darwin", filepath.Join(proton, "Homelab Backups"), "Proton Drive"},
		{"windows", `C:\Users\andre\Proton Drive\andre\My files\Homelab Backups`, "Proton Drive"},
		{"windows", `G:\My Drive\Homelab Backups`, "My Drive"},
		{"windows", `C:\Users\andre\OneDrive - Contoso\Homelab Backups`, "OneDrive"},
		{"linux", "/home/anna/Dropbox/Homelab Backups", "Dropbox"},
		{"windows", `D:\Homelab Backups`, ""},
		{"darwin", "/Volumes/Backup/Homelab Backups", ""},
		{"linux", "/home/anna/Homelab/backups-kopia", ""},
		{"linux", "/home/anna/Syncthing/Homelab Backups", ""},
		{"darwin", "", ""},
	} {
		if got := InCloudDrive(tc.goos, home, tc.path); got != tc.want {
			t.Errorf("%s %q: %q, want %q", tc.goos, tc.path, got, tc.want)
		}
	}
}
