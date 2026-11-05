package health

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"testing"
	"time"
)

// Two watchdog runs at once (the agent's and one from a terminal), or one
// and homelab remove forgetting an app, each change the state under its
// lock: none is saved over, and it is written whole, this account's alone.
func TestUpdateStateLosesNoChange(t *testing.T) {
	path := StatePath(t.TempDir())
	now := time.Now()
	var wg sync.WaitGroup
	for i := range 20 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			err := UpdateState(path, func(s *State) {
				s.Failing[fmt.Sprintf("app%02d", i)] = now
			})
			if err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	if got := LoadState(path).Failing; len(got) != 20 {
		t.Fatalf("%d of 20 kept: %v", len(got), got)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" && info.Mode().Perm() != 0o600 {
		t.Errorf("the watchdog's state is %v, want 0600", info.Mode().Perm())
	}
	if left, _ := filepath.Glob(path + ".tmp*"); len(left) != 0 {
		t.Errorf("left behind: %v", left)
	}
	// Save, as homelab remove uses it, writes it whole and private too.
	s := LoadState(path)
	s.Forget("app00")
	if err := s.Save(path); err != nil {
		t.Fatal(err)
	}
	if info, _ := os.Stat(path); runtime.GOOS != "windows" && info.Mode().Perm() != 0o600 {
		t.Errorf("after Save: %v", info.Mode().Perm())
	}
}
