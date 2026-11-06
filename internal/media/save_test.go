package media

import (
	"encoding/json"
	"os"
	"sync"
	"testing"
	"time"
)

// Tidy Up's record is saved by each job as it ends, and by the agent's
// timetable: saves at once each write a file of their own, so none fails
// on another's half-written one and the record always reads.
func TestRecordSavesAtOnce(t *testing.T) {
	root := t.TempDir()
	var wg sync.WaitGroup
	errs := make(chan error, 40)
	for i := range 40 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r := Record{LastScrub: time.Unix(int64(i), 0).UTC()}
			errs <- r.Save(root)
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatalf("a save failed: %v", err)
		}
	}
	data, err := os.ReadFile(RecordPath(root))
	if err != nil || !json.Valid(data) {
		t.Fatalf("the record: %v %q", err, data)
	}
}
