// Package tray is the menu bar item (macOS) or tray icon (Windows, Linux):
// how the homelab is doing, quick links to its apps, a backup, and a way
// back into Homelab Wizard. It runs as its own process, one at a time.
package tray

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"fyne.io/systray"
	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/crash"
	"github.com/Snooper42/homelab-wizard/internal/engine"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/host"
	"github.com/Snooper42/homelab-wizard/internal/notify"
	"github.com/Snooper42/homelab-wizard/internal/progress"
	"github.com/Snooper42/homelab-wizard/internal/savings"
	"github.com/Snooper42/homelab-wizard/internal/selfupdate"
	"github.com/Snooper42/homelab-wizard/internal/settings"
	"github.com/Snooper42/homelab-wizard/internal/ui"
	"github.com/Snooper42/homelab-wizard/internal/updates"
	"github.com/Snooper42/homelab-wizard/internal/upgrade"
)

// Commit and Repo are the build this tray belongs to and where its builds
// are published, set with -ldflags "-X .../app/tray.Commit=..."; empty in a
// local build, which is never offered an app update.
var Commit, Repo, Version string

// lookEvery is how old the app's last look for updates (found.json) may be
// before the tray looks itself: with the window closed, the same 15
// minutes as the app's.
const lookEvery = 15 * time.Minute

// slots is how many lines the Open an app submenu has room for: the
// categories' names and their apps.
const slots = 48

// lookSlots is how many lines say what needs a look, one per app.
const lookSlots = 3

// Run shows the item until Quit. openWizard opens the app on a screen
// ("choose" or "status").
func Run(openWizard func(screen string)) {
	l, err := net.Listen("tcp", core.TrayAddr)
	if err != nil {
		return // another tray is running
	}
	defer l.Close()
	go quitWhenAsked(l)
	if root := core.Root(); root != "" {
		_ = crash.Watch(filepath.Join(root, "scripts", "logs"), "tray", Version)
	}
	systray.Run(func() { onReady(openWizard) }, func() {})
}

// quitWhenAsked quits the tray when a "quit" line arrives on its address
// (core.QuitTray, from homelab quit).
func quitWhenAsked(l net.Listener) {
	for {
		c, err := l.Accept()
		if err != nil {
			return
		}
		_ = c.SetReadDeadline(time.Now().Add(time.Second))
		buf := make([]byte, 16)
		n, _ := c.Read(buf)
		c.Close()
		if strings.TrimSpace(string(buf[:n])) == "quit" {
			systray.Quit()
			return
		}
	}
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
			case <-m.summary.ClickedCh:
				m.clicked(m.summary, openWizard)
			case <-m.open.ClickedCh:
				m.clicked(m.open, openWizard)
			case <-m.alert.ClickedCh:
				m.clicked(m.alert, openWizard)
			case <-m.failing.ClickedCh:
				m.clicked(m.failing, openWizard)
			case <-m.lastBackup.ClickedCh:
				m.clicked(m.lastBackup, openWizard)
			case <-m.looks[0].ClickedCh:
				m.clicked(m.looks[0], openWizard)
			case <-m.looks[1].ClickedCh:
				m.clicked(m.looks[1], openWizard)
			case <-m.looks[2].ClickedCh:
				m.clicked(m.looks[2], openWizard)
			case <-m.every.ClickedCh:
				m.clicked(m.every, openWizard)
			case <-m.update.ClickedCh:
				m.clicked(m.update, openWizard)
			case <-m.backupNow.ClickedCh:
				m.clicked(m.backupNow, openWizard)
			case <-m.updateNow.ClickedCh:
				m.clicked(m.updateNow, openWizard)
			case <-m.pause.ClickedCh:
				m.clicked(m.pause, openWizard)
			case <-m.awake.ClickedCh:
				m.clicked(m.awake, openWizard)
			case <-m.quit.ClickedCh:
				// Quit stops the whole homelab, so the app asks first;
				// homelab quit then quits this item too.
				openWizard("quit")
			}
		}
	}()
}

