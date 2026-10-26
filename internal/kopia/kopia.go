// Package kopia talks to Kopia's server (the optional second backup engine,
// ADR-0019) for the restore test: the newest snapshot of a folder, a file
// found in it, and that file restored into recovery-staging.
package kopia

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"
)

// Owner and Host are who Kopia's snapshots belong to in the homelab
// (compose/system.yaml: it runs as root, with hostname homelab).
const Owner, Host = "root", "homelab"

// Client is a signed-in Kopia server.
type Client struct {
	Base     string // http://127.0.0.1:51515
	Password string // KOPIA_SERVER_PASSWORD
	HTTP     *http.Client
}

// New is a client for the server at base.
func New(base, password string) *Client {
	return &Client{Base: strings.TrimRight(base, "/"), Password: password, HTTP: &http.Client{Timeout: 30 * time.Second}}
}

func (c *Client) do(ctx context.Context, method, p string, body, out any) error {
	var r io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}
		r = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.Base+"/api/v1/"+p, r)
	if err != nil {
		return err
	}
	req.SetBasicAuth("admin", c.Password)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("Kopia does not answer: %w", err)
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	switch {
	case resp.StatusCode == http.StatusUnauthorized:
		return errors.New("Kopia refused KOPIA_SERVER_PASSWORD")
	case resp.StatusCode >= 300:
		return fmt.Errorf("Kopia: %s %s", resp.Status, strings.TrimSpace(string(data)))
	case out != nil:
		return json.Unmarshal(data, out)
	}
	return nil
}

// Snapshot is one snapshot of a folder.
type Snapshot struct {
	ID        string    `json:"id"`
	RootID    string    `json:"rootID"`
	StartTime time.Time `json:"startTime"`
}

// Latest is the newest snapshot of the folder at source (as Kopia sees it,
// /source/appdata).
func (c *Client) Latest(ctx context.Context, source string) (Snapshot, error) {
	q := url.Values{"userName": {Owner}, "host": {Host}, "path": {source}}
	var r struct {
		Snapshots []Snapshot `json:"snapshots"`
	}
	if err := c.do(ctx, "GET", "snapshots?"+q.Encode(), nil, &r); err != nil {
		return Snapshot{}, err
	}
	var newest Snapshot
	for _, s := range r.Snapshots {
		if s.StartTime.After(newest.StartTime) {
			newest = s
		}
	}
	if newest.RootID == "" {
		return Snapshot{}, fmt.Errorf("Kopia has no snapshot of %s yet", source)
	}
	return newest, nil
}

// Find is the object of the file or folder at rel (slash-separated) under
// the snapshot directory root.
func (c *Client) Find(ctx context.Context, root, rel string) (string, error) {
	obj := root
	for _, name := range strings.Split(path.Clean(rel), "/") {
		var d struct {
			Entries []struct {
				Name string `json:"name"`
				Obj  string `json:"obj"`
			} `json:"entries"`
		}
		if err := c.do(ctx, "GET", "objects/"+url.PathEscape(obj), nil, &d); err != nil {
			return "", err
		}
		next := ""
		for _, e := range d.Entries {
			if e.Name == name {
				next = e.Obj
				break
			}
		}
		if next == "" {
			return "", fmt.Errorf("%s is not in the snapshot", rel)
		}
		obj = next
	}
	return obj, nil
}

// Restore writes the object (a file or a folder, whole) to target, a path
// as Kopia's container sees it (/staging/restore-test/...), and waits for
// it to finish.
func (c *Client) Restore(ctx context.Context, obj, target string, limit time.Duration) error {
	var task struct {
		ID string `json:"id"`
	}
	req := map[string]any{
		"root":     obj,
		"fsOutput": map[string]any{"targetPath": target, "overwriteFiles": true, "overwriteDirectories": true},
		// Folders whole, not placeholders to fill in later.
		"options": map[string]any{"restoreDirEntryAtDepth": 1<<31 - 1},
	}
	if err := c.do(ctx, "POST", "restore", req, &task); err != nil {
		return err
	}
	end := time.Now().Add(limit)
	for {
		var t struct {
			Status       string `json:"status"`
			ErrorMessage string `json:"errorMessage"`
		}
		if err := c.do(ctx, "GET", "tasks/"+url.PathEscape(task.ID), nil, &t); err != nil {
			return err
		}
		switch t.Status {
		case "SUCCESS":
			return nil
		case "FAILED", "CANCELED":
			return fmt.Errorf("Kopia's restore of %s ended %s: %s", target, strings.ToLower(t.Status), t.ErrorMessage)
		}
		if time.Now().After(end) {
			return fmt.Errorf("Kopia's restore of %s did not finish within %s", target, limit)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(time.Second):
		}
	}
}
