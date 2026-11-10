package media

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/proc"
)

// Lock is homelab.media.lock: one media job at a time moves files. Video
// transcodes are not under it (Tdarr's own queue paces them); only the
// moment their results are moved into the libraries is.
type Lock struct {
	PID    int       `json:"pid"`
	Kind   string    `json:"kind"`
	Action string    `json:"action"`
	Start  time.Time `json:"start"`
	// Log is the job's event log, for the app to follow a job it did not start.
	Log string `json:"log,omitempty"`
	// Flags are the ones the job ran with that the screen may send again
	// (--apply, --tidy), so one that stopped part-way carries on as itself.
	// Always written, if only as []: nil is a lock from before they were
	// kept, which can't say.
	Flags []string `json:"flags"`
}

// LockPath is where the lock lives.
func LockPath(root string) string { return filepath.Join(root, "data", "homelab.media.lock") }

// ErrBusy is returned when another media job holds the lock.
var ErrBusy = errors.New("another Tidy Up job is moving files")

// alive and started are this machine's processes (internal/proc); tests
// replace them.
var (
	alive   = proc.Alive
	started = proc.Started
)

// holds reports whether pid still runs as the job that wrote a lock at
// start: a process that started after the lock was written is another
// program given the same ID later (proc.Process.Holds).
func holds(pid int, start time.Time) bool {
	return proc.Process{Alive: alive, Started: started}.Holds(pid, start)
}

// ReadLock is the lock as written, and whether its process still runs. No
// lock is a zero Lock and false.
func ReadLock(root string) (Lock, bool) {
	var l Lock
	data, err := os.ReadFile(LockPath(root))
	if err != nil {
		return l, false
	}
	if json.Unmarshal(data, &l) != nil {
		return Lock{}, false
	}
	return l, holds(l.PID, l.Start)
}

// Held reports whether a running media job holds the lock: the nightly
// updates, Duplicati, and up read it.
func Held(root string) bool {
	_, ok := ReadLock(root)
	return ok
}

// Acquire takes the lock for this process. A lock whose process is gone
// (a crash, a restart mid-job) is stale: it is taken over, and stale
// reports the job it held, which the engines resume when run again. flags
// are the job's own, kept with it (Lock.Flags).
func Acquire(root, kind, action, log string, flags ...string) (stale *Lock, err error) {
	path := LockPath(root)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	me := Lock{PID: os.Getpid(), Kind: kind, Action: action, Start: time.Now().UTC(), Log: log, Flags: append([]string{}, flags...)}
	data, _ := json.Marshal(me)
	for range 2 {
		f, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
		if err == nil {
			_, werr := f.Write(data)
			cerr := f.Close()
			return stale, errors.Join(werr, cerr)
		}
		if !errors.Is(err, os.ErrExist) {
			return nil, err
		}
		held, running := ReadLock(root)
		if running {
			return nil, fmt.Errorf("%w: %s %s since %s", ErrBusy, held.Kind, held.Action, held.Start.Local().Format("15:04"))
		}
		if held.PID > 0 {
			stale = &held
		}
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return nil, err
		}
	}
	return nil, fmt.Errorf("%w: the lock changed hands while it was taken", ErrBusy)
}

// Release gives the lock back, when it is this process's.
func Release(root string) error {
	l, _ := ReadLock(root)
	if l.PID != os.Getpid() {
		return nil
	}
	if err := os.Remove(LockPath(root)); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
