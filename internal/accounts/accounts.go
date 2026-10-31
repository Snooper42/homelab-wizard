// Package accounts makes and changes people's accounts in the apps that
// have a password of their own rather than the household's Pocket ID
// sign-in: Jellyfin (films, through Infuse and the TV apps too) and
// Navidrome (music, through Subsonic apps such as Arpeggi). Settings ›
// People uses it to add someone to them, reset their password, and turn
// them off.
package accounts

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"time"
)

// Service is one app's accounts.
type Service interface {
	// App is the catalog id: "jellyfin" or "navidrome".
	App() string
	// Check signs in with the homelab's key or login and says whether it
	// may manage accounts.
	Check(ctx context.Context) error
	// Find is the account with this username (case aside).
	Find(ctx context.Context, username string) (id string, found bool, err error)
	Create(ctx context.Context, username, password string) error
	SetPassword(ctx context.Context, id, password string) error
	// Disable keeps the account and its history but lets no one sign in.
	Disable(ctx context.Context, id string) error
}

// ErrNoAccess is a key or login the app refused.
var ErrNoAccess = errors.New("refused")

// passwordAlphabet leaves out letters and digits that look alike (l, 1, o,
// 0), since the password may be typed on a TV with a remote.
const passwordAlphabet = "abcdefghijkmnpqrstuvwxyz23456789"

// NewPassword is a password for a person's app accounts: four groups of
// four letters and digits (about 80 bits), easy to read off a page and to
// type on a TV.
func NewPassword() string {
	var b strings.Builder
	for i := 0; i < 16; i++ {
		if i > 0 && i%4 == 0 {
			b.WriteByte('-')
		}
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(passwordAlphabet))))
		if err != nil {
			panic(err) // the system's random source failed
		}
		b.WriteByte(passwordAlphabet[n.Int64()])
	}
	return b.String()
}

// client is what both apps' APIs share: JSON over HTTP with a header that
// signs in.
type client struct {
	base   string
	header func(*http.Request)
	http   *http.Client
	name   string // for errors: "Jellyfin"
}

func newClient(base, name string) client {
	return client{base: strings.TrimRight(base, "/"), name: name, http: &http.Client{Timeout: 20 * time.Second}}
}

// call sends body as JSON and reads the answer into out; status is the
// HTTP status, for callers that try another path on 404.
func (c client) call(ctx context.Context, method, path string, body, out any) (int, error) {
	var rd io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return 0, err
		}
		rd = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.base+path, rd)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if c.header != nil {
		c.header(req)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return 0, fmt.Errorf("%s does not answer at %s: %w", c.name, c.base, err)
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	switch {
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
		return resp.StatusCode, fmt.Errorf("%s %w %s %s", c.name, ErrNoAccess, method, path)
	case resp.StatusCode >= 300:
		return resp.StatusCode, fmt.Errorf("%s %s %s: %d %s", c.name, method, path, resp.StatusCode, strings.TrimSpace(string(data)))
	}
	if out != nil && len(bytes.TrimSpace(data)) > 0 {
		if err := json.Unmarshal(data, out); err != nil {
			return resp.StatusCode, fmt.Errorf("%s %s %s: %w", c.name, method, path, err)
		}
	}
	return resp.StatusCode, nil
}
