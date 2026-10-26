package tray

import (
	"strings"
	"testing"
	"time"

	"fyne.io/systray"

	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// The menu itself, built and clicked. On Linux the tray's menu lives in
// memory until a desktop asks for it over D-Bus, so it can be built without
// one; the Mac's menu bar and Windows' notification area need the tray
// running, and their runners test the reading the menu shows (TestRead).
func TestMenu(t *testing.T) {
	root := homelab(t, docker.FakeContainer{Name: "homelab_security-watchtower-1", Image: "nickfedor/watchtower", Running: true, Project: "homelab_security", Service: "watchtower"})
	m := newMenu(root)
	if m.summary.String() == "" || len(m.items) != slots {
		t.Fatal("the menu was not built")
	}
	m.refresh()
	if title := m.summary.String(); strings.Contains(title, "Checking") {
		t.Fatalf("not refreshed: %s", title)
	}
	if !m.attention {
		t.Error("the baseline is not running, yet the icon has no dot")
	}

	var opened []string
	open := func(screen string) { opened = append(opened, screen) }
	for _, item := range []any{m.open, m.alert, m.failing, m.lastBackup, m.update} {
		m.clicked(item.(*systray.MenuItem), open)
	}
	if strings.Join(opened, " ") != "status status status backups setup" {
		t.Fatalf("opened %q", opened)
	}

	m.clicked(m.pause, open)
	if !m.paused.Load() || !strings.Contains(m.pause.String(), "Resume") {
		t.Fatalf("pausing: %v %s", m.paused.Load(), m.pause.String())
	}
	m.clicked(m.pause, open)
	if m.paused.Load() {
		t.Fatal("resuming")
	}

	m.clicked(m.backupNow, open)
	m.clicked(m.updateNow, open)
	for end := time.Now().Add(10 * time.Second); time.Now().Before(end); time.Sleep(20 * time.Millisecond) {
		if strings.Contains(m.backupNow.String(), "done") && strings.Contains(m.updateNow.String(), "done") {
			break
		}
	}
	if !strings.Contains(m.backupNow.String(), "done") || !strings.Contains(m.updateNow.String(), "done") {
		t.Fatalf("the jobs: %s, %s", m.backupNow.String(), m.updateNow.String())
	}

	if _, err := SaveAppearance(Appearance{Icon: "#ff8800"}); err != nil {
		t.Fatal(err)
	}
	m.lookAgain()
	if m.look.Icon != "#ff8800" {
		t.Fatalf("the icon's colour: %+v", m.look)
	}
}
