package duplicati

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"
)

// SmartRetention is the retention Duplicati's UI calls smart: one version
// a day for a week, one a week for four weeks, one a month for a year.
const SmartRetention = "1W:1D,4W:1W,12M:1M"

// NewJob is a backup job to create: AES-encrypted, zip-compressed, with
// smart retention, on a schedule.
type NewJob struct {
	Name        string
	Description string
	Sources     []string // folders as Duplicati sees them, ending in /
	Exclude     []string // folders to leave out, ending in /
	Target      string   // e.g. file:///destination/secrets
	Passphrase  string
	Every       string    // how often: 1D or 1W
	First       time.Time // the first scheduled run; later runs keep its time of day
}

// Create adds the job and returns its ID. Duplicati refuses a name that
// is already taken.
func (c *Client) Create(ctx context.Context, j NewJob) (string, error) {
	if j.Passphrase == "" {
		return "", errors.New("a backup job needs an encryption passphrase")
	}
	type setting struct{ Name, Value string }
	type filter struct {
		Order      int
		Include    bool
		Expression string
	}
	filters := make([]filter, 0, len(j.Exclude))
	for i, x := range j.Exclude {
		filters = append(filters, filter{Order: i, Include: false, Expression: x})
	}
	body, _ := json.Marshal(map[string]any{
		"Backup": map[string]any{
			"Name":        j.Name,
			"Description": j.Description,
			"Tags":        []string{"homelab"},
			"TargetURL":   j.Target,
			"Sources":     j.Sources,
			"Filters":     filters,
			"Settings": []setting{
				{"encryption-module", "aes"},
				{"compression-module", "zip"},
				{"dblock-size", "50mb"},
				{"passphrase", j.Passphrase},
				{"retention-policy", SmartRetention},
			},
		},
		"Schedule": map[string]any{
			"Repeat": j.Every,
			"Time":   j.First.UTC().Format(time.RFC3339),
		},
	})
	var created struct{ ID string }
	if err := c.call(ctx, http.MethodPost, "/api/v1/backups", body, &created); err != nil {
		return "", err
	}
	if created.ID == "" {
		return "", errors.New("Duplicati did not return the new job's ID")
	}
	return created.ID, nil
}

// Run queues a job's backup now.
func (c *Client) Run(ctx context.Context, id string) error {
	return c.call(ctx, http.MethodPost, "/api/v1/backup/"+id+"/run", nil, nil)
}

// Repair queues a rebuild of a job's local database from the backup at its
// destination: what a job made on a new machine needs before it can back
// up into a folder that already holds that job's backup.
func (c *Client) Repair(ctx context.Context, id string) error {
	return c.call(ctx, http.MethodPost, "/api/v1/backup/"+id+"/repair", []byte("{}"), nil)
}

// HasBackup says whether folder (on this machine) already holds Duplicati
// backup files.
func HasBackup(folder string) bool {
	entries, err := os.ReadDir(folder)
	if err != nil {
		return false
	}
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), "duplicati-") {
			return true
		}
	}
	return false
}

// SetOptions sets server-wide options that every job uses (Settings ›
// Default options in the UI), such as send-http-url. Keys are given
// without the leading dashes.
func (c *Client) SetOptions(ctx context.Context, opts map[string]string) error {
	values := map[string]string{}
	for k, v := range opts {
		values["--"+strings.TrimLeft(k, "-")] = v
	}
	body, _ := json.Marshal(values)
	return c.call(ctx, http.MethodPatch, "/api/v1/serversettings", body, nil)
}

// List names what is in a folder as Duplicati sees it (e.g. /destination),
// to check a mount from its side.
func (c *Client) List(ctx context.Context, folder string) ([]string, error) {
	body, _ := json.Marshal(map[string]string{"path": strings.TrimRight(folder, "/") + "/"})
	var nodes []struct{ Text string }
	if err := c.call(ctx, http.MethodPost, "/api/v1/filesystem?showHidden=true", body, &nodes); err != nil {
		return nil, err
	}
	names := make([]string, 0, len(nodes))
	for _, n := range nodes {
		names = append(names, strings.TrimRight(n.Text, "/"))
	}
	return names, nil
}
