package savings

import (
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"testing"
	"time"
)

// Each day's point is written whole, so Status reading the history while
// the nightly backup records never meets half of it, and points recorded
// at once are all kept.
func TestRecordIsWholeAndLosesNoPoint(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data", "savings-history.json")
	day := time.Date(2026, 11, 5, 3, 0, 0, 0, time.UTC)
	var wg sync.WaitGroup
	for i := range 10 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := Record(path, day.AddDate(0, 0, -i), float64(100+i)); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	if pts := LoadHistory(path); len(pts) != 10 {
		t.Fatalf("%d of 10 days kept: %+v", len(pts), pts)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" && info.Mode().Perm() != 0o600 {
		t.Errorf("the history is %v, want 0600", info.Mode().Perm())
	}
	if left, _ := filepath.Glob(path + ".tmp*"); len(left) != 0 {
		t.Errorf("left behind: %v", left)
	}
}
