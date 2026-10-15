package savings

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

// Point is the yearly saving on one day.
type Point struct {
	Date   string  `json:"date"` // YYYY-MM-DD
	Annual float64 `json:"annual"`
}

// keepDays bounds the history: a year and a bit.
const keepDays = 400

// HistoryPath is where the nightly backup records the savings.
func HistoryPath(root string) string { return filepath.Join(root, "data", "savings-history.json") }

// LoadHistory reads the recorded points, oldest first (none when there is
// no file yet).
func LoadHistory(path string) []Point {
	var pts []Point
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &pts)
	}
	return pts
}

// Record sets now's point to annual (replacing one already recorded today)
// and drops points older than keepDays.
func Record(path string, now time.Time, annual float64) error {
	day := now.Format("2006-01-02")
	cutoff := now.AddDate(0, 0, -keepDays).Format("2006-01-02")
	var pts []Point
	for _, p := range LoadHistory(path) {
		if p.Date != day && p.Date >= cutoff {
			pts = append(pts, p)
		}
	}
	pts = append(pts, Point{Date: day, Annual: annual})
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(pts, "", "  ")
	return os.WriteFile(path, data, 0o644)
}
