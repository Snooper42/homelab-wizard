package tray

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"fyne.io/systray"

	"github.com/Snooper42/homelab-wizard/internal/core"
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

	// As the mockup has it: the dot and how many run, how many need a look
	// and when it was read, then each one; the apps under their categories.
	if s := m.status.String(); !strings.Contains(s, "need a look · checked just now") && !strings.Contains(s, "One needs a look · checked just now") {
		t.Errorf("the second line: %s", s)
	}
	if m.dots[m.summary] != DotLook || m.summary.Disabled() || !strings.Contains(m.looks[0].String(), " is not running") || m.dots[m.looks[0]] != DotLook {
		t.Errorf("what needs a look: %s (%q, disabled %v), %s", m.summary.String(), m.dots[m.summary], m.summary.Disabled(), m.looks[0].String())
	}
	// Every line of the top part has a mark, so their words line up: the
	// grey subtitle an empty one.
	if d, ok := m.dots[m.status]; !ok || d != DotNone || !m.status.Disabled() {
		t.Errorf("the subtitle: mark %q (set %v), disabled %v", d, ok, m.status.Disabled())
	}
	if !m.items[0].Disabled() || m.dots[m.items[0]] != DotNone || m.items[1].Disabled() || !strings.Contains(m.items[1].String(), "Watchtower") {
		t.Errorf("Open an app: %s (disabled %v), %s", m.items[0].String(), m.items[0].Disabled(), m.items[1].String())
	}
	if !strings.Contains(m.every.String(), "Every app…") {
		t.Errorf("the last line of Open an app: %s", m.every.String())
	}

	var opened []string
	open := func(screen string) { opened = append(opened, screen) }
	for _, item := range []any{m.summary, m.open, m.alert, m.failing, m.looks[0], m.every, m.lastBackup, m.update} {
		m.clicked(item.(*systray.MenuItem), open)
	}
	if strings.Join(opened, " ") != "status status status status status status backups setup" {
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

	// Keep … awake: ticked by default, and a click sets KEEP_AWAKE.
	if err := os.WriteFile(filepath.Join(root, ".env"), []byte("KEEP_AWAKE=true\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	m.refresh()
	if !m.awake.Checked() || m.awake.String() == "" || !strings.Contains(m.awake.String(), "Keep this computer awake while plugged in") {
		t.Fatalf("Keep awake: %s, ticked %v", m.awake.String(), m.awake.Checked())
	}
	m.clicked(m.awake, open)
	if m.awake.Checked() || core.Env(root)["KEEP_AWAKE"] != "false" {
		t.Fatalf("turning Keep awake off: ticked %v, KEEP_AWAKE=%q", m.awake.Checked(), core.Env(root)["KEEP_AWAKE"])
	}
	m.refresh()
	if m.awake.Checked() {
		t.Fatal("refreshing ticked Keep awake again while it is off")
	}
	m.clicked(m.awake, open)
	if !m.awake.Checked() || core.Env(root)["KEEP_AWAKE"] != "true" {
		t.Fatalf("turning Keep awake on: ticked %v, KEEP_AWAKE=%q", m.awake.Checked(), core.Env(root)["KEEP_AWAKE"])
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
