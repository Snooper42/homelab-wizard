package tray

import (
	"bytes"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/notify"
	"github.com/Snooper42/homelab-wizard/internal/updates"
)

func TestSummaryAndLinks(t *testing.T) {
	st := api.Status{Apps: []api.AppStatus{
		{ID: "immich-server", Name: "Immich", State: "running", Health: "healthy", URL: "http://localhost:2283", Address: "photos.example.com"},
		{ID: "sonarr", Name: "Sonarr", State: "running", Health: "unhealthy", URL: "http://localhost:8989"},
		{ID: "ntfy", Name: "ntfy", State: "stopped"},
	}}
	if got := Summary(st); got != "2 of 3 apps running · 1 unhealthy" {
		t.Errorf("summary %q", got)
	}
	if got := Summary(api.Status{Apps: st.Apps[:1]}); got != "1 apps running · all healthy" {
		t.Errorf("summary %q", got)
	}
	loop := api.Status{Apps: []api.AppStatus{{Name: "Immich", State: "running", Health: "restarting"}}}
	if got := Summary(loop); got != "1 of 1 apps running · 1 unhealthy" {
		t.Errorf("a crash loop counts as unhealthy: %q", got)
	}
	mute := api.Status{Apps: []api.AppStatus{{Name: "Immich", State: "running", Health: "healthy", NotAnswering: "HTTP 502"}}}
	if got := Summary(mute); got != "1 of 1 apps running · 1 unhealthy" {
		t.Errorf("a page that does not answer counts as unhealthy: %q", got)
	}
	links := Links(st, 8)
	if len(links) != 2 || links[0].URL != "https://photos.example.com" || links[0].Title != "Immich" || links[1].Title != "Sonarr" || links[1].URL != "http://localhost:8989" {
		t.Errorf("links %+v", links)
	}
	if UpdatesTitle(updates.State{Schedule: "daily at 04:00"}) != "Pause nightly updates" || UpdatesTitle(updates.State{Paused: true}) != "Resume nightly updates" {
		t.Error("updates title")
	}
	if len(Links(st, 1)) != 1 {
		t.Error("links ignore the limit")
	}
	if icon := ico(iconPNG(true)); !bytes.HasPrefix(icon, []byte{0, 0, 1, 0, 1, 0, 32, 32}) || !bytes.Contains(icon, []byte("PNG")) {
		t.Error("bad .ico")
	}
}

func TestAlertTitle(t *testing.T) {
	now := time.Date(2026, 10, 10, 12, 0, 0, 0, time.UTC)
	if got := AlertTitle(notify.Event{Title: "Tunnel down", Time: now.Add(-3 * time.Hour)}, now); got != "Alert: Tunnel down  —  3h ago" {
		t.Errorf("%q", got)
	}
	if got := AlertTitle(notify.Event{Message: "vikunja: new image", Time: now.Add(-90 * time.Second)}, now); got != "Alert: vikunja: new image  —  1m ago" {
		t.Errorf("%q", got)
	}
}

func TestBackupTitle(t *testing.T) {
	now := time.Date(2026, 10, 10, 12, 0, 0, 0, time.UTC)
	for _, c := range []struct {
		ago  time.Duration
		want string
	}{
		{20 * time.Minute, ""},
		{7 * time.Hour, ""},
		{30 * time.Hour, "Last backup 30h ago  —  check Backups"},
		{3 * 24 * time.Hour, "Last backup 3 days ago  —  check Backups"},
	} {
		if got := BackupTitle(now.Add(-c.ago), now); got != c.want {
			t.Errorf("%v: %q, want %q", c.ago, got, c.want)
		}
	}
}

func TestUpdateTitle(t *testing.T) {
	if got := UpdateTitle(1, true); got != "Update ready: 1 new change" {
		t.Error(got)
	}
	if got := UpdateTitle(4, false); got != "Update ready: 4 new changes" {
		t.Error(got)
	}
	if got := UpdateTitle(0, true); got != "Update ready: a new Homelab Wizard" {
		t.Error(got)
	}
	if got := UpdateTitle(0, false); got != "" {
		t.Error(got)
	}
}

func TestWatchdogTitle(t *testing.T) {
	if got := WatchdogTitle(health.Summary{Checks: 40}); got != "" {
		t.Errorf("nothing failing: %q", got)
	}
	one := health.Summary{Failing: []health.Failure{{Name: "crowdsec bouncer"}}}
	if got := WatchdogTitle(one); got != "Failing: crowdsec bouncer" {
		t.Errorf("one: %q", got)
	}
	many := health.Summary{Failing: []health.Failure{{Name: "crowdsec bouncer"}, {Name: "photos.example.com"}, {Name: "duplicati Homelab Photos"}}}
	if got := WatchdogTitle(many); !strings.HasPrefix(got, "3 checks failing: crowdsec bouncer, photos") || len([]rune(got)) > 60 {
		t.Errorf("many: %q", got)
	}
}
