// Package tray is the menu bar item (macOS) or tray icon (Windows, Linux):
// how the homelab is doing, quick links to its apps, a backup, and a way
// back into Homelab Wizard. It runs as its own process, one at a time.
package tray

import (
	"context"
	"fmt"
	"net"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"fyne.io/systray"
	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/crash"
	"github.com/Snooper42/homelab-wizard/internal/engine"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/notify"
	"github.com/Snooper42/homelab-wizard/internal/savings"
	"github.com/Snooper42/homelab-wizard/internal/selfupdate"
	"github.com/Snooper42/homelab-wizard/internal/updates"
	"github.com/Snooper42/homelab-wizard/internal/upgrade"
)

// Commit and Repo are the build this tray belongs to and where its builds
// are published, set with -ldflags "-X .../app/tray.Commit=..."; empty in a
// local build, which is never offered an app update.
var Commit, Repo, Version string

// appCheckEvery is how often the tray asks GitHub for a newer app build.
const appCheckEvery = time.Hour

// lockAddr is held while a tray runs, so a second one exits at once.
const lockAddr = "127.0.0.1:47231"

// slots is how many apps the Open an app submenu has room for.
const slots = 16

// Run shows the item until Quit. openWizard opens the app on a screen
// ("choose" or "status").
func Run(openWizard func(screen string)) {
	l, err := net.Listen("tcp", lockAddr)
	if err != nil {
		return // another tray is running
	}
	defer l.Close()
	if root := core.Root(); root != "" {
		_ = crash.Watch(filepath.Join(root, "scripts", "logs"), "tray", Version)
	}
	systray.Run(func() { onReady(openWizard) }, func() {})
}

// setIcon draws the icon in the colour picked in Appearance, or the usual
// one: a template on the Mac, which macOS colours to suit the menu bar.
// attention adds the dot that says something needs a look, except on the
// Mac's template icon, where the Dock's count says it.
func setIcon(a Appearance, attention bool) {
	ink, picked := a.IconInk()
	switch {
	case runtime.GOOS == "darwin" && !picked:
		icon := iconPNG(templateInk, false)
		systray.SetTemplateIcon(icon, icon)
	case !picked:
		ink = blueInk
		fallthrough
	default:
		if runtime.GOOS == "windows" {
			systray.SetIcon(ico(iconPNG(ink, attention)))
		} else {
			systray.SetIcon(iconPNG(ink, attention))
		}
	}
}

func onReady(openWizard func(string)) {
	hideDockIcon()
	m := newMenu(core.Root())
	// A change the engine reports refreshes the menu at once; the minute's
	// tick is for what it does not report (backups, alerts, updates).
	changed := make(chan struct{}, 1)
	go engine.Follow(context.Background(), m.root, func(engine.Change) {
		select {
		case changed <- struct{}{}:
		default:
		}
	})
	go func() {
		m.refresh()
		tick := time.NewTicker(time.Minute)
		// The icon's colour follows Settings › Appearance within a moment.
		looks := time.NewTicker(2 * time.Second)
		for {
			select {
			case <-looks.C:
				m.lookAgain()
			case <-tick.C:
				m.refresh()
			case <-changed:
				m.refresh()
			case <-m.open.ClickedCh:
				m.clicked(m.open, openWizard)
			case <-m.alert.ClickedCh:
				m.clicked(m.alert, openWizard)
			case <-m.failing.ClickedCh:
				m.clicked(m.failing, openWizard)
			case <-m.lastBackup.ClickedCh:
				m.clicked(m.lastBackup, openWizard)
			case <-m.update.ClickedCh:
				m.clicked(m.update, openWizard)
			case <-m.backupNow.ClickedCh:
				m.clicked(m.backupNow, openWizard)
			case <-m.updateNow.ClickedCh:
				m.clicked(m.updateNow, openWizard)
			case <-m.pause.ClickedCh:
				m.clicked(m.pause, openWizard)
			case <-m.quit.ClickedCh:
				systray.Quit()
				return
			}
		}
	}()
}

