package backup

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
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

// cloudFolders are the cloud drives macOS keeps in sync, by the folder
// pattern under ~/Library/CloudStorage.
var cloudFolders = []struct{ glob, label string }{
	{"ProtonDrive-*", "Proton Drive"},
	{"GoogleDrive-*", "Google Drive"},
	{"OneDrive-*", "OneDrive"},
	{"Dropbox*", "Dropbox"},
}

// Destinations lists where the backups could go on this machine: the
// cloud drives that sync here, iCloud Drive, and external drives, except
// the one holding the media (mediaRoot), since a backup on the disk it
// protects is no backup. volumes is /Volumes on a Mac.
func Destinations(home, volumes, mediaRoot string) []Destination {
	var out []Destination
	for _, c := range cloudFolders {
		matches, _ := filepath.Glob(filepath.Join(home, "Library", "CloudStorage", c.glob))
		sort.Strings(matches)
		for _, m := range matches {
			if st, err := os.Stat(m); err == nil && st.IsDir() {
				label := c.label
				if len(matches) > 1 {
					label += " (" + filepath.Base(m) + ")"
				}
				out = append(out, Destination{"cloud", label, filepath.Join(m, FolderName)})
			}
		}
	}
	if icloud := filepath.Join(home, "Library", "Mobile Documents", "com~apple~CloudDocs"); isDir(icloud) {
		out = append(out, Destination{"cloud", "iCloud Drive", filepath.Join(icloud, FolderName)})
	}
	entries, _ := os.ReadDir(volumes)
	for _, e := range entries {
		name := e.Name()
		p := filepath.Join(volumes, name)
		if strings.HasPrefix(name, ".") || strings.HasPrefix(name, "com.apple.") || e.Type()&os.ModeSymlink != 0 || !isDir(p) {
			continue // the system disk appears as a link to /
		}
		if mediaRoot != "" && (p == mediaRoot || strings.HasPrefix(mediaRoot, p+string(filepath.Separator))) {
			continue
		}
		out = append(out, Destination{"drive", "the " + name + " drive", filepath.Join(p, FolderName)})
	}
	return out
}

func isDir(p string) bool {
	st, err := os.Stat(p)
	return err == nil && st.IsDir()
}
