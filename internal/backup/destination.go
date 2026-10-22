package backup

import (
	"cmp"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/diskspace"
)

// FolderName is the folder made for the backups inside a cloud drive.
const FolderName = "Homelab Backups"

// ProtonDrive lists the Proton Drive folders macOS keeps in sync for the
// user (~/Library/CloudStorage/ProtonDrive-<account>-folder).
func ProtonDrive(home string) []string {
	matches, _ := filepath.Glob(filepath.Join(home, "Library", "CloudStorage", "ProtonDrive-*"))
	var out []string
	for _, m := range matches {
		if st, err := os.Stat(m); err == nil && st.IsDir() {
			out = append(out, m)
		}
	}
	sort.Strings(out)
	return out
}

// Destination is a place the backups can go, found on this machine.
type Destination struct {
	Kind  string `json:"kind"`  // cloud or drive
	Label string `json:"label"` // "Proton Drive", "iCloud Drive", "the Backup drive"
	Path  string `json:"path"`  // the folder to make inside it
}

// cloudFolders are the folders each system's cloud drive apps keep in sync,
// by pattern under the home folder: ~/Library/CloudStorage on a Mac, the
// home folder itself elsewhere.
var cloudFolders = map[string][]struct{ glob, label string }{
	"darwin": {
		{"Library/CloudStorage/ProtonDrive-*", "Proton Drive"},
		{"Library/CloudStorage/GoogleDrive-*", "Google Drive"},
		{"Library/CloudStorage/OneDrive-*", "OneDrive"},
		{"Library/CloudStorage/Dropbox*", "Dropbox"},
		{"Library/Mobile Documents/com~apple~CloudDocs", "iCloud Drive"},
	},
	"windows": {
		{"OneDrive*", "OneDrive"},
		{"Dropbox*", "Dropbox"},
		{"iCloudDrive", "iCloud Drive"},
	},
	"linux": {
		{"Dropbox*", "Dropbox"},
		{"OneDrive*", "OneDrive"},
	},
}

// Destinations lists where the backups could go on this machine: the
// cloud drives that sync here, and the external drives (from Drives),
// except the one holding the media (mediaRoot), since a backup on the disk
// it protects is no backup.
func Destinations(goos, home string, drives []string, mediaRoot string) []Destination {
	var out []Destination
	for _, c := range cloudFolders[goos] {
		matches, _ := filepath.Glob(filepath.Join(home, filepath.FromSlash(c.glob)))
		sort.Strings(matches)
		for _, m := range matches {
			if isDir(m) {
				label := c.label
				if base := filepath.Base(m); len(matches) > 1 && strings.HasPrefix(base, c.label) {
					label = base // "OneDrive - Contoso"
				} else if len(matches) > 1 {
					label += " (" + base + ")"
				}
				out = append(out, Destination{"cloud", label, filepath.Join(m, FolderName)})
			}
		}
	}
	for _, d := range drives {
		if mediaRoot != "" && within(mediaRoot, d) {
			continue
		}
		if goos == "windows" && isDir(filepath.Join(d, "My Drive")) {
			continue // Google Drive's own drive, which Docker Desktop's WSL 2 does not see
		}
		out = append(out, Destination{"drive", "the " + driveName(d) + " drive", filepath.Join(d, FolderName)})
	}
	return out
}

// Drives lists the external drives plugged in now: in /Volumes on a Mac
// (not the system disk, which appears as a link to /), mounted in
// /run/media/<you> or /media/<you> on Linux, and the drive letters but
// the system's on Windows.
func Drives(goos, home string) []string {
	switch goos {
	case "darwin":
		return DrivesIn("/Volumes", nil)
	case "linux":
		user := filepath.Base(home)
		return append(DrivesIn(filepath.Join("/run/media", user), diskspace.Mounted), DrivesIn(filepath.Join("/media", user), diskspace.Mounted)...)
	case "windows":
		system := strings.ToUpper(cmp.Or(os.Getenv("SystemDrive"), "C:"))
		var out []string
		for l := 'D'; l <= 'Z'; l++ {
			d := string(l) + ":"
			if d != system && isDir(d+`\`) {
				out = append(out, d+`\`)
			}
		}
		return out
	}
	return nil
}

// DrivesIn lists the drives in dir, a folder each drive appears in; with
// mounted, only those it reports as mounted.
func DrivesIn(dir string, mounted func(string) bool) []string {
	entries, _ := os.ReadDir(dir)
	var out []string
	for _, e := range entries {
		name, p := e.Name(), filepath.Join(dir, e.Name())
		if strings.HasPrefix(name, ".") || strings.HasPrefix(name, "com.apple.") || e.Type()&os.ModeSymlink != 0 || !isDir(p) {
			continue
		}
		if mounted == nil || mounted(p) {
			out = append(out, p)
		}
	}
	return out
}

// driveName is how a drive is called: its folder's name, or its letter.
func driveName(d string) string {
	if len(d) >= 2 && d[1] == ':' && len(strings.Trim(d[2:], `\/`)) == 0 {
		return d[:2]
	}
	return filepath.Base(d)
}

// within reports whether path is drive or inside it.
func within(path, drive string) bool {
	rel, err := filepath.Rel(drive, path)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

func isDir(p string) bool {
	st, err := os.Stat(p)
	return err == nil && st.IsDir()
}
