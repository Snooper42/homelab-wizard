package battery

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"sync"
	"testing"
	"time"
)

// The watchdog and the awake job each run the battery saver: what one
// paused is never saved over by the other, the record is written whole
// (a reader never meets half of it) and is this account's alone, and it
// goes when nothing is paused.
func TestUpdateLosesNoChange(t *testing.T) {
	path := Path(t.TempDir())
	var wg sync.WaitGroup
	for i := range 20 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			err := Update(path, func(s *State) bool {
				s.Paused = append(s.Paused, fmt.Sprintf("app%02d", i))
				return true
			})
			if err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	if got := Load(path).Paused; len(got) != 20 {
		t.Fatalf("%d of 20 kept: %v", len(got), got)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" && info.Mode().Perm() != 0o600 {
		t.Errorf("battery.json is %v, want 0600", info.Mode().Perm())
	}
	if left, _ := filepath.Glob(path + ".tmp*"); len(left) != 0 {
		t.Errorf("left behind: %v", left)
	}
	// Nothing paused: the record goes.
	if err := Update(path, func(s *State) bool { s.Paused = nil; return true }); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Errorf("an empty record stayed: %v", err)
	}
	// A change of nothing writes nothing.
	if err := Update(path, func(*State) bool { return false }); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Errorf("a change of nothing wrote the record: %v", err)
	}
}

// Pause and Resume change only the apps they name: one paused or started
// by the other run meanwhile stays as that run left it.
func TestPauseAndResumeKeepTheOthers(t *testing.T) {
	path := Path(t.TempDir())
	at := time.Date(2026, 11, 5, 9, 0, 0, 0, time.UTC)
	if err := Pause(path, []string{"immich-machine-learning"}, at); err != nil {
		t.Fatal(err)
	}
	if err := Pause(path, []string{"frigate", "immich-machine-learning"}, at.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if s := Load(path); !slices.Equal(s.Paused, []string{"frigate", "immich-machine-learning"}) || !s.Since.Equal(at) {
		t.Errorf("after two pauses: %+v", s)
	}
	if err := Resume(path, []string{"frigate"}); err != nil {
		t.Fatal(err)
	}
	if s := Load(path); !slices.Equal(s.Paused, []string{"immich-machine-learning"}) {
		t.Errorf("after resuming one: %+v", s)
	}
	if err := Resume(path, []string{"immich-machine-learning"}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Errorf("nothing paused, yet the record stayed: %v", err)
	}
}
