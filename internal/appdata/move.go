package appdata

// Moving the apps' data (quality-loop D3 part 2, the owner's yes of Nov 26): Copy puts every file, folder and link
// in a new place with its mode, time and (where the system allows) its owner; Check reads each file in both places
// before anything points at the copy; the move's record keeps the old folder's place until the person removes it.

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/lockedfile"
)

// within says whether p is dir or inside it.
func within(dir, p string) bool {
	rel, err := filepath.Rel(dir, p)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)) && !filepath.IsAbs(rel)
}

// Copy copies the folder from into to, which must not exist yet or be empty, and not overlap from. progress, when
// given, hears the files and bytes copied so far. It returns the files and bytes copied; on an error the partial copy
// is left for the caller to remove.
func Copy(from, to string, progress func(files int, bytes int64)) (int, int64, error) {
	from, to = filepath.Clean(from), filepath.Clean(to)
	if within(from, to) || within(to, from) {
		return 0, 0, fmt.Errorf("%s and %s overlap: choose a folder outside the apps' data, and not around it", to, from)
	}
	if entries, err := os.ReadDir(to); err == nil && len(entries) > 0 {
		return 0, 0, fmt.Errorf("%s isn't empty: choose a new or empty folder", to)
	}
	fi, err := os.Stat(from)
	if err != nil {
		return 0, 0, err
	}
	if err := os.MkdirAll(to, fi.Mode().Perm()); err != nil {
		return 0, 0, err
	}
	var files int
	var size int64
	type dirTime struct {
		path string
		at   time.Time
	}
	var dirs []dirTime
	err = filepath.WalkDir(from, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(from, p)
		dst := filepath.Join(to, rel)
		info, err := os.Lstat(p)
		if err != nil {
			return err
		}
		switch mode := info.Mode(); {
		case mode.IsDir():
			if err := os.MkdirAll(dst, mode.Perm()); err != nil {
				return err
			}
			os.Chmod(dst, mode.Perm())
			keepOwner(dst, info)
			dirs = append(dirs, dirTime{dst, info.ModTime()})
		case mode&os.ModeSymlink != 0:
			target, err := os.Readlink(p)
			if err != nil {
				return err
			}
			// #nosec G122 -- the apps are stopped while their folder is copied, and a link is copied as a link, never followed
			if err := os.Symlink(target, dst); err != nil {
				return err
			}
			keepOwner(dst, info)
		case mode.IsRegular():
			n, err := copyFile(p, dst, mode.Perm())
			if err != nil {
				return fmt.Errorf("copying %s: %w", rel, err)
			}
			os.Chtimes(dst, info.ModTime(), info.ModTime())
			keepOwner(dst, info)
			files++
			size += n
			if progress != nil {
				progress(files, size)
			}
		default:
			// A socket or a pipe an app made while running: it makes it again at its start.
		}
		return nil
	})
	if err != nil {
		return files, size, err
	}
	// Folders' times last: a file written inside one changes it.
	for i := len(dirs) - 1; i >= 0; i-- {
		os.Chtimes(dirs[i].path, dirs[i].at, dirs[i].at)
	}
	return files, size, nil
}

func copyFile(src, dst string, perm os.FileMode) (int64, error) {
	in, err := os.Open(src)
	if err != nil {
		return 0, err
	}
	defer in.Close()
	out, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_EXCL, perm)
	if err != nil {
		return 0, err
	}
	n, err := io.Copy(out, in)
	if err == nil {
		err = out.Sync()
	}
	if cerr := out.Close(); err == nil {
		err = cerr
	}
	os.Chmod(dst, perm)
	return n, err
}

func sum(p string) ([]byte, error) {
	f, err := os.Open(p)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return nil, err
	}
	return h.Sum(nil), nil
}

// Check reads every file under from and its copy under to, and says the first that differs (missing, another size,
// other content, a link to somewhere else), else how many files it read.
func Check(from, to string) (int, error) {
	var n int
	err := filepath.WalkDir(from, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(from, p)
		dst := filepath.Join(to, rel)
		a, err := os.Lstat(p)
		if err != nil {
			return err
		}
		b, err := os.Lstat(dst)
		if err != nil {
			return fmt.Errorf("%s isn't in the copy", rel)
		}
		switch {
		case a.IsDir():
			if !b.IsDir() {
				return fmt.Errorf("%s isn't a folder in the copy", rel)
			}
		case a.Mode()&os.ModeSymlink != 0:
			x, _ := os.Readlink(p)
			y, err := os.Readlink(dst)
			if err != nil || x != y {
				return fmt.Errorf("%s points somewhere else in the copy", rel)
			}
		case a.Mode().IsRegular():
			if !b.Mode().IsRegular() || a.Size() != b.Size() {
				return fmt.Errorf("%s differs in the copy (%d bytes, not %d)", rel, b.Size(), a.Size())
			}
			x, err := sum(p)
			if err != nil {
				return err
			}
			y, err := sum(dst)
			if err != nil {
				return err
			}
			if !bytes.Equal(x, y) {
				return fmt.Errorf("%s differs in the copy", rel)
			}
			n++
		}
		return nil
	})
	return n, err
}

// Size is the files under dir and their bytes, as Copy would copy them.
func Size(dir string) (int, int64, error) {
	var n int
	var size int64
	err := filepath.WalkDir(dir, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.Type().IsRegular() {
			if info, err := d.Info(); err == nil {
				n++
				size += info.Size()
			}
		}
		return nil
	})
	return n, size, err
}

// Move is the last move's record (data/appdata-move.json): the copy not in use (Old) kept until the person removes
// it, the one the apps use (New), and APPDATA_ROOT as it was before (Was; empty for unset), for Undo.
type Move struct {
	Old   string    `json:"old"`
	New   string    `json:"new"`
	Was   string    `json:"was"`
	At    time.Time `json:"at"`
	Files int       `json:"files"`
	Bytes int64     `json:"bytes"`
}

// MovePath is where the record lives.
func MovePath(root string) string { return filepath.Join(root, "data", "appdata-move.json") }

// LoadMove reads the record; false when there's none (no move, or its old copy was removed).
func LoadMove(root string) (Move, bool) {
	var m Move
	data, err := os.ReadFile(MovePath(root))
	if err != nil || json.Unmarshal(data, &m) != nil || m.Old == "" {
		return Move{}, false
	}
	return m, true
}

// SaveMove keeps the record, written whole.
func SaveMove(root string, m Move) error {
	if err := os.MkdirAll(filepath.Dir(MovePath(root)), 0o755); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(m, "", "  ")
	return lockedfile.Write(MovePath(root), append(data, '\n'), 0o644)
}

// ForgetMove drops the record once the old copy is gone.
func ForgetMove(root string) error {
	if err := os.Remove(MovePath(root)); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}
