// Package lockedfile changes a small record that several homelab
// processes write at once (the awake job, the watchdog, homelab start, a
// phone): it reads, changes, and saves it under a lock beside it, so no
// change is lost to another made at the same moment, and saves it whole
// (a new file renamed in), so a reader never meets half a file. It is
// what internal/stopped does for data/stopped.json (N10), for any record.
package lockedfile

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"syscall"
	"time"
)

// Wait is how long Update waits for another writer; a lock older than
// Stale was left by a writer that died, and is taken over. A writer holds
// it only to read, change, and write a few lines.
var (
	Wait  = 5 * time.Second
	Stale = 30 * time.Second
	// RenameWait is how long Write keeps trying to rename its file in on
	// Windows, where a rename over a file another process has open fails
	// for that moment: readers that open it again and again (the agent,
	// the app) leave only short gaps between them.
	RenameWait = 2 * time.Second
)

// Update reads the file at path (nil when there is none) and passes it to
// change, holding the lock beside it throughout; when change says write,
// what it returns is saved whole with mode, and nil removes the file.
func Update(path string, mode os.FileMode, change func(old []byte) (data []byte, write bool)) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	unlock, err := lock(path + ".lock")
	if err != nil {
		return err
	}
	defer unlock()
	old, err := os.ReadFile(path)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	data, write := change(old)
	if !write {
		return nil
	}
	if data == nil {
		if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
		return nil
	}
	return Write(path, data, mode)
}

func lock(name string) (func(), error) {
	deadline := time.Now().Add(Wait)
	for {
		f, err := os.OpenFile(name, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
		if err == nil {
			_ = f.Close()
			return func() { _ = os.Remove(name) }, nil
		}
		// Windows says "access is denied" for a lock another writer is
		// removing at that moment: it is busy, as one that is there.
		if !os.IsExist(err) && !os.IsPermission(err) {
			return nil, err
		}
		if fi, serr := os.Stat(name); serr == nil && time.Since(fi.ModTime()) > Stale {
			_ = os.Remove(name)
			continue
		}
		if time.Now().After(deadline) {
			return nil, fmt.Errorf("another homelab is changing %s: try again", filepath.Base(name[:len(name)-len(".lock")]))
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// Write saves data at path whole: a new file beside it, renamed in, so a
// reader at that moment reads the old file or the new one, never half.
func Write(path string, data []byte, mode os.FileMode) error {
	f, err := os.CreateTemp(filepath.Dir(path), filepath.Base(path)+".tmp*")
	if err != nil {
		return err
	}
	tmp := f.Name()
	_, werr := f.Write(data)
	if cerr := f.Close(); werr == nil {
		werr = cerr
	}
	if werr == nil {
		werr = os.Chmod(tmp, mode)
	}
	// On Windows a rename over a file another process is reading fails
	// for that moment: try again, in the gaps between its reads, for up to
	// RenameWait.
	if werr == nil {
		deadline := time.Now().Add(RenameWait)
		for {
			// Windows says "access is denied" for a file open elsewhere;
			// any other failure is final.
			if werr = os.Rename(tmp, path); werr == nil || !os.IsPermission(werr) || time.Now().After(deadline) {
				break
			}
			time.Sleep(2 * time.Millisecond)
		}
	}
	if werr != nil {
		_ = os.Remove(tmp)
	}
	return werr
}

// Read reads a record Write saves. On Windows an open at the very moment
// another process renames the file in fails ("access is denied", or "in
// use by another process"): Read tries again for up to RenameWait, so a
// save never reads as no record at all. Any other failure, and every
// failure off Windows, is returned at once.
func Read(path string) ([]byte, error) {
	deadline := time.Now().Add(RenameWait)
	for {
		data, err := readFile(path)
		if err == nil || !busy(err) || time.Now().After(deadline) {
			return data, err
		}
		time.Sleep(2 * time.Millisecond)
	}
}

// errSharingViolation is Windows' ERROR_SHARING_VIOLATION, which Go does
// not count as a permission error.
const errSharingViolation = syscall.Errno(32)

// onWindows and readFile are what tests change, to try Read's Windows
// path anywhere.
var (
	onWindows = runtime.GOOS == "windows"
	readFile  = os.ReadFile
)

func busy(err error) bool {
	if !onWindows {
		return false
	}
	var errno syscall.Errno
	return os.IsPermission(err) || (errors.As(err, &errno) && errno == errSharingViolation)
}