// menu is the tray's menu: what needs a look shows only while it does; the
// rest is one line.
type menu struct {
	root      string
	look      Appearance
	attention bool

	summary, failing, alert, lastBackup, update *systray.MenuItem
	open, header                                *systray.MenuItem
	backupNow, updateNow, pause, quit           *systray.MenuItem

	mu      sync.Mutex
	items   []*systray.MenuItem
	targets []string // each item's address in Open an app

	paused              atomic.Bool
	backingUp, updating atomic.Bool
	appChecked          time.Time
	appNewer            bool
}

func newMenu(root string) *menu {
	m := &menu{root: root, look: LoadAppearance()}
	setIcon(m.look, m.attention)
	systray.SetTooltip("Homelab Wizard")
	m.summary = systray.AddMenuItem("Checking…", "")
	m.summary.Disable()
	m.failing = systray.AddMenuItem("", "Checks the watchdog alerted about; click for Status")
	m.failing.Hide()
	m.alert = systray.AddMenuItem("", "The newest alert from the last 12 hours; click for Status")
	m.alert.Hide()
	m.lastBackup = systray.AddMenuItem("", "The nightly backup is late; click for Backups")
	m.lastBackup.Hide()
	m.update = systray.AddMenuItem("", "Changes waiting on GitHub; click for Setup › Update")
	m.update.Hide()
	systray.AddSeparator()
	m.open = systray.AddMenuItem("Open Homelab Wizard", "")
	m.header = systray.AddMenuItem("Open an app", "")
	m.items, m.targets = make([]*systray.MenuItem, slots), make([]string, slots)
	for i := range m.items {
		m.items[i] = m.header.AddSubMenuItem("", "")
		m.items[i].Hide()
		go func(i int) {
			for range m.items[i].ClickedCh {
				m.mu.Lock()
				target := m.targets[i]
				m.mu.Unlock()
				if target != "" {
					openURL(target)
				}
			}
		}(i)
	}
	systray.AddSeparator()
	m.backupNow = systray.AddMenuItem("Back up now", "Dump databases and copy .env (homelab backup)")
	m.updateNow = systray.AddMenuItem("Update apps now", "Update every app the nightly update would, now (homelab update --all)")
	m.pause = systray.AddMenuItem("Pause nightly updates", "Watchtower pulls new images nightly")
	systray.AddSeparator()
	m.quit = systray.AddMenuItem("Quit", "")
	return m
}

// refresh reads the homelab again and shows it.
func (m *menu) refresh() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	// What the last fetch (the nightly job's, or the app's) found; no
	// network here. A newer app build is asked for once an hour.
	if Commit != "" && time.Since(m.appChecked) >= appCheckEvery {
		m.appChecked = time.Now()
		if r, err := selfupdate.For(ctx, Repo, upgrade.Channel(m.root)); err == nil {
			m.appNewer = r.Newer(Commit)
		}
	}
	r := read(ctx, m.root, m.appNewer, time.Now())
	if r.Attention != m.attention {
		m.attention = r.Attention
		setIcon(m.look, m.attention)
	}
	m.summary.SetTitle(r.Summary)
	if r.Updates != nil {
		m.paused.Store(r.Updates.Paused)
		m.pause.SetTitle(UpdatesTitle(*r.Updates))
	}
	for _, l := range []struct {
		item  *systray.MenuItem
		title string
	}{{m.lastBackup, r.Backup}, {m.update, r.Update}, {m.failing, r.Failing}, {m.alert, r.Alert}} {
		if l.title != "" {
			l.item.SetTitle(l.title)
			l.item.Show()
		} else {
			l.item.Hide()
		}
	}
	systray.SetTooltip("Homelab: " + r.Summary)
	m.mu.Lock()
	defer m.mu.Unlock()
	for i, item := range m.items {
		if i < len(r.Links) {
			m.targets[i] = r.Links[i].URL
			item.SetTitle(r.Links[i].Title)
			item.Show()
		} else {
			m.targets[i] = ""
			item.Hide()
		}
	}
	if len(r.Links) > 0 {
		m.header.Show()
	} else {
		m.header.Hide()
	}
}

// lookAgain follows a colour picked in Settings › Appearance.
func (m *menu) lookAgain() {
	if now := LoadAppearance(); now != m.look {
		m.look = now
		setIcon(m.look, m.attention)
	}
}

