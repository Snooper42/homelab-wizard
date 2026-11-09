package diskspace

import (
	"cmp"
	"os"
	"os/user"
	"path"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
)

// Drive is a disk the media libraries could live on: this computer's own,
// or one plugged in (a USB drive, a second internal disk on Windows).
type Drive struct {
	// Path is its top: "/Volumes/Hobbies", "/media/you/Hobbies", `E:\`;
	// "/" or `C:\` for this computer's own.
	Path string
	// Name is what the system calls it ("Hobbies"); "" for this computer's own.
	Name     string
	Internal bool
	Free     uint64
	Total    uint64
}

// Drives is this computer's own disk, then every external drive mounted,
// by name, each with its space. One whose space can't be read (a drive
// going to sleep, a share that stopped answering) is left out.
func Drives() []Drive {
	name := ""
	if u, err := user.Current(); err == nil {
		name = u.Username
	}
	system, tops := places(runtime.GOOS, name, cmp.Or(os.Getenv("SystemDrive"), "C:"), subfolders)
	return drives(system, tops, Mounted, usage, volumeID)
}

// places is where each system mounts drives: the system's own disk, and
// the folders a drive plugged in shows up as (macOS's /Volumes, a Linux
// desktop's /media/<user> and /run/media/<user>, /mnt, Windows' letters).
func places(goos, user, systemDrive string, sub func(string) []string) (system string, tops []string) {
	switch goos {
	case "darwin":
		return "/", sub("/Volumes")
	case "linux":
		tops = append(sub(path.Join("/media", user)), sub(path.Join("/run/media", user))...)
		return "/", append(tops, sub("/mnt")...)
	case "windows":
		for c := 'A'; c <= 'Z'; c++ {
			tops = append(tops, string(c)+`:\`)
		}
		return strings.ToUpper(systemDrive) + `\`, tops
	}
	return "/", nil
}

// drives keeps the system's disk and each top that is a drive of its own
// (mounted, and not the system's disk under another name, as macOS lists
// "Macintosh HD" in /Volumes).
func drives(system string, tops []string, mounted func(string) bool, space func(string) (uint64, uint64, error), device func(string) string) []Drive {
	var out []Drive
	if free, total, err := space(system); err == nil && total > 0 {
		out = append(out, Drive{Path: system, Internal: true, Free: free, Total: total})
	}
	seen := map[string]bool{device(system): true}
	var ext []Drive
	for _, t := range tops {
		if strings.HasPrefix(filepath.Base(t), ".") || !mounted(t) {
			continue
		}
		id := device(t)
		if seen[id] {
			continue
		}
		free, total, err := space(t)
		if err != nil || total == 0 {
			continue
		}
		seen[id] = true
		name := filepath.Base(filepath.Clean(t))
		if len(t) <= 3 && strings.HasSuffix(t, `:\`) {
			name = strings.TrimSuffix(t, `\`)
		}
		ext = append(ext, Drive{Path: t, Name: name, Free: free, Total: total})
	}
	sort.SliceStable(ext, func(a, b int) bool { return strings.ToLower(ext[a].Name) < strings.ToLower(ext[b].Name) })
	return append(out, ext...)
}

// subfolders are the folders directly in dir, not links to elsewhere.
func subfolders(dir string) []string {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var out []string
	for _, e := range entries {
		if e.IsDir() && e.Type()&os.ModeSymlink == 0 {
			out = append(out, filepath.Join(dir, e.Name()))
		}
	}
	return out
}
