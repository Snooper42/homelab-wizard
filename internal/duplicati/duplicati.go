// Package duplicati talks to Duplicati's web API (version 2.1 and later),
// signing in with the web UI password: each backup job's last run, creating
// and running jobs, server-wide options, and test restores.
package duplicati

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"
)

// StaleAfter is how old a job's last good run may be: the weekly jobs plus
// a day of slack.
const StaleAfter = 8 * 24 * time.Hour

// ErrNoPassword means DUPLICATI_PASSWORD is empty.
var ErrNoPassword = errors.New("DUPLICATI_PASSWORD is empty")

// Job is one backup job's last run.
type Job struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	LastFinished time.Time `json:"lastFinished"` // the last run that completed
	LastError    time.Time `json:"lastError,omitempty"`
	ErrorMessage string    `json:"errorMessage,omitempty"`
	Size         string    `json:"size,omitempty"` // what it holds at the destination, e.g. "12.3 GB"
	State        string    `json:"state"`          // ok, failed, stale, or never
	NextRun      time.Time `json:"nextRun"`        // when Duplicati will run it next; zero when not scheduled
}

// Client is a signed-in session with one Duplicati.
type Client struct {
	base  string
	token string
	http  *http.Client
}

// Login signs in at baseURL (http://127.0.0.1:8200) with the web UI password.
func Login(ctx context.Context, baseURL, password string) (*Client, error) {
	if password == "" {
		return nil, ErrNoPassword
	}
	c := &Client{base: strings.TrimRight(baseURL, "/"), http: &http.Client{Timeout: 15 * time.Second}}
	body, _ := json.Marshal(map[string]any{"Password": password, "RememberMe": false})
	var login struct{ AccessToken string }
	if err := c.call(ctx, http.MethodPost, "/api/v1/auth/login", body, &login); err != nil {
		return nil, err
	}
	if login.AccessToken == "" {
		return nil, errors.New("Duplicati did not return an access token")
	}
	c.token = login.AccessToken
	return c, nil
}

// Jobs signs in at baseURL and lists the jobs by name, judging each
// against now.
func Jobs(ctx context.Context, baseURL, password string, now time.Time) ([]Job, error) {
	c, err := Login(ctx, baseURL, password)
	if err != nil {
		return nil, err
	}
	return c.Jobs(ctx, now)
}

// Jobs lists the jobs by name, judging each against now.
func (c *Client) Jobs(ctx context.Context, now time.Time) ([]Job, error) {
	var list []struct {
		Backup struct {
			ID       string
			Name     string
			Metadata map[string]string
		}
	}
	if err := c.call(ctx, http.MethodGet, "/api/v1/backups", nil, &list); err != nil {
		return nil, err
	}
	jobs := make([]Job, 0, len(list))
	for _, item := range list {
		m := item.Backup.Metadata
		j := Job{ID: item.Backup.ID, Name: item.Backup.Name, LastFinished: parse(m["LastBackupFinished"]), LastError: parse(m["LastErrorDate"]), Size: m["TargetSizeString"]}
		switch {
		case !j.LastError.IsZero() && j.LastError.After(j.LastFinished):
			j.State, j.ErrorMessage = "failed", m["LastErrorMessage"]
		case j.LastFinished.IsZero():
			j.State = "never"
		case now.Sub(j.LastFinished) > StaleAfter:
			j.State = "stale"
		default:
			j.State = "ok"
		}
		jobs = append(jobs, j)
	}
	// Best effort: an older server without the proposed schedule still lists the jobs.
	if next, err := c.nextRuns(ctx); err == nil {
		for i := range jobs {
			jobs[i].NextRun = next[jobs[i].ID]
		}
	}
	sort.Slice(jobs, func(a, b int) bool { return jobs[a].Name < jobs[b].Name })
	return jobs, nil
}

// nextRuns is when each job (by ID) runs next: the proposed schedule in
// Duplicati's server state, which its own "Next scheduled task" shows.
func (c *Client) nextRuns(ctx context.Context) (map[string]time.Time, error) {
	var st struct {
		ProposedSchedule []struct {
			Item1 string // the job's ID
			Item2 string // when
		}
	}
	if err := c.call(ctx, http.MethodGet, "/api/v1/serverstate", nil, &st); err != nil {
		return nil, err
	}
	next := map[string]time.Time{}
	for _, p := range st.ProposedSchedule {
		for _, layout := range []string{time.RFC3339Nano, "2006-01-02T15:04:05"} {
			if t, err := time.Parse(layout, p.Item2); err == nil {
				next[p.Item1] = t
				break
			}
		}
	}
	return next, nil
}

// parse reads Duplicati's serialized dates (yyyyMMddTHHmmssZ, in UTC).
func parse(s string) time.Time {
	t, err := time.Parse("20060102T150405Z07:00", s)
	if err != nil {
		return time.Time{}
	}
	return t
}

// Restore restores paths (as Duplicati sees them, e.g. /source/appdata/...)
// from the newest version of the job named job into restorePath (e.g.
// /staging/restore-test), and waits up to wait for it to finish.
func (c *Client) Restore(ctx context.Context, job string, paths []string, restorePath string, wait time.Duration) error {
	jobs, err := c.Jobs(ctx, time.Now())
	if err != nil {
		return err
	}
	id := ""
	for _, j := range jobs {
		if strings.EqualFold(j.Name, job) {
			id = j.ID
		}
	}
	if id == "" {
		return fmt.Errorf("Duplicati has no job named %q (docs/Automation.md lists the jobs)", job)
	}
	body, _ := json.Marshal(map[string]any{"paths": paths, "time": "now", "restore_path": restorePath, "overwrite": true, "permissions": false, "skip_metadata": false})
	var started struct {
		ID     int64
		Status string
	}
	if err := c.call(ctx, http.MethodPost, "/api/v1/backup/"+id+"/restore", body, &started); err != nil {
		return err
	}
	deadline := time.Now().Add(wait)
	for {
		var st struct {
			Status       string
			ErrorMessage string
		}
		if err := c.call(ctx, http.MethodGet, fmt.Sprintf("/api/v1/task/%d", started.ID), nil, &st); err != nil {
			return err
		}
		switch st.Status {
		case "Completed":
			return nil
		case "Failed":
			return fmt.Errorf("Duplicati's restore failed: %s", st.ErrorMessage)
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("the restore was still %s after %s; see Duplicati's log", strings.ToLower(st.Status), wait)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(pollEvery):
		}
	}
}

// pollEvery is how often Restore asks whether the task finished.
var pollEvery = 2 * time.Second

func (c *Client) call(ctx context.Context, method, path string, body []byte, out any) error {
	var rd io.Reader
	if body != nil {
		rd = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.base+path, rd)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("Duplicati is not reachable: %w", err)
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	switch {
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
		return errors.New("Duplicati refused DUPLICATI_PASSWORD")
	case resp.StatusCode == http.StatusNotFound:
		return errors.New("this Duplicati has no /api/v1 (it needs version 2.1 or later)")
	case resp.StatusCode >= 300:
		return fmt.Errorf("Duplicati: %d %s", resp.StatusCode, strings.TrimSpace(string(data[:min(len(data), 200)])))
	}
	if out == nil {
		return nil
	}
	return json.Unmarshal(data, out)
}
