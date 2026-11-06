package main

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// The agent's note of when it last backed up and updated is replaced whole:
// a reader at that moment (another agent, one just starting after sleep)
// reads the old note or the new one, never half of one, which would read
// as no backup yet and start one at once.
func TestAgentStateIsReplacedWhole(t *testing.T) {
	path := filepath.Join(t.TempDir(), "agent.json")
	at := time.Date(2026, 11, 6, 2, 0, 0, 0, time.UTC)
	if err := saveAgentState(path, agentState{LastBackup: at, LastUpdate: at}); err != nil {
		t.Fatal(err)
	}
	var stop atomic.Bool
	var half atomic.Value
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for !stop.Load() {
			if s := loadAgentState(path); s.LastBackup.IsZero() {
				data, _ := os.ReadFile(path)
				half.Store(string(data))
				return
			}
		}
	}()
	for i := range 300 {
		if err := saveAgentState(path, agentState{LastBackup: at.Add(time.Duration(i) * time.Minute), LastUpdate: at}); err != nil {
			t.Fatal(err)
		}
	}
	stop.Store(true)
	wg.Wait()
	if v := half.Load(); v != nil {
		t.Errorf("a reader found half a note (%d bytes): it reads as no backup yet", len(v.(string)))
	}
}

// Two processes rotating one job's log at once (two agents for a moment,
// as one hands over to the next) each finish: neither trips on a temporary
// file the other renamed away.
func TestJobLogSplitsAtOnceAllFinish(t *testing.T) {
	dir := t.TempDir()
	path, older := filepath.Join(dir, "watchdog.log"), filepath.Join(dir, "watchdog.1.log")
	if err := os.WriteFile(path, []byte(strings.Repeat("watchdog: 47 checks passed\n", 4000)), 0o600); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	errs := make(chan error, 20)
	for range 20 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			errs <- splitLog(path, older)
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
}
