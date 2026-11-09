package notify

import (
	"strings"
)

// Action is a button on an alert: ntfy's "view" action, which opens a link
// (https://docs.ntfy.sh/publish/#action-buttons). Only the iPhone app's own
// links (homelab://, apple-client/Shared/Models/DeepLink.swift) are sent,
// and they change nothing by themselves: the app opens the app's page and
// asks for a tap, then Face ID, first. A link never carries a secret.
type Action struct {
	Label string
	URL   string
}

// maxActions is how many buttons ntfy shows on one alert.
const maxActions = 3

// StatusLink opens the iPhone app's Status.
const StatusLink = "homelab://status"

// appDoes is what an app link may ask for, as the iPhone app reads it.
var appDoes = map[string]bool{"": true, "restart": true, "start": true, "stop": true, "logs": true}

// AppLink is the iPhone app's link to an app's page, with what it asks for
// ("" for none; restart, start, stop or logs). "" for an id that isn't one,
// or an ask the app doesn't take.
func AppLink(id, do string) string {
	if !isAppID(id) || !appDoes[do] {
		return ""
	}
	if do == "" {
		return "homelab://app/" + id
	}
	return "homelab://app/" + id + "?do=" + do
}

// isAppID is an app's id as the catalog writes them, and as the iPhone app
// takes them: ASCII letters, digits, '.', '_' and '-', starting with a
// letter or digit, at most 64.
func isAppID(id string) bool {
	if id == "" || len(id) > 64 {
		return false
	}
	for i, c := range id {
		alnum := c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9'
		if !alnum && (i == 0 || c != '.' && c != '_' && c != '-') {
			return false
		}
	}
	return true
}

// DownButtons are the buttons on "an app is down": for one app, Restart
// and Show Logs; for more than one, Open Status. Checks that aren't an app
// (a disk, the engine) get none.
func DownButtons(failed []string, isApp func(string) bool) []Action {
	var apps []string
	for _, name := range failed {
		if isApp(name) && isAppID(name) {
			apps = append(apps, name)
		}
	}
	switch len(apps) {
	case 0:
		return nil
	case 1:
		return []Action{{"Restart", AppLink(apps[0], "restart")}, {"Show Logs", AppLink(apps[0], "logs")}}
	default:
		return []Action{{"Open Status", StatusLink}}
	}
}

// StoppedButtons are the buttons on "stopped an app that kept restarting":
// for one app, Show Logs (which says what to fix) and Start; for more, Open
// Status.
func StoppedButtons(stopped []string, isApp func(string) bool) []Action {
	b := DownButtons(stopped, isApp)
	if len(b) == 2 {
		id := strings.TrimPrefix(strings.TrimSuffix(b[0].URL, "?do=restart"), "homelab://app/")
		return []Action{{"Show Logs", AppLink(id, "logs")}, {"Start", AppLink(id, "start")}}
	}
	return b
}

// actionsHeader is ntfy's Actions header for the buttons, each with its
// keys named ("action=view, label=<label>, url=<url>", so the link's own
// "=" is never read as another key), at most three. A button whose label or
// link the header can't carry plainly (a comma, a semicolon, a quote, a
// space in the link), or whose link isn't the app's own, is left off rather
// than sent half-read.
func actionsHeader(actions []Action) string {
	var parts []string
	for _, a := range actions {
		if len(parts) == maxActions {
			break
		}
		if !plain(a.Label, 40) || strings.Contains(a.Label, "=") ||
			!plain(a.URL, 200) || !strings.HasPrefix(a.URL, "homelab://") || strings.ContainsAny(a.URL, " ") {
			continue
		}
		parts = append(parts, "action=view, label="+a.Label+", url="+a.URL)
	}
	return strings.Join(parts, "; ")
}

// plain is text ntfy's simple header format carries as it is.
func plain(s string, max int) bool {
	if s == "" || len(s) > max || strings.TrimSpace(s) != s || strings.ContainsAny(s, ",;\"'") {
		return false
	}
	for _, c := range s {
		if c < 0x20 || c == 0x7f {
			return false
		}
	}
	return true
}
