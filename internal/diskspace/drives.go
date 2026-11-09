package diskspace

import (
	"cmp"
	"os"
	"os/user"
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
	var tops []string
	switch runtime.GOOS {
	case "darwin":
		tops = subfolders("/Volumes")
	case "linux":
		tops = append(subfolders(filepath.Join("/media", name)), subfolders(filepath.Join("/run/media", name))...)
		tops = append(tops, subfolders("/mnt")...)
	case "windows":
		for c := 'A'; c <= 'Z'; c++ {
			tops = append(tops, string(c)+`:\`)
		}
	}
	system := "/"
	if runtime.GOOS == "windows" {
		system = strings.ToUpper(cmp.Or(os.Getenv("SystemDrive"), "C:")) + `\`
	}
	return drives(system, tops, Mounted, usage, volumeID)
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