// menu is the tray's menu, as in the mockup the owner approved: how the
// homelab is, at a glance (a dot and the apps running, then how many need
// a look); only what needs a look (each app, the watchdog, an alert, the
// last backup, an update); then Open Homelab Wizard, the apps by category,
// the jobs, Keep … awake, and Quit.
type menu struct {
	root      string
	look      Appearance
	attention bool

	summary, status                          *systray.MenuItem
	looks                                    [lookSlots]*systray.MenuItem
	failing, alert, lastBackup, update       *systray.MenuItem
	open, header, every                      *systray.MenuItem
	backupNow, updateNow, pause, awake, quit *systray.MenuItem

	mu      sync.Mutex
	items   []*systray.MenuItem
	targets []string // each line's address in Open an app; "" opens Status
	dots    map[*systray.MenuItem]Dot

	paused              atomic.Bool
	backingUp, updating atomic.Bool
	found               Found     // the last look for updates
	checked             time.Time // the last good reading
	cat                 *catalog.Catalog
	catRead             time.Time
}

func newMenu(root string) *menu {
	m := &menu{root: root, look: LoadAppearance(), dots: map[*systray.MenuItem]Dot{}}
	setIcon(m.look, m.attention)
	systray.SetTooltip("Homelab Wizard")
	// The first line reads as a heading and opens Status; the one under
	// it is its grey subtitle. Every line up to the first separator has a
	// mark, so their words line up.
	m.summary = systray.AddMenuItem("Checking…", "Click for Status")
	m.setDot(m.summary, DotOff)
	m.status = systray.AddMenuItem("", "")
	m.status.Disable()
	m.setDot(m.status, DotNone)
	m.status.Hide()
	for i := range m.looks {
		m.looks[i] = systray.AddMenuItem("", "Click for Status")
		m.looks[i].Hide()
	}
	m.failing = systray.AddMenuItem("", "Checks the watchdog alerted about; click for Status")
	m.failing.Hide()
	m.alert = systray.AddMenuItem("", "The newest alert from the last 12 hours; click for Status")
	m.alert.Hide()
	m.lastBackup = systray.AddMenuItem("", "The nightly backup; click for Backups")
	m.lastBackup.Hide()
	m.update = systray.AddMenuItem("", "Opens Homelab Wizard and updates it: the homelab files, then the app")
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
				} else {
					m.every.ClickedCh <- struct{}{}
				}
			}
		}(i)
	}
	m.header.AddSeparator()
	m.every = m.header.AddSubMenuItem(everyApp(), "Status, with every app and what it is doing")
	systray.AddSeparator()
	m.backupNow = systray.AddMenuItem("Back up now", "Dump databases and copy .env (homelab backup)")
	m.updateNow = systray.AddMenuItem("Update apps now", "Update every app the nightly update would, now (homelab update --all)")
	m.pause = systray.AddMenuItem("Pause nightly updates", "Watchtower pulls new images nightly")
	// Ticked while the homelab keeps this machine awake on power
	// (KEEP_AWAKE, on unless turned off), so it is never a surprise.
	m.awake = systray.AddMenuItemCheckbox(host.Current().KeepAwakeItem(), "The apps stay reachable; the screen still turns off (KEEP_AWAKE in Settings)", KeepAwake(root))
	systray.AddSeparator()
	m.quit = systray.AddMenuItem("Quit Homelab Wizard…", "Stops the homelab: the apps, the background jobs, and this item; asks first")
	return m
}

// everyApp is the submenu's last line, which opens Status: on a Mac it
// says where, elsewhere an ellipsis does, as the mockup has it.
func everyApp() string {
	if runtime.GOOS == "darwin" {
		return "Every app, in Homelab Wizard"
	}
	return "Every app…"
}

// setDot shows d beside item, when it changed: an .ico on Windows, a PNG
// elsewhere.
func (m *menu) setDot(item *systray.MenuItem, d Dot) {
	if old, ok := m.dots[item]; ok && old == d {
		return
	}
	m.dots[item] = d
	icon := dotPNG(d)
	if runtime.GOOS == "windows" {
		icon = ico(icon)
	}
	item.SetIcon(icon)
}

