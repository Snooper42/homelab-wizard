package backup

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// RestoreLog records restore tests and reminders, so the nightly backup can
// remind about the monthly restore test until one is done.
type RestoreLog struct {
	LastTest    time.Time `json:"lastTest"`
	LastSummary string    `json:"lastSummary,omitempty"`
	// LastKopiaTest is the last passing test of Kopia, the second engine
	// (ADR-0019); LastTest stays Duplicati's.
	LastKopiaTest time.Time `json:"lastKopiaTest,omitempty"`
	LastReminder  time.Time `json:"lastReminder"`
	// LastKopiaReminder is when Kopia's restore test was last reminded of.
	LastKopiaReminder time.Time `json:"lastKopiaReminder,omitempty"`
	// LastVaultReminder is when the vault-export reminder was last sent.
	LastVaultReminder time.Time `json:"lastVaultReminder,omitempty"`
	// History is the restore tests on record, oldest first: the drills.
	History []RestoreRun `json:"history,omitempty"`
}

// RestoreRun is one restore test: when it started, how long the restore and
// the check took (zero for a restore made by hand), and how it went.
type RestoreRun struct {
	When    time.Time `json:"when"`
	Seconds int       `json:"seconds,omitempty"`
	Passed  bool      `json:"passed"`
	Summary string    `json:"summary"`
	Job     string    `json:"job,omitempty"` // the Duplicati job it restored from
	// Engine is the backup it restored from: "" for Duplicati, "kopia".
	Engine string `json:"engine,omitempty"`
}

// MaxRestoreRuns is how many restore tests the log keeps: two years of
// monthly tests.
const MaxRestoreRuns = 24

// Record adds a restore test to the history; a passing one becomes the
// last test.
func (l *RestoreLog) Record(r RestoreRun) {
	l.History = append(l.History, r)
	if n := len(l.History); n > MaxRestoreRuns {
		l.History = l.History[n-MaxRestoreRuns:]
	}
	switch {
	case r.Passed && r.Engine == "kopia":
		l.LastKopiaTest = r.When
	case r.Passed:
		l.LastTest, l.LastSummary = r.When, r.Summary
	}
}

// LastFailed is the newest test when it failed after the last pass (or with
// none yet): the one to look into.
func (l RestoreLog) LastFailed() (RestoreRun, bool) {
	if n := len(l.History); n > 0 && !l.History[n-1].Passed {
		return l.History[n-1], true
	}
	return RestoreRun{}, false
}

// LastTook is how long the newest passing test with a timing took.
func (l RestoreLog) LastTook() time.Duration {
	for i := len(l.History) - 1; i >= 0; i-- {
		if r := l.History[i]; r.Passed && r.Seconds > 0 {
			return time.Duration(r.Seconds) * time.Second
		}
	}
	return 0
}

// LoadRestoreLog reads the log (empty when there is none yet).
func LoadRestoreLog(path string) RestoreLog {
	var l RestoreLog
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &l)
	}
	return l
}

// Save writes the log.
func (l RestoreLog) Save(path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(l, "", "  ")
	return os.WriteFile(path, data, 0o644)
}

// ReminderDue reports whether to remind about the restore test: none in the
// last 30 days, and no reminder in the last 7.
func (l RestoreLog) ReminderDue(now time.Time) bool {
	return now.Sub(l.LastTest) > 30*24*time.Hour && now.Sub(l.LastReminder) > 7*24*time.Hour
}

// KopiaReminderDue is ReminderDue for Kopia, when it is installed: each
// engine is tested on its own.
func (l RestoreLog) KopiaReminderDue(now time.Time) bool {
	return now.Sub(l.LastKopiaTest) > 30*24*time.Hour && now.Sub(l.LastKopiaReminder) > 7*24*time.Hour
}

// VaultExports looks in dir (recovery-staging/secrets) for Bitwarden vault
// exports: the newest encrypted one, and any plain ones, which hold every
// password readable and must not sit in a backup.
func VaultExports(dir string) (newest time.Time, plain []string) {
	entries, _ := os.ReadDir(dir)
	for _, e := range entries {
		name := strings.ToLower(e.Name())
		if e.IsDir() || !strings.HasPrefix(name, "bitwarden_") || !strings.Contains(name, "export") {
			continue
		}
		if !strings.Contains(name, "encrypted") || !strings.HasSuffix(name, ".json") {
			plain = append(plain, e.Name())
			continue
		}
		if fi, err := e.Info(); err == nil && fi.ModTime().After(newest) {
			newest = fi.ModTime()
		}
	}
	return newest, plain
}

// VaultReminderDue reports whether to remind about exporting the vault: no
// encrypted export in the last 30 days, and no reminder in the last 7.
func (l RestoreLog) VaultReminderDue(newestExport, now time.Time) bool {
	return now.Sub(newestExport) > 30*24*time.Hour && now.Sub(l.LastVaultReminder) > 7*24*time.Hour
}
