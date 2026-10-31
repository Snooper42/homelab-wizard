package accounts

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

// Jellyfin manages Jellyfin's users with an API key (Dashboard › API
// Keys), which acts as an administrator.
type Jellyfin struct{ c client }

// NewJellyfin is Jellyfin at base (http://127.0.0.1:8096) with an API key.
func NewJellyfin(base, key string) *Jellyfin {
	c := newClient(base, "Jellyfin")
	c.header = func(r *http.Request) { r.Header.Set("Authorization", `MediaBrowser Token="`+key+`"`) }
	return &Jellyfin{c: c}
}

// App is the catalog id.
func (j *Jellyfin) App() string { return "jellyfin" }

type jellyfinUser struct {
	ID   string `json:"Id"`
	Name string `json:"Name"`
}

func (j *Jellyfin) users(ctx context.Context) ([]jellyfinUser, error) {
	var list []jellyfinUser
	_, err := j.c.call(ctx, http.MethodGet, "/Users", nil, &list)
	return list, err
}

// Check lists the users, which only an administrator's key may.
func (j *Jellyfin) Check(ctx context.Context) error {
	_, err := j.users(ctx)
	return err
}

// Find is the user named username; Jellyfin's names are not case-sensitive.
func (j *Jellyfin) Find(ctx context.Context, username string) (string, bool, error) {
	list, err := j.users(ctx)
	if err != nil {
		return "", false, err
	}
	for _, u := range list {
		if strings.EqualFold(u.Name, username) {
			return u.ID, true, nil
		}
	}
	return "", false, nil
}

// Create makes a user with Jellyfin's default access (every library).
func (j *Jellyfin) Create(ctx context.Context, username, password string) error {
	_, err := j.c.call(ctx, http.MethodPost, "/Users/New", map[string]string{"Name": username, "Password": password}, nil)
	return err
}

// SetPassword changes a user's password; an administrator's key needs
// the old one only for its own user, which a key has none of.
func (j *Jellyfin) SetPassword(ctx context.Context, id, password string) error {
	body := map[string]any{"NewPw": password, "ResetPassword": false}
	// Jellyfin 10.10 moved it to /Users/Password; 10.9 has only the old path.
	status, err := j.c.call(ctx, http.MethodPost, "/Users/Password?userId="+url.QueryEscape(id), body, nil)
	if status == http.StatusNotFound || status == http.StatusMethodNotAllowed {
		_, err = j.c.call(ctx, http.MethodPost, "/Users/"+url.PathEscape(id)+"/Password", body, nil)
	}
	return err
}

// Disable turns the user's IsDisabled policy on, keeping the rest of the
// policy (libraries, parental ratings) as it was.
func (j *Jellyfin) Disable(ctx context.Context, id string) error {
	var user struct {
		Policy map[string]any `json:"Policy"`
	}
	if _, err := j.c.call(ctx, http.MethodGet, "/Users/"+url.PathEscape(id), nil, &user); err != nil {
		return err
	}
	if user.Policy == nil {
		return fmt.Errorf("Jellyfin sent no policy for user %s", id)
	}
	user.Policy["IsDisabled"] = true
	_, err := j.c.call(ctx, http.MethodPost, "/Users/"+url.PathEscape(id)+"/Policy", user.Policy, nil)
	return err
}
