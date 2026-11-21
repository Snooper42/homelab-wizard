package wiring

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
)

// JellyfinAdmin is a Jellyfin administrator's name and password, given for
// one run so Seerr can make its first sign-in. Wiring never saves it: the
// run that uses it forgets it.
type JellyfinAdmin struct {
	User     string
	Password string
}

// seerrAsk is what Connect apps says while Seerr waits for a Jellyfin
// administrator and none was given.
const seerrAsk = "it needs a Jellyfin administrator's name and password once, to set itself up (used once, not kept); or " + seerrSignIn

// FixSeerrSignIn is the fix for a Seerr waiting for its first sign-in: ask
// a Jellyfin administrator's name and password (the app's form, or the
// terminal) and connect again with them (Wirer.JellyfinAdmin).
const FixSeerrSignIn = "seerr-signin"

const seerrStep = "Seerr signs in to Jellyfin"

// askAgain is a Seerr sign-in a name and password could still make: its
// step offers FixSeerrSignIn.
func (w *Wirer) askAgain(detail string) (string, string, error) {
	if w.fixes == nil {
		w.fixes = map[string]string{}
	}
	w.fixes[seerrStep] = FixSeerrSignIn
	return "manual", detail, nil
}

// jellyfinFromSeerr is Jellyfin's address from inside Seerr's container:
// the native Jellyfin on this computer (ADR-0010), on JELLYFIN_PORT.
func (w *Wirer) jellyfinFromSeerr() (string, int) {
	port, err := strconv.Atoi(cmp.Or(w.Env["JELLYFIN_PORT"], "8096"))
	if err != nil {
		port = 8096
	}
	return "host.docker.internal", port
}

// seerrSetup makes Seerr's first-run sign-in with Jellyfin, as its setup
// page does: /auth/jellyfin with an administrator (Seerr makes it its own
// administrator and takes a Jellyfin API key of its own), the film and TV
// libraries ticked, then /settings/initialize. Once Seerr is set up it is
// left alone. The password is forgotten after the attempt, whatever came
// of it.
func (w *Wirer) seerrSetup(ctx context.Context) (string, string, error) {
	key, initialized := w.seerrKey()
	if initialized {
		w.JellyfinAdmin = nil
		return "already", "", nil
	}
	admin := w.JellyfinAdmin
	w.JellyfinAdmin = nil
	if admin == nil || admin.User == "" {
		return w.askAgain(seerrAsk)
	}
	if key == "" {
		return "", "", errSeerrNotSetUp
	}
	host, port := w.jellyfinFromSeerr()
	body, _ := json.Marshal(map[string]any{
		"username": admin.User, "password": admin.Password, "hostname": host, "port": port,
		"useSsl": false, "urlBase": "", "email": admin.User, "serverType": 2, // MediaServerType.JELLYFIN
	})
	if err := w.send(ctx, "seerr", http.MethodPost, "/api/v1/auth/jellyfin", map[string]string{"Content-Type": "application/json"}, body, nil); err != nil {
		var se *statusError
		if errors.As(err, &se) {
			switch {
			case strings.Contains(se.msg, "INVALID_CREDENTIALS"):
				return w.askAgain("Jellyfin didn't accept that name and password; try again, or " + seerrSignIn)
			case strings.Contains(se.msg, "NOT_ADMIN"):
				return w.askAgain(admin.User + " isn't a Jellyfin administrator; use one who is, or " + seerrSignIn)
			case strings.Contains(se.msg, "INVALID_URL"), strings.Contains(se.msg, "CONNECTION_ERROR"):
				return "manual", "Seerr couldn't reach Jellyfin at " + host + ":" + strconv.Itoa(port) + " (is Jellyfin running?); then " + seerrSignIn, nil
			}
		}
		return "", "", err
	}
	header := map[string]string{"X-Api-Key": key, "Content-Type": "application/json"}
	var libs []struct {
		ID      string `json:"id"`
		Name    string `json:"name"`
		Type    string `json:"type"`
		Enabled bool   `json:"enabled"`
	}
	sees := ""
	if err := w.send(ctx, "seerr", http.MethodPost, "/api/v1/settings/jellyfin/library/sync", header, nil, &libs); err != nil {
		var se *statusError
		if !errors.As(err, &se) || se.code != http.StatusNotFound {
			return "", "", err
		}
		sees = "; Jellyfin has no libraries yet: tick them in Seerr's Settings › Jellyfin once it has"
	}
	var names []string
	for _, l := range libs {
		if l.Type != "movie" && l.Type != "show" {
			continue
		}
		names = append(names, l.Name)
		if l.Enabled {
			continue
		}
		on, _ := json.Marshal(map[string]bool{"enabled": true})
		if err := w.send(ctx, "seerr", http.MethodPut, "/api/v1/settings/jellyfin/library/"+l.ID, header, on, nil); err != nil {
			return "", "", err
		}
	}
	if len(names) > 0 {
		sees = "; Seerr sees " + joinAnd(names)
	}
	if err := w.send(ctx, "seerr", http.MethodPost, "/api/v1/settings/initialize", header, nil, nil); err != nil {
		return "", "", err
	}
	return "done", "as " + admin.User + sees, nil
}

// joinAnd is "a", "a and b", or "a, b and c".
func joinAnd(s []string) string {
	if len(s) < 2 {
		return strings.Join(s, "")
	}
	return strings.Join(s[:len(s)-1], ", ") + " and " + s[len(s)-1]
}
