package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// TestSnoozeAnAlert: a check snoozed with homelab notify snooze is still
// checked but not alerted about; when the snooze ends and it still fails,
// the watchdog alerts once then (it would never alert again otherwise:
// it alerts when a check begins to fail).
func TestSnoozeAnAlert(t *testing.T) {
	var mu sync.Mutex
	var titles []string // the down alerts about Vaultwarden
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		body, _ := io.ReadAll(r.Body)
		if r.Header.Get("Title") == core.DownTitle && strings.Contains(strings.ToLower(string(body)), "vaultwarden") {
			titles = append(titles, string(body))
		}
	}))
	defer srv.Close()
	u, _ := url.Parse(srv.URL)
	downs := func() int {
		mu.Lock()
		defer mu.Unlock()
		return len(titles) // down alerts that name Vaultwarden
	}
	fakeDocker(t, []docker.FakeContainer{
		{Name: "homelab_security-vaultwarden-1", Image: "vaultwarden/server:latest", Running: true, Health: "unhealthy", Project: "homelab_security", Service: "vaultwarden"},
	})
	root, _ := repoCopy(t, "UPDATES_PAUSED=true", "TUNNEL_TOKEN=", "AUTO_HEAL=false", "DESKTOP_ALERTS=false", "NTFY_PORT="+u.Port(), "NTFY_PUBLISH_TOKEN=tk_pub")

	if out, code := homelabCmd(t, root, "", "notify", "snooze", "vaultwarden", "1h"); code != 0 || !strings.Contains(out, "no alerts about vaultwarden until") {
		t.Fatalf("snooze (exit %d):\n%s", code, out)
	}
	homelabCmd(t, root, "", "watchdog")
	out, _ := homelabCmd(t, root, "", "watchdog")
	if !strings.Contains(out, "vaultwarden") || downs() != 0 {
		t.Fatalf("alerted while snoozed (%d), or not checked:\n%s", downs(), out)
	}
	// Alert again now (as if the hour has passed).
	if out, code := homelabCmd(t, root, "", "notify", "snooze", "vaultwarden", "off"); code != 0 || !strings.Contains(out, "alerts about vaultwarden again") {
		t.Fatalf("snooze off (exit %d):\n%s", code, out)
	}
	homelabCmd(t, root, "", "watchdog")
	if n := downs(); n != 1 {
		t.Fatalf("still failing when the snooze ended: %d alerts, want 1 (%v)", n, titles)
	}
	homelabCmd(t, root, "", "watchdog")
	if n := downs(); n != 1 {
		t.Fatalf("alerted again after waking: %d", n)
	}
	if _, code := homelabCmd(t, root, "", "notify", "snooze", "vaultwarden", "soon"); code == 0 {
		t.Error("a length that is not one was taken")
	}
}

// TestDownAlertHasButtons: apps down reach the phone with a button into
// the iPhone app (homelab://, which changes nothing by itself: the app asks
// for a tap, then Face ID). This homelab has two selected apps not running,
// so the button is Open Status; one app gets Restart and Show Logs
// (internal/notify's TestButtonsForApps).
func TestDownAlertHasButtons(t *testing.T) {
	var mu sync.Mutex
	var bodies, actions []string // the down alerts
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		if r.Header.Get("Title") == core.DownTitle {
			body, _ := io.ReadAll(r.Body)
			bodies = append(bodies, string(body))
			actions = append(actions, r.Header.Get("Actions"))
		}
	}))
	defer srv.Close()
	u, _ := url.Parse(srv.URL)
	fakeDocker(t, nil)
	root, _ := repoCopy(t, "UPDATES_PAUSED=true", "TUNNEL_TOKEN=", "AUTO_HEAL=false", "DESKTOP_ALERTS=false", "NTFY_PORT="+u.Port(), "NTFY_PUBLISH_TOKEN=tk_pub")
	homelabCmd(t, root, "", "watchdog")
	homelabCmd(t, root, "", "watchdog")
	mu.Lock()
	defer mu.Unlock()
	if len(actions) != 1 || actions[0] != "action=view, label=Open Status, url=homelab://status" || strings.Count(bodies[0], "not running") < 2 {
		t.Fatalf("down alerts %q, buttons %q", bodies, actions)
	}
}
