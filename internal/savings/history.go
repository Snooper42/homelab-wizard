package savings

import (
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/lockedfile"
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
// It is changed under the lock beside it and written whole, so Status
// reading it meanwhile never meets half of it.
func Record(path string, now time.Time, annual float64) error {
	day := now.Format("2006-01-02")
	cutoff := now.AddDate(0, 0, -keepDays).Format("2006-01-02")
	return lockedfile.Update(path, 0o600, func(old []byte) ([]byte, bool) {
		var was, pts []Point
		_ = json.Unmarshal(old, &was)
		for _, p := range was {
			if p.Date != day && p.Date >= cutoff {
				pts = append(pts, p)
			}
		}
		pts = append(pts, Point{Date: day, Annual: annual})
		slices.SortFunc(pts, func(a, b Point) int { return strings.Compare(a.Date, b.Date) })
		data, err := json.MarshalIndent(pts, "", "  ")
		return data, err == nil
	})
}
