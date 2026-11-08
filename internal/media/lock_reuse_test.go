package media

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// A job cut off (the computer restarted or slept in the middle of the
// nightly scrub, the app quit) leaves its lock, and the process ID in it is
// later given to another program. That program is alive, but it is not the
// job: it started after the lock was written. The lock is stale and taken
// over, so the automation and every job do not wait for it forever.
func TestALockWhoseIDWasReusedIsStale(t *testing.T) {
	root := t.TempDir()
	me := os.Getpid()
	began, ok := started(me)
	if !ok {
		t.Skip("this system does not say when a process started")
	}
	write := func(at time.Time) {
		data, _ := json.Marshal(Lock{PID: me, Kind: "scrubber", Action: "scan", Start: at})
		if err := os.WriteFile(LockPath(root), data, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.MkdirAll(filepath.Dir(LockPath(root)), 0o755); err != nil {
		t.Fatal(err)
	}
	// Written an hour before this process started: not this process's lock.
	write(began.Add(-time.Hour))
	if Held(root) {
		t.Fatal("a lock from before its process started is held")
	}
	stale, err := Acquire(root, "music", "lyrics", "")
	if err != nil || stale == nil || stale.Kind != "scrubber" {
		t.Fatalf("not taken over: %v %v", stale, err)
	}
	_ = Release(root)
	// Written after this process started: it may well be this job's.
	write(time.Now())
	if !Held(root) {
		t.Error("a live job's lock is not held")
	}
	if _, err := Acquire(root, "music", "lyrics", ""); !errors.Is(err, ErrBusy) {
		t.Errorf("a live job's lock was taken: %v", err)
	}
}
