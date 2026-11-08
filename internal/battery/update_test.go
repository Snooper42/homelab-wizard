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

// An app left running on battery to finish its work (Tdarr's video), with
// the workers held from it, keeps the record even with nothing paused;
// Finished and GaveBack take them off, and with nothing left the record goes.
// A record from before these fields loads as it was.
func TestFinishingAndHeld(t *testing.T) {
	path := Path(t.TempDir())
	at := time.Date(2026, 11, 8, 13, 0, 0, 0, time.UTC)
	if err := Finish(path, []string{"tdarr"}, map[string]int{"n1/transcodecpu": 2}); err != nil {
		t.Fatal(err)
	}
	if s := Load(path); !slices.Equal(s.Finishing, []string{"tdarr"}) || s.Held["n1/transcodecpu"] != 2 || len(s.Paused) != 0 {
		t.Fatalf("finishing: %+v", s)
	}
	if err := Pause(path, []string{"sonarr"}, at); err != nil {
		t.Fatal(err)
	}
	if err := Finished(path, []string{"tdarr"}); err != nil {
		t.Fatal(err)
	}
	if err := Pause(path, []string{"tdarr"}, at.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if s := Load(path); len(s.Finishing) != 0 || !slices.Equal(s.Paused, []string{"sonarr", "tdarr"}) || s.Held["n1/transcodecpu"] != 2 || !s.Since.Equal(at) {
		t.Fatalf("after it finished: %+v", s)
	}
	if err := Resume(path, []string{"sonarr", "tdarr"}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("workers still held, yet the record went: %v", err)
	}
	if err := GaveBack(path); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Errorf("nothing left, yet the record stayed: %v", err)
	}
	if err := (State{Finishing: []string{"tdarr"}}).Save(path); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Errorf("Save dropped a finishing app: %v", err)
	}

	old := Path(t.TempDir())
	if err := os.MkdirAll(filepath.Dir(old), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(old, []byte(`{"paused":["sonarr"],"since":"2026-11-05T09:00:00Z"}`+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if s := Load(old); !slices.Equal(s.Paused, []string{"sonarr"}) || s.Finishing != nil || s.Held != nil {
		t.Errorf("an older record: %+v", s)
	}
}
