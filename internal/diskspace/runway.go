package diskspace

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"time"
)

// A disk that fills up stops Docker and can leave the apps' databases
// (PostgreSQL, SQLite) damaged mid-write. Low says so once a disk is under
// its threshold; the runway says so weeks before, from how fast its free
// space has been going (the owner, Nov 27, 2026: plain-English disk-full
// runway warnings, nothing more kept).

// Sample is one disk's free space on one day.
type Sample struct {
	Day   string `json:"day"` // 2006-01-02, local
	Free  uint64 `json:"free"`
	Total uint64 `json:"total"`
}

// History is each disk's daily samples, by its first location's name
// ("homelab folder", "media"), oldest first.
type History map[string][]Sample

// HistoryPath is the history in the homelab folder.
func HistoryPath(root string) string { return filepath.Join(root, "data", "disk-history.json") }

// KeepDays is how many days of samples are kept: enough for the trend.
const KeepDays = 60

// LoadHistory reads path; a missing or broken file is an empty history,
// as the trend only starts later.
func LoadHistory(path string) History {
	h := History{}
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &h)
	}
	return h
}

// Record keeps today's free space for each disk (the last reading of the
// day replaces an earlier one) and drops samples older than KeepDays. It is
// written to a new file and renamed in, so a reader never sees half of it.
func Record(path string, vols []Volume, now time.Time) error {
	h := LoadHistory(path)
	day := now.Format(time.DateOnly)
	oldest := now.AddDate(0, 0, -KeepDays).Format(time.DateOnly)
	for _, v := range vols {
		if len(v.Names) == 0 || v.Total == 0 {
			continue
		}
		key := v.Names[0]
		var kept []Sample
		for _, s := range h[key] {
			if s.Day != day && s.Day >= oldest {
				kept = append(kept, s)
			}
		}
		kept = append(kept, Sample{Day: day, Free: v.Free, Total: v.Total})
		sort.Slice(kept, func(i, j int) bool { return kept[i].Day < kept[j].Day })
		h[key] = kept
	}
	data, err := json.Marshal(h)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".disk-history-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}

// The trend reads the last TrendDays, and needs samples on at least
// MinSamples days spanning MinSpan days, so one big download is not taken
// for a habit.
const (
	TrendDays  = 21
	MinSamples = 4
	MinSpan    = 6
)

// Runway is how many days are left until the disk is full at the rate its
// free space went down over the last TrendDays (a least-squares line
// through the samples), and the rate in bytes a day. ok is false when there
// are too few samples, or the disk is not filling.
func Runway(samples []Sample, now time.Time) (days, perDay float64, ok bool) {
	since := now.AddDate(0, 0, -TrendDays).Format(time.DateOnly)
	var xs, ys []float64
	var first time.Time
	for _, s := range samples {
		if s.Day < since {
			continue
		}
		t, err := time.ParseInLocation(time.DateOnly, s.Day, now.Location())
		if err != nil {
			continue
		}
		if first.IsZero() {
			first = t
		}
		xs = append(xs, t.Sub(first).Hours()/24)
		ys = append(ys, float64(s.Free))
	}
	if len(xs) < MinSamples || xs[len(xs)-1] < MinSpan {
		return 0, 0, false
	}
	var mx, my float64
	for i := range xs {
		mx += xs[i]
		my += ys[i]
	}
	mx /= float64(len(xs))
	my /= float64(len(ys))
	var num, den float64
	for i := range xs {
		num += (xs[i] - mx) * (ys[i] - my)
		den += (xs[i] - mx) * (xs[i] - mx)
	}
	if den == 0 {
		return 0, 0, false
	}
	slope := num / den // bytes a day; negative while filling
	if slope >= 0 {
		return 0, 0, false
	}
	free := ys[len(ys)-1]
	return free / -slope, -slope, true
}

// RunwayWarnDays is how close a full disk is before the watchdog alerts;
// doctor says so from RunwayNoteDays.
const (
	RunwayWarnDays = 14
	RunwayNoteDays = 30
)

// RunwayWords is the plain-English warning: which disk, how fast, when it
// is full, and why that matters.
func RunwayWords(label string, days, perDay float64, now time.Time) string {
	when := now.Add(time.Duration(days * 24 * float64(time.Hour)))
	d := int(math.Round(days))
	span := fmt.Sprintf("about %d days", d)
	if d <= 1 {
		span = "about a day"
	}
	return fmt.Sprintf("the disk with %s is filling by about %s a day: at that rate it is full in %s (around %s). A full disk stops the apps and can damage their databases; free some space before then", label, Size(uint64(perDay)), span, when.Format("Mon Jan 2"))
}