// clicked does what a click on item asks.
func (m *menu) clicked(item *systray.MenuItem, openWizard func(string)) {
	switch item {
	case m.open, m.alert, m.failing:
		openWizard("status")
	case m.lastBackup:
		openWizard("backups")
	case m.update:
		openWizard("setup")
	case m.backupNow:
		if m.backingUp.CompareAndSwap(false, true) {
			go func() {
				defer m.backingUp.Store(false)
				runBackup(m.backupNow, m.root)
			}()
		}
	case m.updateNow:
		if m.updating.CompareAndSwap(false, true) {
			go func() {
				defer m.updating.Store(false)
				runUpdateAll(m.updateNow, m.root)
			}()
		}
	case m.pause:
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		s, err := core.SetUpdatesPaused(ctx, m.root, !m.paused.Load())
		cancel()
		if err != nil {
			m.pause.SetTitle(shorten("Updates: "+err.Error(), 70))
		} else {
			m.paused.Store(s.Paused)
			m.pause.SetTitle(UpdatesTitle(s))
		}
	}
}

// Reading is what the menu shows, read once a minute and on each change
// the engine reports. A line that is "" is hidden.
type Reading struct {
	Summary   string // the first line: how the apps are, or why they cannot be read
	Attention bool   // something needs a look: the icon's dot
	Links     []Link // Open an app
	// Updates is whether nightly updates run; nil when Status was not read.
	Updates                        *updates.State
	Backup, Update, Failing, Alert string
}

// read takes the reading for the homelab at root; appNewer is whether a
// newer build of the app was found.
func read(ctx context.Context, root string, appNewer bool, now time.Time) Reading {
	var r Reading
	// The reading the window shares (the agent's), then the pages.
	st, err := core.StatusNow(ctx, root)
	if err == nil && st.Checking {
		api.Probe(ctx, st.Apps)
	}
	if err != nil {
		r.Summary = shorten(err.Error(), 70)
	} else {
		r.Attention = NeedsALook(st) > 0
		r.Summary = Summary(st)
		if st.Savings > 0 {
			r.Summary += " · saves " + savings.Dollars(st.Savings) + "/yr"
		}
		r.Links = Links(st, slots)
		r.Updates = &st.Updates
	}
	if o := backup.Read(root, nil, core.Env(root), now); !o.LastRun.IsZero() {
		r.Backup = BackupTitle(o.LastRun, now)
	}
	behind := 0
	if c, err := upgrade.Inspect(ctx, root, false); err == nil {
		behind = c.Behind
	}
	r.Update = UpdateTitle(behind, appNewer)
	r.Failing = WatchdogTitle(health.LoadState(health.StatePath(root)).Summary())
	if events, err := core.RecentAlerts(ctx, root); err == nil && len(events) > 0 {
		r.Alert = AlertTitle(events[0], now)
	}
	return r
}

// UpdateTitle is the menu item for changes waiting on GitHub and a newer
// build of the app; "" when there are none.
func UpdateTitle(behind int, app bool) string {
	switch {
	case behind == 1:
		return "Update ready: 1 new change"
	case behind > 1:
		return fmt.Sprintf("Update ready: %d new changes", behind)
	case app:
		return "Update ready: a new Homelab Wizard"
	}
	return ""
}

// NeedsALook counts the apps that need a look: unwell, not answering, or
// baseline apps that are not running.
func NeedsALook(st api.Status) int {
	n := st.Missing
	for _, a := range st.Apps {
		if a.Health == "unhealthy" || a.Health == "restarting" || a.NotAnswering != "" {
			n++
		}
	}
	return n
}

// Summary is the one-line state shown at the top of the menu.
func Summary(st api.Status) string {
	running, unhealthy := 0, 0
	for _, a := range st.Apps {
		if a.State == "running" {
			running++
		}
		if a.Health == "unhealthy" || a.Health == "restarting" || a.NotAnswering != "" {
			unhealthy++ // a page that does not answer is unwell too
		}
	}
	total := len(st.Apps)
	switch {
	case total == 0:
		return "No apps yet"
	case running == total && unhealthy == 0:
		return fmt.Sprintf("%d apps running · all healthy", total)
	case unhealthy == 0:
		return fmt.Sprintf("%d of %d apps running", running, total)
	}
	return fmt.Sprintf("%d of %d apps running · %d unhealthy", running, total, unhealthy)
}

