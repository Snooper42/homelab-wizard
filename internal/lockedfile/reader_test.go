package lockedfile

import (
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
)

// A save outlasts a reader that opens the file again and again (the agent
// and the app read .env and the records all the time): on Windows each
// rename over the open file fails for that moment, and Write tries again
// in the gaps. Off Windows a rename never waits for a reader.
func TestWriteOutlastsAReaderOpeningItAgainAndAgain(t *testing.T) {
	path := filepath.Join(t.TempDir(), "record.json")
	if err := Write(path, []byte(`{"n":0}`), 0o600); err != nil {
		t.Fatal(err)
	}
	var stop atomic.Bool
	var wg sync.WaitGroup
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for !stop.Load() {
				_, _ = os.ReadFile(path)
			}
		}()
	}
	defer func() { stop.Store(true); wg.Wait() }()
	for i := range 300 {
		if err := Write(path, []byte(`{"n":1}`), 0o600); err != nil {
			t.Fatalf("save %d: %v", i, err)
		}
	}
}
