package backup

import (
	"encoding/json"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/lockedfile"
)

// Night is one nightly backup's result for each app it had to copy (quality-loop Q4 (a), Backups' fourteen nights):
// copied, failed, stopped (installed but not running, so not copied), outside (runs outside the homelab), or none (no
// database yet).
type Night struct {
	Date string            `json:"date"` // YYYY-MM-DD, the night's day
	Apps map[string]string `json:"apps"`
}

// The results a night records.
const (
	NightCopied  = "copied"
	NightFailed  = "failed"
	NightStopped = "stopped"
	NightOutside = "outside"
	NightNone    = "none"
)

// NightsKept is how many nights are kept.
const NightsKept = 14

// NightsPath is where the nightly backup keeps them.
func NightsPath(root string) string { return filepath.Join(root, "data", "backup-nights.json") }

// LoadNights reads the nights kept, oldest first; none when there is no file yet or it can't be read.
func LoadNights(path string) []Night {
	var nights []Night
	if data, err := lockedfile.Read(path); err == nil {
		_ = json.Unmarshal(data, &nights)
	}
	return nights
}

// RecordNight sets now's night to apps (replacing one already recorded that day, as a second run the same night
// does) and keeps the newest NightsKept. It is changed under the lock beside it and written whole.
func RecordNight(path string, now time.Time, apps map[string]string) error {
	day := now.Format("2006-01-02")
	return lockedfile.Update(path, 0o600, func(old []byte) ([]byte, bool) {
		var was []Night
		_ = json.Unmarshal(old, &was)
		nights := slices.DeleteFunc(was, func(n Night) bool { return n.Date == day })
		nights = append(nights, Night{Date: day, Apps: apps})
		slices.SortFunc(nights, func(a, b Night) int { return strings.Compare(a.Date, b.Date) })
		if len(nights) > NightsKept {
			nights = nights[len(nights)-NightsKept:]
		}
		data, err := json.MarshalIndent(nights, "", "  ")
		return data, err == nil
	})
}

// worse is the result a night keeps for an app with more than one copy (its database and a volume): a failure over
// a copy, as one part not copied is the app not backed up.
func worse(a, b string) string {
	rank := map[string]int{"": 0, NightNone: 1, NightCopied: 2, NightStopped: 3, NightOutside: 3, NightFailed: 4}
	if rank[b] > rank[a] {
		return b
	}
	return a
}

// NightResults gathers a night's results, an app's worst part kept.
type NightResults map[string]string

// Set records part of app's night.
func (r NightResults) Set(app, result string) { r[app] = worse(r[app], result) }
