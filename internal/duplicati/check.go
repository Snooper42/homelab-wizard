package duplicati

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/lockedfile"
)

// The weekly integrity check (homelab backup-check): Duplicati's own
// Verify of each job's backup, once a week, its result kept in
// data/backup-check.json for Backups and the watchdog.

// CheckPath is where the last checks are kept.
func CheckPath(root string) string { return filepath.Join(root, "data", "backup-check.json") }

// Checks are the last weekly checks.
type Checks struct {
	At   time.Time        `json:"at"`             // the last run, whatever it found
	Jobs map[string]Check `json:"jobs,omitempty"` // by job name
}

// Check is one job's last check.
type Check struct {
	When    time.Time `json:"when"`
	Problem string    `json:"problem,omitempty"` // empty: its files matched
	// Cleared is what the check before found, when this one passed:
	// Duplicati keeps it as the job's last error until its next run.
	Cleared string `json:"cleared,omitempty"`
}

// LoadChecks reads the last checks; none kept (or a record that does not
// read) is none.
func LoadChecks(path string) Checks {
	var c Checks
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &c)
	}
	if c.Jobs == nil {
		c.Jobs = map[string]Check{}
	}
	return c
}

// Save writes the checks whole, under the record's lock.
func (c Checks) Save(path string) error {
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	return lockedfile.Write(path, append(data, '\n'), 0o600)
}

// WithChecks gives each job its last check, for Backups and the watchdog.
// Duplicati keeps a failed check as the job's last error, so a job
// "failed" by the check is a job whose runs are well and whose check
// failed (CheckProblem), and one whose error a later check cleared is well
// again; a run that failed stays failed.
func WithChecks(jobs []Job, c Checks) []Job {
	for i, j := range jobs {
		k, ok := c.Jobs[j.Name]
		if !ok {
			continue
		}
		jobs[i].Checked, jobs[i].CheckProblem = k.When, k.Problem
		if j.State != "failed" || k.When.Before(j.LastError) {
			continue // a run failed after the check: that is what to say
		}
		if msg := ShortProblem(j.ErrorMessage); msg != "" && (msg == k.Problem || msg == k.Cleared) {
			jobs[i].State, jobs[i].ErrorMessage = "ok", ""
		}
	}
	return jobs
}

// ShortProblem is what Duplicati said, without the hashes it adds to a
// mismatch: "Hash mismatch on file "duplicati-….dblock.zip.aes"".
func ShortProblem(s string) string {
	if i := strings.Index(s, ", recorded hash"); i > 0 {
		s = s[:i]
	}
	return strings.TrimSpace(s)
}
