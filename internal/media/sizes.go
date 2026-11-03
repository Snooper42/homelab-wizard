package media

import (
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Each library's size on disk, for Tidy Up's "On the drive" card. Walking a
// few terabytes takes minutes on a USB drive, so sizes are measured in the
// background, one library at a time, and kept in ~/.homelab-media/sizes.json:
// the screen shows the last measure at once and the next read has the new one.

// LibrarySize is a library's size as last measured.
type LibrarySize struct {
	Bytes int64     `json:"bytes"`
	At    time.Time `json:"at"`
}

// SizesPath is where the measures are kept, beside the engines' own records.
func SizesPath(home string) string { return filepath.Join(home, ".homelab-media", "sizes.json") }

// LoadSizes reads the measures; none (or a damaged file) is none.
func LoadSizes(home string) map[string]LibrarySize {
	out := map[string]LibrarySize{}
	if data, err := os.ReadFile(SizesPath(home)); err == nil {
		_ = json.Unmarshal(data, &out)
	}
	return out
}

func saveSizes(home string, sizes map[string]LibrarySize) error {
	p := SizesPath(home)
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(sizes, "", " ")
	if err != nil {
		return err
	}
	tmp := p + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, p)
}

// skipDir is a folder a library's size leaves out: the engines' working
// folders and the system's own (a Trash, Spotlight, the Recycle Bin), as the
// engines' scans do.
func skipDir(name string) bool {
	switch name {
	case "$RECYCLE.BIN", "System Volume Information", "@eaDir", "lost+found":
		return true
	}
	return strings.HasPrefix(name, ".")
}

// MeasureFolder adds up the files under dir. Links are not followed (a
// linked folder's files are counted where they are), and a folder that can't
// be read is skipped rather than failing the whole measure.
func MeasureFolder(dir string) (int64, error) {
	if _, err := os.Stat(dir); err != nil {
		return 0, err
	}
	var total int64
	err := filepath.WalkDir(dir, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			if d != nil && d.IsDir() && p != dir {
				return fs.SkipDir
			}
			return nil
		}
		if d.IsDir() {
			if p != dir && skipDir(d.Name()) {
				return fs.SkipDir
			}
			return nil
		}
		if !d.Type().IsRegular() {
			return nil
		}
		if info, err := d.Info(); err == nil {
			total += info.Size()
		}
		return nil
	})
	return total, err
}

var sizing sync.Mutex

// RefreshSizes measures, in the background, each library whose measure is
// older than maxAge (or missing), and keeps the new measures. One refresh runs
// at a time: a second call while one runs does nothing. A library that isn't
// there (its drive unplugged) keeps its last measure.
func RefreshSizes(home string, folders map[string]string, maxAge time.Duration, now func() time.Time) bool {
	have := LoadSizes(home)
	var stale []string
	for kind, dir := range folders {
		if dir == "" {
			continue
		}
		if s, ok := have[kind]; !ok || now().Sub(s.At) > maxAge {
			stale = append(stale, kind)
		}
	}
	if len(stale) == 0 || !sizing.TryLock() {
		return false
	}
	go func() {
		defer sizing.Unlock()
		measureInto(home, folders, stale, now)
	}()
	return true
}

func measureInto(home string, folders map[string]string, kinds []string, now func() time.Time) {
	for _, kind := range kinds {
		n, err := MeasureFolder(folders[kind])
		if err != nil {
			continue
		}
		sizes := LoadSizes(home)
		sizes[kind] = LibrarySize{Bytes: n, At: now()}
		_ = saveSizes(home, sizes)
	}
}
