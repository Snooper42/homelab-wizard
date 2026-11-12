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
	"regexp"
	"strings"
	"sync"
	"time"
)

// Owner and Host are who Kopia's snapshots belong to in the homelab,
// whoever runs it (config/kopia/start.sh).
const Owner, Host = "homelab", "homelab"

// Client is a signed-in Kopia server.
//
// Kopia's page and its API check each call against a session (N49, item
// 112): the page carries a token (`<meta name="kopia-csrf-token">`) made
// for its session cookie, and every call to the API sends both, so a web
// page elsewhere can't post to Kopia with the household's password their
// browser keeps. The client signs in as the page does: it reads `/` once,
// keeps the cookie and the token, and reads them again when Kopia, started
// again since, no longer knows them.
type Client struct {
	Base     string // http://127.0.0.1:51515
	Password string // KOPIA_SERVER_PASSWORD
	HTTP     *http.Client

	mu      sync.Mutex
	session string // Kopia-Session-Cookie
	token   string // its X-Kopia-Csrf-Token
}

// New is a client for the server at base.
func New(base, password string) *Client {
	return &Client{Base: strings.TrimRight(base, "/"), Password: password, HTTP: &http.Client{Timeout: 30 * time.Second}}
}

// The names Kopia gives its session and token (internal/server, apiclient).
const (
	SessionCookie = "Kopia-Session-Cookie"
	TokenHeader   = "X-Kopia-Csrf-Token" // #nosec G101 -- a header's name, not a credential
)

var tokenMeta = regexp.MustCompile(`<meta name="kopia-csrf-token" content="([0-9a-f]+)"`)

var errPassword = errors.New("Kopia refused KOPIA_SERVER_PASSWORD")

// signIn reads Kopia's page for a session and its token. A page with no
// token (a Kopia that checks none) leaves the calls without one.
func (c *Client) signIn(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.Base+"/", nil)
	if err != nil {
		return err
	}
	req.SetBasicAuth("admin", c.Password)
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("Kopia does not answer: %w", err)
	}
	defer resp.Body.Close()
	page, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode == http.StatusUnauthorized {
		return errPassword
	}
	session, token := "", ""
	for _, ck := range resp.Cookies() {
		if ck.Name == SessionCookie {
			session = ck.Value
		}
	}
	if m := tokenMeta.FindSubmatch(page); m != nil {
		token = string(m[1])
	}
	c.mu.Lock()
	c.session, c.token = session, token
	c.mu.Unlock()
	return nil
}

// send makes one call to the API with the session, and answers its status and body.
func (c *Client) send(ctx context.Context, method, p string, data []byte) (int, string, []byte, error) {
	var r io.Reader
	if data != nil {
		r = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.Base+"/api/v1/"+p, r)
	if err != nil {
		return 0, "", nil, err
	}
	req.SetBasicAuth("admin", c.Password)
	if data != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	c.mu.Lock()
	session, token := c.session, c.token
	c.mu.Unlock()
	if session != "" {
		// #nosec G124 -- a cookie sent back on a request: only its name and value go
		req.AddCookie(&http.Cookie{Name: SessionCookie, Value: session})
	}
	if token != "" {
		req.Header.Set(TokenHeader, token)
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return 0, "", nil, fmt.Errorf("Kopia does not answer: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, resp.Status, body, nil
}

// Get is a call's answer as it came: a file's contents for objects/<id>.
func (c *Client) Get(ctx context.Context, p string) ([]byte, error) {
	return c.call(ctx, http.MethodGet, p, nil)
}

// Call makes a call to Kopia's API (p after /api/v1/), with body as JSON,
// and reads its JSON answer into out.
func (c *Client) Call(ctx context.Context, method, p string, body, out any) error {
	return c.do(ctx, method, p, body, out)
}

func (c *Client) do(ctx context.Context, method, p string, body, out any) error {
	var data []byte
	if body != nil {
		var err error
		if data, err = json.Marshal(body); err != nil {
			return err
		}
	}
	answer, err := c.call(ctx, method, p, data)
	if err != nil || out == nil {
		return err
	}
	return json.Unmarshal(answer, out)
}

// call signs in first if it hasn't, and once again when Kopia turns the
// session down (started again since, it knows it no more).
func (c *Client) call(ctx context.Context, method, p string, data []byte) ([]byte, error) {
	c.mu.Lock()
	fresh := c.session == "" && c.token == ""
	c.mu.Unlock()
	if fresh {
		if err := c.signIn(ctx); err != nil {
			return nil, err
		}
	}
	code, status, answer, err := c.send(ctx, method, p, data)
	if err != nil {
		return nil, err
	}
	if code == http.StatusUnauthorized && strings.Contains(string(answer), "CSRF") && !fresh {
		if err := c.signIn(ctx); err != nil {
			return nil, err
		}
		if code, status, answer, err = c.send(ctx, method, p, data); err != nil {
			return nil, err
		}
	}
	switch {
	case code == http.StatusUnauthorized && strings.Contains(string(answer), "CSRF"):
		return nil, fmt.Errorf("Kopia turned down its own session: %s", strings.TrimSpace(string(answer)))
	case code == http.StatusUnauthorized:
		return nil, errPassword
	case code >= 300:
		return nil, fmt.Errorf("Kopia: %s %s", status, strings.TrimSpace(string(answer)))
	}
	return answer, nil
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
		"fsOutput": map[string]any{"targetPath": target, "overwriteFiles": true, "overwriteDirectories": true, "skipOwners": true},
		// It runs as you, who cannot give files their original owners.
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
