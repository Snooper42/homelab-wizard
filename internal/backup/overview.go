package backup

import (
	"os"
	"path/filepath"
	"strings"
	"time"
)

// StaleAfter is how old the newest copy may be before it counts as stale:
// a nightly job plus two hours of slack, as the watchdog uses.
const StaleAfter = 26 * time.Hour

// Source is something the nightly backup copies: an app's database dump,
// or a named volume's archive.
type Source struct {
	ID     string // the app, or the volume
	Name   string // what a person calls it
	Volume bool
}

// Copy is one source's newest copy in recovery-staging.
type Copy struct {
	ID     string    `json:"id"`
	Name   string    `json:"name"`
	Volume bool      `json:"volume,omitempty"`
	Newest time.Time `json:"newest"` // zero when there is none yet
	Size   int64     `json:"size"`
	Count  int       `json:"count"`
	State  string    `json:"state"` // fresh, stale, or none
}

// Overview is the state of the backups, read from the files the nightly
// job leaves in recovery-staging and from the restore-test log.
type Overview struct {
	Destination     string     `json:"destination"`
	DestinationOK   bool       `json:"destinationOK"` // a folder other than the local default
	LastRun         time.Time  `json:"lastRun"`       // the newest file the backup wrote
	EnvCopied       time.Time  `json:"envCopied"`     // the .env copy
	Copies          []Copy     `json:"copies"`
	Stale           int        `json:"stale"`
	RestoreTest     RestoreLog `json:"restoreTest"`
	RestoreDue      bool       `json:"restoreDue"` // none in the last 30 days
	StaleAfterHours int        `json:"staleAfterHours"`
	// The newest encrypted Bitwarden export in recovery-staging/secrets,
	// whether one is due, and plain exports that should be deleted.
	VaultExport  time.Time `json:"vaultExport"`
	VaultDue     bool      `json:"vaultDue"`
	PlainExports []string  `json:"plainExports,omitempty"`
}

// Read builds the overview for the homelab at root.
func Read(root string, sources []Source, env map[string]string, now time.Time) Overview {
	o := Overview{Destination: env["BACKUP_DESTINATION"], StaleAfterHours: int(StaleAfter.Hours())}
	if dest := o.Destination; dest != "" && dest != "./backups" {
		if st, err := os.Stat(resolve(root, dest)); err == nil && st.IsDir() {
			o.DestinationOK = true
		}
	}
	staging := filepath.Join(root, "recovery-staging")
	if fi, err := os.Stat(filepath.Join(staging, "secrets", "homelab.env")); err == nil {
		o.EnvCopied = fi.ModTime()
		o.LastRun = o.EnvCopied
	}
	for _, s := range sources {
		c := Copy{ID: s.ID, Name: s.Name, Volume: s.Volume, State: "none"}
		dir := filepath.Join(staging, "databases", s.ID)
		if s.Volume {
			dir = filepath.Join(staging, "volumes", s.ID)
		}
		files, _ := filepath.Glob(filepath.Join(dir, s.ID+"-*"))
		for _, f := range files {
			fi, err := os.Stat(f)
			if err != nil || fi.IsDir() || strings.HasSuffix(f, ".partial") {
				continue
			}
			c.Count++
			if fi.ModTime().After(c.Newest) {
				c.Newest, c.Size = fi.ModTime(), fi.Size()
			}
		}
		if !c.Newest.IsZero() {
			c.State = "fresh"
			if now.Sub(c.Newest) > StaleAfter {
				c.State = "stale"
				o.Stale++
			}
			if c.Newest.After(o.LastRun) {
				o.LastRun = c.Newest
			}
		}
		o.Copies = append(o.Copies, c)
	}
	o.VaultExport, o.PlainExports = VaultExports(filepath.Join(staging, "secrets"))
	o.VaultDue = now.Sub(o.VaultExport) > 30*24*time.Hour
	o.RestoreTest = LoadRestoreLog(filepath.Join(root, "scripts", "logs", "restore-test.json"))
	o.RestoreDue = now.Sub(o.RestoreTest.LastTest) > 30*24*time.Hour
	return o
}

func resolve(root, p string) string {
	if strings.HasPrefix(p, "~/") {
		home, _ := os.UserHomeDir()
		return filepath.Join(home, p[2:])
	}
	if !filepath.IsAbs(p) {
		return filepath.Join(root, p)
	}
	return p
}