// catalogNow is the homelab's catalog, read again every ten minutes, for
// the apps' categories.
func (m *menu) catalogNow() *catalog.Catalog {
	if m.cat == nil || time.Since(m.catRead) > 10*time.Minute {
		if c, err := core.Catalog(m.root); err == nil {
			m.cat, m.catRead = c, time.Now()
		}
	}
	return m.cat
}

// refresh reads the homelab again and shows it.
func (m *menu) refresh() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	// The app's last look for updates; with the window closed it is not
	// kept fresh, so the tray looks itself.
	m.found = LoadFound()
	if Commit != "" && time.Now().Round(0).Sub(m.found.Looked.Round(0)) >= lookEvery {
		m.found = look(ctx, m.root)
		_ = SaveFound(m.found)
	}
	now := time.Now()
	r := read(ctx, m.root, m.catalogNow(), m.found, now)
	if r.Read {
		m.checked = now
	}
	if r.Attention != m.attention {
		m.attention = r.Attention
		setIcon(m.look, m.attention)
	}
	m.summary.SetTitle(r.Summary)
	m.setDot(m.summary, r.Dot)
	if r.Read {
		m.summary.Enable()
	} else {
		m.summary.Disable() // why it cannot read the homelab: nothing to open
	}
	if m.checked.IsZero() {
		m.status.Hide()
	} else {
		m.status.SetTitle(StatusLine(r.Needs, m.checked, now))
		m.status.Show()
	}
	for i, item := range m.looks {
		if i < len(r.Looks) {
			item.SetTitle(r.Looks[i])
			m.setDot(item, DotLook)
			item.Show()
		} else {
			item.Hide()
		}
	}
	if r.Updates != nil {
		m.paused.Store(r.Updates.Paused)
		m.pause.SetTitle(UpdatesTitle(*r.Updates))
	}
	for _, l := range []struct {
		item  *systray.MenuItem
		title string
		dot   Dot
	}{{m.failing, r.Failing, DotLook}, {m.alert, r.Alert, DotLook}, {m.lastBackup, r.Backup, r.BackupDot}, {m.update, r.Update, DotUpdate}} {
		if l.title != "" {
			l.item.SetTitle(l.title)
			m.setDot(l.item, l.dot)
			l.item.Show()
		} else {
			l.item.Hide()
		}
	}
	if r.FailingTip != "" {
		m.failing.SetTooltip(r.FailingTip)
	}
	tip := "Homelab: " + r.Summary
	if r.Savings != "" {
		tip += " · saves " + r.Savings + "/yr"
	}
	systray.SetTooltip(tip)
	m.awake.SetTitle(host.Current().KeepAwakeItem())
	if KeepAwake(m.root) {
		m.awake.Check()
	} else {
		m.awake.Uncheck()
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	for i, item := range m.items {
		if i < len(r.Entries) {
			e := r.Entries[i]
			m.targets[i] = e.URL
			item.SetTitle(e.Title)
			m.setDot(item, e.Dot)
			if e.Header {
				item.Disable()
			} else {
				item.Enable()
			}
			item.Show()
		} else {
			m.targets[i] = ""
			item.Hide()
		}
	}
	if len(r.Entries) > 0 {
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
	case m.summary, m.open, m.alert, m.failing, m.looks[0], m.looks[1], m.looks[2], m.every:
		openWizard("status")
	case m.lastBackup:
		openWizard("backups")
	case m.update:
		openWizard("update")
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
	case m.awake:
		on := !m.awake.Checked()
		if err := SetKeepAwake(m.root, on); err != nil {
			m.awake.SetTitle(shorten("Keep awake: "+err.Error(), 70))
			return
		}
		if on {
			m.awake.Check()
		} else {
			m.awake.Uncheck()
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
	Summary   string // the first line: how many apps run, or why they cannot be read
	Dot       Dot    // beside it
	Read      bool   // the homelab was read (the runtime answered)
	Needs     int    // how many need a look
	Looks     []string
	Attention bool    // something needs a look: the icon's dot
	Entries   []Entry // Open an app
	Savings   string  // what the running apps replace a year, for the tooltip
	// Updates is whether nightly updates run; nil when Status was not read.
	Updates                        *updates.State
	Backup, Update, Failing, Alert string
	BackupDot                      Dot    // the backup line's tick, or dot once late
	FailingTip                     string // the failing checks by name
}

// read takes the reading for the homelab at root, its apps' categories
// from c (nil: one list); found is the last look for updates
// was found.
func read(ctx context.Context, root string, c *catalog.Catalog, found Found, now time.Time) Reading {
	var r Reading
	// The reading the window shares (the agent's), then the pages.
	st, err := core.StatusNow(ctx, root)
	if err == nil && st.Checking {
		api.Probe(ctx, st.Apps)
	}
	if err != nil {
		r.Summary, r.Dot = shorten(err.Error(), 70), DotDown
	} else {
		r.Read = true
		r.Needs = NeedsALook(st)
		r.Attention = r.Needs > 0
		r.Summary, r.Dot = Summary(st), SummaryDot(st)
		r.Looks = Looks(st, lookSlots)
		if st.Savings > 0 {
			r.Savings = savings.Dollars(st.Savings)
		}
		r.Entries = Entries(st, c, slots)
		r.Updates = &st.Updates
	}
	if o := backup.Read(root, nil, core.Env(root), now); !o.LastRun.IsZero() {
		r.Backup = BackupTitle(o.LastRun, now, runtime.GOOS == "linux")
		r.BackupDot = BackupDot(o.LastRun, now)
	}
	r.Update = UpdateItem(found)
	watch := health.LoadState(health.StatePath(root)).Summary()
	r.Failing, r.FailingTip = WatchdogTitle(watch), WatchdogTip(watch)
	if events, err := core.RecentAlerts(ctx, root); err == nil && len(events) > 0 {
		r.Alert = AlertTitle(events[0], now)
	}
	return r
}

// look asks GitHub for the homelab files and a newer build of the app, as
// the app's own look does, while the window is closed.
func look(ctx context.Context, root string) Found {
	f := Found{Looked: time.Now()}
	version := ""
	if c, err := upgrade.Inspect(ctx, root, true); err == nil {
		f.Ready = c.Behind > 0 && c.Ahead == 0 && !c.Kit
		if c.NewVersion != c.Version {
			version = c.NewVersion
		}
	}
	if r, err := selfupdate.For(ctx, Repo, upgrade.Channel(root)); err == nil && r.Newer(Commit) && selfupdate.CanInstall(r) {
		f.Ready = true
		if r.Version != "" {
			version = strings.TrimPrefix(r.Version, "v")
		}
	}
	if f.Ready {
		f.Version = version
	}
	return f
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

// KeepAwake reports whether the homelab keeps this machine awake on power:
// KEEP_AWAKE in the homelab at root, on unless it says false.
func KeepAwake(root string) bool {
	return !strings.EqualFold(strings.TrimSpace(core.Env(root)["KEEP_AWAKE"]), "false")
}

// SetKeepAwake turns KEEP_AWAKE on or off, as Settings does; the awake job
// follows it within a minute.
func SetKeepAwake(root string, on bool) error {
	return settings.Save(root, map[string]string{"KEEP_AWAKE": strconv.FormatBool(on)})
}

// UpdatesTitle is the pause/resume item's title.
func UpdatesTitle(s updates.State) string {
	if s.Paused {
		return "Resume nightly updates"
	}
	return "Pause nightly updates"
}

// WatchdogTitle is the menu line for the checks the watchdog alerted
// about, short enough to read in a menu (the names are in WatchdogTip);
// "" when none are failing.
func WatchdogTitle(s health.Summary) string {
	switch len(s.Failing) {
	case 0:
		return ""
	case 1:
		return shorten("Check failing: "+s.Failing[0].Name, 48)
	}
	return fmt.Sprintf("%d watchdog checks failing", len(s.Failing))
}

// WatchdogTip names each failing check, for the line's tooltip.
func WatchdogTip(s health.Summary) string {
	if len(s.Failing) == 0 {
		return ""
	}
	names := make([]string, len(s.Failing))
	for i, f := range s.Failing {
		names[i] = f.Name
	}
	return strings.Join(names, ", ") + "; click for Status"
}

// AlertTitle is the menu line for the newest alert: its title (or message)
// and how long ago it came.
func AlertTitle(e notify.Event, now time.Time) string {
	text := e.Title
	if text == "" {
		text = e.Message
	}
	return shorten(text, 48) + " · " + ago(now.Sub(e.Time))
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
	runJob(item, root, "Back up now", "backing up…", "failed; run homelab backup to see why", "backup", "--apply")
}

// runUpdateAll runs `homelab update --all --apply`: every app the nightly
// update would update, now, each app's databases dumped first.
func runUpdateAll(item titled, root string) {
	runJob(item, root, "Update apps now", "updating…", "failed; run homelab update --all to see why", "update", "--all", "--apply")
}

// runJob runs a homelab command for a menu item, whose title follows it:
// the step it is at, and the app Compose is working on, as the window's
// job bar does.
func runJob(item titled, root, label, busy, failed string, args ...string) {
	item.SetTitle(label + "  —  " + busy)
	c := core.CLI(root, args...)
	c.Env = append(os.Environ(), "HOMELAB_PROGRESS=json")
	follow := newFollower(item, root, label)
	c.Stdout, c.Stderr = follow, follow
	if err := c.Run(); err != nil {
		item.SetTitle(label + "  —  " + failed)
		return
	}
	item.SetTitle(label + "  —  done " + time.Now().Format("15:04"))
}

// follower reads a job's output (its steps as JSON, and Compose's lines)
// into its menu item's title.
type follower struct {
	item  titled
	label string
	names map[string]string // app ID → name, for the steps' IDs
	apps  *progress.Tracker
	step  string // the step it is at: "Updating Vikunja · 2 of 5"
	mu    sync.Mutex
	buf   []byte
	shown string
}

func newFollower(item titled, root, label string) *follower {
	f := &follower{item: item, label: label, names: map[string]string{}}
	if c, err := core.Catalog(root); err == nil {
		for _, a := range c.Apps {
			f.names[a.ID] = a.Name()
		}
		f.apps = progress.New(c, core.Env(root))
	}
	return f
}

func (f *follower) Write(p []byte) (int, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.buf = append(f.buf, p...)
	for {
		i := strings.IndexAny(string(f.buf), "\r\n")
		if i < 0 {
			break
		}
		f.line(string(f.buf[:i]))
		f.buf = f.buf[i+1:]
	}
	return len(p), nil
}

var appID = regexp.MustCompile(`[a-z0-9][a-z0-9-]*[a-z0-9]`)

func (f *follower) line(s string) {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, stepPrefix) {
		var ev struct{ Data ui.StepEvent }
		if json.Unmarshal([]byte(s), &ev) != nil {
			return
		}
		d := ev.Data
		text := appID.ReplaceAllStringFunc(d.Text, func(w string) string {
			if n := f.names[w]; n != "" {
				return n
			}
			return w
		})
		if d.Percent > 0 {
			text += fmt.Sprintf(" · %d%%", d.Percent)
		}
		f.step = text
		if d.Total > 1 {
			f.step += fmt.Sprintf(" · %d of %d", d.N, d.Total)
		}
		f.show(f.step)
		return
	}
	if f.apps == nil {
		return
	}
	ups, _ := f.apps.Line(s)
	if len(ups) == 0 {
		return
	}
	u := ups[len(ups)-1]
	if f.step != "" {
		f.show(f.step + ": " + u.Name + " " + strings.ToLower(u.Words))
	} else {
		f.show(u.Name + ": " + u.Words)
	}
}

// show sets the title when it changed, kept short for the menu.
func (f *follower) show(s string) {
	if t := f.label + "  —  " + shorten(s, 60); t != f.shown {
		f.shown = t
		f.item.SetTitle(t)
	}
}

// stepPrefix starts the CLI's step lines (ui.Step).
const stepPrefix = `{"schema":1,"type":"step"`

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
