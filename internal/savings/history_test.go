package savings

import (
	"path/filepath"
	"testing"
	"time"
)

func TestHistory(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data", "savings-history.json")
	if len(LoadHistory(path)) != 0 {
		t.Fatal("no file means no points")
	}
	day := time.Date(2026, 10, 10, 4, 30, 0, 0, time.UTC)
	for i, v := range []float64{3000, 3100, 3200} {
		if err := Record(path, day.AddDate(0, 0, i), v); err != nil {
			t.Fatal(err)
		}
	}
	if err := Record(path, day.AddDate(0, 0, 2).Add(time.Hour), 3292); err != nil { // the same day again
		t.Fatal(err)
	}
	pts := LoadHistory(path)
	if len(pts) != 3 || pts[0].Date != "2026-10-10" || pts[2].Annual != 3292 {
		t.Fatalf("points: %+v", pts)
	}
	if err := Record(path, day.AddDate(0, 0, keepDays+1), 3300); err != nil {
		t.Fatal(err)
	}
	if pts := LoadHistory(path); len(pts) != 3 || pts[0].Date != "2026-10-11" {
		t.Fatalf("old points should go: %+v", pts)
	}
}
