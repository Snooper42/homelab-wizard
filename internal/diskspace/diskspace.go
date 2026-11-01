// Package diskspace reads the free space on each disk the homelab writes
// to, so a filling disk is noticed before databases, downloads, or the
// container runtime stop working.
package diskspace

import (
	"cmp"
	"fmt"
	"os"
	"os/user"
	"path"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"unicode"
)

// Location is a folder the homelab writes to, by what it holds ("homelab
// folder", "photos").
type Location struct {
	Name string
	Path string
}

// Volume is one disk, the locations on it, and its space in bytes.
type Volume struct {
	Names []string
	Path  string // the first location's folder
	Free  uint64
	Total uint64
}

// Threshold is the free space below which a disk counts as low: 5% of it,
// at least 10 GB (the runtime and databases need room to work) and at most
// 50 GB (5% of a large media drive is plenty).
func Threshold(total uint64) uint64 {
	const gb = 1 << 30
	return min(max(total/20, 10*gb), 50*gb)
}

// Advice is what usually frees space on a homelab disk.
const Advice = "unused images (docker image prune -a), finished downloads, and Immich's trash are the usual places to free some"

// AdviceWithImages is Advice when the engine's unused images hold unused
// (a size such as "12.3GB").
func AdviceWithImages(unused string) string {
	return "docker image prune -a would free " + unused + " of unused images; finished downloads and Immich's trash are the other usual places"
}

// Low reports whether the disk is under its threshold.
func (v Volume) Low() bool { return v.Free < Threshold(v.Total) }

// Label names the disk by its locations: "homelab folder, backups".
func (v Volume) Label() string { return strings.Join(v.Names, ", ") }

// Describe is "412 GB free of 994 GB (41%)".
func (v Volume) Describe() string {
	pct := 0
	if v.Total > 0 {
		pct = int(v.Free * 100 / v.Total) // #nosec G115 -- a percentage, 0 to 100
	}
	return fmt.Sprintf("%s free of %s (%d%%)", Size(v.Free), Size(v.Total), pct)
}

// Size is a byte count for people: "8.4 GB", "1.2 TB".
func Size(b uint64) string {
	const gb = 1 << 30
	switch {
	case b >= 1<<40:
		return fmt.Sprintf("%.1f TB", float64(b)/(1<<40))
	case b >= 10*gb:
		return fmt.Sprintf("%d GB", b/gb)
	}
	return fmt.Sprintf("%.1f GB", float64(b)/gb)
}

// Check reads the disks under the locations that exist, one Volume per
// disk in the order first seen. A location that is missing (a drive not
// plugged in) is skipped: other checks say so.
func Check(locations []Location) []Volume {
	var vols []Volume
	index := map[string]int{}
	for _, l := range locations {
		if l.Path == "" {
			continue
		}
		if fi, err := os.Stat(l.Path); err != nil || !fi.IsDir() {
			continue
		}
		id := volumeID(l.Path)
		if i, ok := index[id]; ok {
			if !contains(vols[i].Names, l.Name) {
				vols[i].Names = append(vols[i].Names, l.Name)
			}
			continue
		}
		free, total, err := usage(l.Path)
		if err != nil || total == 0 {
			continue
		}
		index[id] = len(vols)
		vols = append(vols, Volume{Names: []string{l.Name}, Path: l.Path, Free: free, Total: total})
	}
	return vols
}

// Lowest sorts the disks with the least free space first.
func Lowest(vols []Volume) []Volume {
	out := append([]Volume(nil), vols...)
	sort.SliceStable(out, func(a, b int) bool { return out[a].Free < out[b].Free })
	return out
}

func contains(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}

// Settings are the .env folders the homelab writes to besides its own, and
// what each holds, in the order their disks are listed.
var Settings = []struct{ Key, Name string }{
	{"IMMICH_UPLOAD_LOCATION", "photos"},
	{"MEDIA_ROOT", "media"},
	{"DOWNLOADS_ROOT", "downloads"},
	{"BACKUP_DESTINATION", "backups"},
	{"JELLYFIN_DATA_DIR", "Jellyfin data"},
	{"SYNC_ROOT", "Syncthing"},
}

// Locations is the homelab folder and each folder setting, resolved as the
// compose files do: ~/ from home, a relative path from the homelab folder.
func Locations(root, home string, env map[string]string) []Location {
	locs := []Location{{"homelab folder", root}}
	for _, s := range Settings {
		p := env[s.Key]
		switch {
		case p == "":
			continue
		case strings.HasPrefix(p, "~/"):
			p = filepath.Join(home, p[2:])
		case !filepath.IsAbs(p):
			p = filepath.Join(root, p)
		}
		locs = append(locs, Location{s.Name, p})
	}
	return locs
}

// ExternalDrive is the external drive a path is on: a macOS volume
// ("/Volumes/Hobbies"), a Linux drive mounted by the desktop
// ("/media/you/Hobbies", "/run/media/you/Hobbies") or by hand
// ("/mnt/hobbies"), or a Windows drive other than the system's ("E:\");
// "" for one on the internal disk.
func ExternalDrive(path string) string {
	name := ""
	if u, err := user.Current(); err == nil {
		name = u.Username
	}
	return externalDrive(path, name, cmp.Or(os.Getenv("SystemDrive"), "C:"))
}

func externalDrive(p, user, systemDrive string) string {
	if len(p) >= 2 && p[1] == ':' && unicode.IsLetter(rune(p[0])) {
		drive := strings.ToUpper(p[:2])
		if drive == strings.ToUpper(systemDrive) {
			return ""
		}
		return drive + `\`
	}
	p = path.Clean(filepath.ToSlash(p))
	parts := strings.Split(strings.TrimPrefix(p, "/"), "/")
	at := func(n int) string {
		if len(parts) < n {
			return ""
		}
		return "/" + strings.Join(parts[:n], "/")
	}
	switch {
	case len(parts) >= 2 && parts[0] == "Volumes":
		return at(2)
	case len(parts) >= 4 && parts[0] == "run" && parts[1] == "media":
		return at(4)
	case len(parts) >= 3 && parts[0] == "media" && parts[1] == user:
		return at(3)
	case len(parts) >= 2 && parts[0] == "media":
		return at(2)
	case len(parts) >= 2 && parts[0] == "mnt" && len(parts[1]) > 1:
		return at(2)
	}
	return ""
}

// Mounted reports whether drive (from ExternalDrive) is there. On Linux an
// empty mount point stays when its drive is unplugged, so it must also be
// on a different device from its folder.
func Mounted(drive string) bool {
	if _, err := os.Stat(drive); err != nil {
		return false
	}
	if runtime.GOOS != "linux" {
		return true
	}
	return volumeID(drive) != volumeID(filepath.Dir(drive))
}

// DriveRoot reports whether path is the top of a drive: a drive letter, a
// mount point, or the system's root.
func DriveRoot(path string) bool {
	path = filepath.Clean(path)
	return filepath.Dir(path) == path || volumeID(path) != volumeID(filepath.Dir(path))
}

// MissingDrive is the first external drive among paths that is not
// mounted ("/Volumes/Hobbies"), or "".
func MissingDrive(paths []string) string {
	for _, p := range paths {
		if d := ExternalDrive(p); d != "" && !Mounted(d) {
			return d
		}
	}
	return ""
}
