package accounts

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

// Navidrome manages Navidrome's users through its own API (the one its
// web page uses), signed in as an administrator. It has no API keys.
type Navidrome struct {
	c              client
	user, password string
	token, self    string // after signing in: the session and its user's id
}

// NewNavidrome is Navidrome at base (http://127.0.0.1:4533) with an
// administrator's login.
func NewNavidrome(base, user, password string) *Navidrome {
	n := &Navidrome{c: newClient(base, "Navidrome"), user: user, password: password}
	n.c.header = func(r *http.Request) {
		if n.token != "" {
			r.Header.Set("X-ND-Authorization", "Bearer "+n.token)
		}
	}
	return n
}

// App is the catalog id.
func (n *Navidrome) App() string { return "navidrome" }

func (n *Navidrome) login(ctx context.Context) error {
	if n.token != "" {
		return nil
	}
	var out struct {
		ID      string `json:"id"`
		Token   string `json:"token"`
		IsAdmin bool   `json:"isAdmin"`
	}
	if _, err := n.c.call(ctx, http.MethodPost, "/auth/login", map[string]string{"username": n.user, "password": n.password}, &out); err != nil {
		return err
	}
	if !out.IsAdmin {
		return fmt.Errorf("Navidrome's %s is not an administrator, so it cannot manage accounts", n.user)
	}
	n.token, n.self = out.Token, out.ID
	return nil
}

// Check signs in as the administrator.
func (n *Navidrome) Check(ctx context.Context) error { return n.login(ctx) }

// Find is the user whose login is username (case aside).
func (n *Navidrome) Find(ctx context.Context, username string) (string, bool, error) {
	if err := n.login(ctx); err != nil {
		return "", false, err
	}
	var list []struct {
		ID       string `json:"id"`
		UserName string `json:"userName"`
	}
	if _, err := n.c.call(ctx, http.MethodGet, "/api/user", nil, &list); err != nil {
		return "", false, err
	}
	for _, u := range list {
		if strings.EqualFold(u.UserName, username) {
			return u.ID, true, nil
		}
	}
	return "", false, nil
}

// Create makes a user who is not an administrator; Navidrome gives them
// the libraries marked Default for New Users.
func (n *Navidrome) Create(ctx context.Context, username, password string) error {
	if err := n.login(ctx); err != nil {
		return err
	}
	_, err := n.c.call(ctx, http.MethodPost, "/api/user", map[string]any{"userName": username, "name": username, "password": password, "isAdmin": false}, nil)
	return err
}

// SetPassword changes another user's password. The homelab's own login
// is left alone: changing it here would leave NAVIDROME_ADMIN_PASSWORD
// out of date.
func (n *Navidrome) SetPassword(ctx context.Context, id, password string) error {
	if err := n.login(ctx); err != nil {
		return err
	}
	if id == n.self {
		return fmt.Errorf("%s is the login the homelab uses in Navidrome (NAVIDROME_ADMIN_USER); change it in Navidrome, then in Settings", n.user)
	}
	// The whole user goes back, so what Navidrome keeps beside the
	// password (libraries, admin, name) stays as it is.
	var user map[string]any
	path := "/api/user/" + url.PathEscape(id)
	if _, err := n.c.call(ctx, http.MethodGet, path, nil, &user); err != nil {
		return err
	}
	user["password"] = password
	_, err := n.c.call(ctx, http.MethodPut, path, user, nil)
	return err
}

// Disable gives the user a password no one knows: Navidrome has no
// switch to turn a user off, and their playlists and favourites stay.
func (n *Navidrome) Disable(ctx context.Context, id string) error {
	return n.SetPassword(ctx, id, NewPassword()+NewPassword())
}