// UpdatesTitle is the pause/resume item's title.
func UpdatesTitle(s updates.State) string {
	if s.Paused {
		return "Resume nightly updates"
	}
	return "Pause nightly updates"
}

// Link is a quick link in the menu.
type Link struct{ Title, URL string }

// Links are the running apps with an address, by name; the homelab domain
// address when there is one, else the address on this machine.
func Links(st api.Status, n int) []Link {
	var out []Link
	for _, a := range st.Apps {
		if a.State != "running" || len(out) == n {
			continue
		}
		switch {
		case a.Address != "":
			out = append(out, Link{a.Name, "https://" + a.Address})
		case a.URL != "":
			out = append(out, Link{a.Name, a.URL})
		}
	}
	return out
}

// BackupTitle is the menu line for a late backup, older than a nightly run
// should be; "" while backups are on time.
func BackupTitle(last, now time.Time) string {
	d := now.Sub(last)
	when := fmt.Sprintf("%dh ago", int(d.Hours()))
	switch {
	case d < time.Hour:
		when = "under an hour ago"
	case d >= 48*time.Hour:
		when = fmt.Sprintf("%d days ago", int(d.Hours()/24))
	}
	if d > backup.StaleAfter {
		return "Last backup " + when + "  —  check Backups"
	}
	return ""
}

// WatchdogTitle is the menu line for the checks the watchdog alerted
// about; "" when none are failing.
func WatchdogTitle(s health.Summary) string {
	switch len(s.Failing) {
	case 0:
		return ""
	case 1:
		return shorten("Failing: "+s.Failing[0].Name, 60)
	}
	names := make([]string, len(s.Failing))
	for i, f := range s.Failing {
		names[i] = f.Name
	}
	return shorten(fmt.Sprintf("%d checks failing: %s", len(s.Failing), strings.Join(names, ", ")), 60)
}

// AlertTitle is the menu line for the newest alert: its title (or message)
// and how long ago it came.
func AlertTitle(e notify.Event, now time.Time) string {
	text := e.Title
	if text == "" {
		text = e.Message
	}
	ago := "just now"
	switch d := now.Sub(e.Time); {
	case d >= time.Hour:
		ago = fmt.Sprintf("%dh ago", int(d.Hours()))
	case d >= time.Minute:
		ago = fmt.Sprintf("%dm ago", int(d.Minutes()))
	}
	return shorten("Alert: "+text, 56) + "  —  " + ago
}

func shorten(s string, n int) string {
	if r := []rune(s); len(r) > n {
		return string(r[:n-1]) + "…"
	}
	return s
}

// titled is a menu item whose title a job changes as it goes.
type titled interface{ SetTitle(string) }

// runBackup runs `homelab backup --apply` for the homelab folder, with the
// CLI the app uses (the folder's, or its own on a machine without Go).
func runBackup(item titled, root string) {
	item.SetTitle("Back up now  —  backing up…")
	err := core.CLI(root, "backup", "--apply").Run()
	if err != nil {
		item.SetTitle("Back up now  —  failed; run homelab backup to see why")
		return
	}
	item.SetTitle("Back up now  —  done " + time.Now().Format("15:04"))
}

// runUpdateAll runs `homelab update --all --apply`: every app the nightly
// update would update, now, each app's databases dumped first.
func runUpdateAll(item titled, root string) {
	item.SetTitle("Update apps now  —  updating…")
	if err := core.CLI(root, "update", "--all", "--apply").Run(); err != nil {
		item.SetTitle("Update apps now  —  failed; run homelab update --all to see why")
		return
	}
	item.SetTitle("Update apps now  —  done " + time.Now().Format("15:04"))
}

func openURL(u string) {
	switch goos {
	case "darwin":
		_ = start(exec.Command("open", u))
	case "windows":
		_ = start(exec.Command("rundll32", "url.dll,FileProtocolHandler", u))
	default:
		_ = start(exec.Command("xdg-open", u))
	}
}

// goos and start are the system and how a program starts; tests replace them.
var (
	goos  = runtime.GOOS
	start = (*exec.Cmd).Start
)
