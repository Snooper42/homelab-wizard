package lockedfile

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"
)

// Writers at the same moment each keep their change, and the file is
// replaced whole with its mode.
func TestUpdateKeepsEveryChange(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data", "rec.txt")
	var wg sync.WaitGroup
	for i := range 40 {
		wg.Go(func() {
			if err := Update(path, 0o600, func(old []byte) ([]byte, bool) {
				return append(old, fmt.Sprintf("line %02d\n", i)...), true
			}); err != nil {
				t.Error(err)
			}
		})
	}
	wg.Wait()
	data, _ := os.ReadFile(path)
	if n := strings.Count(string(data), "\n"); n != 40 {
		t.Errorf("%d of 40 changes kept", n)
	}
	if fi, err := os.Stat(path); err != nil || (runtime.GOOS != "windows" && fi.Mode().Perm() != 0o600) {
		t.Errorf("mode: %v %v", fi.Mode().Perm(), err)
	}
	if _, err := os.Stat(path + ".lock"); !os.IsNotExist(err) {
		t.Errorf("the lock was left: %v", err)
	}
	if left, _ := filepath.Glob(path + ".tmp*"); len(left) > 0 {
		t.Errorf("left behind: %v", left)
	}
}

// A change of nothing writes nothing; nil removes the file.
func TestUpdateWritesOnlyWhenAsked(t *testing.T) {
	path := filepath.Join(t.TempDir(), "rec")
	if err := Update(path, 0o600, func([]byte) ([]byte, bool) { return []byte("x"), false }); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Errorf("written though not asked: %v", err)
	}
	if err := Update(path, 0o600, func([]byte) ([]byte, bool) { return []byte("x"), true }); err != nil {
		t.Fatal(err)
	}
	if err := Update(path, 0o600, func([]byte) ([]byte, bool) { return nil, true }); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Errorf("not removed: %v", err)
	}
	if err := Update(path, 0o600, func([]byte) ([]byte, bool) { return nil, true }); err != nil {
		t.Errorf("removing what is not there: %v", err)
	}
}

// A lock another writer holds makes Update wait, then say so; one left by
// a writer that died is taken over.
func TestUpdateWaitsForTheLock(t *testing.T) {
	was, wasStale := Wait, Stale
	Wait = 50 * time.Millisecond
	t.Cleanup(func() { Wait, Stale = was, wasStale })
	path := filepath.Join(t.TempDir(), "rec")
	if err := os.WriteFile(path+".lock", nil, 0o600); err != nil {
		t.Fatal(err)
	}
	called := false
	err := Update(path, 0o600, func([]byte) ([]byte, bool) { called = true; return []byte("x"), true })
	if err == nil || !strings.Contains(err.Error(), "try again") || called {
		t.Errorf("with the lock held: %v, changed %v", err, called)
	}
	old := time.Now().Add(-time.Hour)
	_ = os.Chtimes(path+".lock", old, old)
	if err := Update(path, 0o600, func([]byte) ([]byte, bool) { return []byte("x"), true }); err != nil {
		t.Errorf("a stale lock: %v", err)
	}
}

// Where the file cannot be read, locked, or written, Update and Write say
// why and leave no file of their own.
func TestUpdateFailsPlainly(t *testing.T) {
	was := Wait
	Wait = 50 * time.Millisecond
	t.Cleanup(func() { Wait = was })
	dir := t.TempDir()
	file := filepath.Join(dir, "file")
	if err := os.WriteFile(file, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	ok := func([]byte) ([]byte, bool) { return []byte("x"), true }
	if err := Update(filepath.Join(file, "rec"), 0o600, ok); err == nil {
		t.Error("updated under a file")
	}
	// The record's place is a folder: reading it fails.
	path := filepath.Join(dir, "rec")
	if err := os.MkdirAll(filepath.Join(path, "x"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := Update(path, 0o600, ok); err == nil {
		t.Error("read a folder")
	}
	if err := Update(path, 0o600, func([]byte) ([]byte, bool) { return nil, true }); err == nil {
		t.Error("removed a folder that is not empty")
	}
	if err := Write(path, []byte("x"), 0o600); err == nil {
		t.Error("wrote over a folder")
	}
	if left, _ := filepath.Glob(path + ".tmp*"); len(left) > 0 {
		t.Errorf("left behind: %v", left)
	}
	if err := Write(filepath.Join(file, "rec"), []byte("x"), 0o600); err == nil {
		t.Error("wrote under a file")
	}
	// The lock's place is a folder: busy until it is stale, then not removable.
	other := filepath.Join(dir, "other")
	if err := os.MkdirAll(filepath.Join(other+".lock", "x"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := Update(other, 0o600, ok); err == nil {
		t.Error("updated without its lock")
	}
}
