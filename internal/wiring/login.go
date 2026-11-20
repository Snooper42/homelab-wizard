package wiring

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// The login Prowlarr, Sonarr, Radarr and Lidarr ask for (item 1d of
// arr-loop.md): ARR_PASSWORD is made at install like every other secret
// (__REPLACE_ME__ in .env.example), and wire sets it in each app through
// its API key, so the app's "Authentication required" window never shows.
// The app's ⚙ Sign-in details show it to copy into a password manager.

// arrLoginApps are the apps that take ARR_USER and ARR_PASSWORD, in order.
var arrLoginApps = []string{"prowlarr", "sonarr", "radarr", "lidarr"}

// arrUser is the login's user name; the apps keep it in lower case.
func (w *Wirer) arrUser() string {
	if u := strings.TrimSpace(w.Env["ARR_USER"]); u != "" {
		return strings.ToLower(u)
	}
	return "admin"
}

// arrLogin makes the app ask for ARR_USER and ARR_PASSWORD on its sign-in
// page. It is found next time: an app already asking for that user is
// checked with one sign-in (a failed one counts toward the app's lockout,
// so never more), and only a password that no longer matches is set again.
func (w *Wirer) arrLogin(ctx context.Context, id string) (string, string, error) {
	password := w.Env["ARR_PASSWORD"]
	key, err := w.ready(ctx, id)
	if err != nil {
		return "", "", err
	}
	var host resource
	if err := w.call(ctx, id, key, http.MethodGet, "config/host", nil, &host); err != nil {
		return "", "", err
	}
	user := w.arrUser()
	had := strings.ToLower(str(host["username"]))
	detail := ""
	switch {
	case str(host["authenticationMethod"]) == "forms" && str(host["authenticationRequired"]) == "enabled" &&
		had == user && str(host["password"]) != "":
		ok, err := w.arrSignsIn(ctx, id, user, password)
		if err != nil {
			return "", "", err
		}
		if ok {
			return "already", "", nil
		}
		detail = "set the password again: it was not the one in Sign-in details"
	case had != "" && had != user:
		detail = "replaced the login made in " + w.name(id) + " (" + had + ") with the one in Sign-in details"
	}
	host["authenticationMethod"] = "forms"
	host["authenticationRequired"] = "enabled"
	host["username"] = user
	host["password"] = password
	host["passwordConfirmation"] = password
	if err := w.call(ctx, id, key, http.MethodPut, fmt.Sprintf("config/host/%v", idOr(host["id"], 1)), host, nil); err != nil {
		return "", "", err
	}
	return "done", detail, nil
}

// arrSignsIn reports whether the app's sign-in page takes user and
// password. The app answers with a redirect either way: back to the
// sign-in page with loginFailed when it refuses.
func (w *Wirer) arrSignsIn(ctx context.Context, id, user, password string) (bool, error) {
	base := strings.TrimRight(w.Apps[id].URL, "/")
	form := url.Values{"username": {user}, "password": {password}, "rememberMe": {"false"}}.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/login", strings.NewReader(form))
	if err != nil {
		return false, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	client := *w.qbitClient()
	client.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	resp, err := client.Do(req)
	if err != nil {
		return false, err
	}
	io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
	resp.Body.Close()
	switch {
	case resp.StatusCode == http.StatusUnauthorized:
		return false, nil
	case resp.StatusCode/100 == 3:
		return !strings.Contains(resp.Header.Get("Location"), "loginFailed"), nil
	case resp.StatusCode/100 == 2:
		return true, nil
	}
	return false, errors.New(w.name(id) + " sign-in page: " + resp.Status)
}

func str(v any) string {
	if v == nil {
		return ""
	}
	return fmt.Sprint(v)
}

func idOr(v any, def int) any {
	if v == nil {
		return def
	}
	if f, ok := v.(float64); ok {
		return int(f)
	}
	return v
}
