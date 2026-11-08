package main

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/notify"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// Overnight an alert reaches the phone without a sound, unless it is
// serious; QUIET_HOURS=off sounds them all, and the day is as it was.
func TestAlertsAreQuietOvernight(t *testing.T) {
	var priority []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		priority = append(priority, r.Header.Get("Priority"))
	}))
	defer srv.Close()
	u, _ := url.Parse(srv.URL)
	saved := alertNow
	t.Cleanup(func() { alertNow = saved })
	for _, c := range []struct {
		name    string
		setting string
		hour    int
		sent    int
		want    string
	}{
		{"an app down at 2 AM", "", 2, 4, "2"},
		{"the vault down at 2 AM", "", 2, notify.Serious, "5"},
		{"an app down in the afternoon", "", 14, 4, "4"},
		{"quiet hours off", "QUIET_HOURS=off", 2, 4, "4"},
		{"its own hours", "QUIET_HOURS=13-15", 14, 4, "2"},
	} {
		env := []string{"NTFY_PORT=" + u.Port(), "NTFY_PUBLISH_TOKEN=tk_pub", "DESKTOP_ALERTS=false"}
		if c.setting != "" {
			env = append(env, c.setting)
		}
		root, _ := repoCopy(t, env...)
		h := &homelab{root: root, envFile: filepath.Join(root, ".env"), ui: &ui.UI{Out: io.Discard}, catalog: catalogOf(t)}
		alertNow = func() time.Time { return time.Date(2026, 11, 5, c.hour, 0, 0, 0, time.Local) }
		priority = nil
		h.alert(context.Background(), "tunnel-watchdog", notify.Message{Title: "Homelab: something is down", Priority: c.sent})
		if len(priority) != 1 || priority[0] != c.want {
			t.Errorf("%s: sent at priority %q, want %q", c.name, priority, c.want)
		}
	}
}

func TestSeriousAlerts(t *testing.T) {
	if p := downPriority([]health.Result{{Name: "immich-server"}}); p != 4 {
		t.Errorf("an app down: %d", p)
	}
	if p := downPriority([]health.Result{{Name: "immich-server"}, {Name: "vaultwarden"}}); p != notify.Serious {
		t.Errorf("the vault down: %d", p)
	}
	now := time.Date(2026, 11, 5, 4, 40, 0, 0, time.UTC)
	for _, c := range []struct {
		name   string
		copies []backup.Copy
		want   bool
	}{
		{"all fresh", []backup.Copy{{State: "fresh", Newest: now.Add(-time.Hour)}}, false},
		{"one night missed", []backup.Copy{{State: "stale", Newest: now.Add(-28 * time.Hour)}}, false},
		{"two nights missed", []backup.Copy{{State: "fresh"}, {State: "stale", Newest: now.Add(-52 * time.Hour)}}, true},
		{"paused for a drive", []backup.Copy{{State: "paused", Newest: now.Add(-9 * 24 * time.Hour)}}, false},
	} {
		if got := daysFailing(backup.Overview{Copies: c.copies}, now); got != c.want {
			t.Errorf("%s: failing for days %v, want %v", c.name, got, c.want)
		}
	}
}
