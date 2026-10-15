// Package tray is the menu bar item (macOS) or tray icon (Windows, Linux):
// how the homelab is doing, quick links to its apps, a backup, and a way
// back into Homelab Wizard. It runs as its own process, one at a time.
package tray

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"fyne.io/systray"
	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/backup"
	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/notify"
	"github.com/Snooper42/homelab-wizard/internal/savings"
	"github.com/Snooper42/homelab-wizard/internal/updates"
	"github.com/Snooper42/homelab-wizard/internal/upgrade"
)

// lockAddr is held while a tray runs, so a second one exits at once.
const lockAddr = "127.0.0.1:47231"

// slots is how many quick links the menu has room for.
const slots = 8

// Run shows the item until Quit. openWizard opens the app on a screen
// ("choose" or "status").
func Run(openWizard func(screen string)) {
	l, err := net.Listen("tcp", lockAddr)
	if err != nil {
		return // another tray is running
	}
	defer l.Close()
	systray.Run(func() { onReady(openWizard) }, func() {})
}

func onReady(openWizard func(string)) {
	hideDockIcon()
	if runtime.GOOS == "darwin" {
		icon := iconPNG(false)
		systray.SetTemplateIcon(icon, icon)
	} else if runtime.GOOS == "windows" {
		systray.SetIcon(ico(iconPNG(true)))
	} else {
		systray.SetIcon(iconPNG(true))
	}
	systray.SetTooltip("Homelab Wizard")

	summary := systray.AddMenuItem("Checking…", "")
	summary.Disable()
	saving := systray.AddMenuItem("", "From docs/Savings.md")
	saving.Disable()
	saving.Hide()
	failing := systray.AddMenuItem("", "Checks the watchdog alerted about; click for Status")
	failing.Hide()
	alert := systray.AddMenuItem("", "The newest alert from the last 12 hours; click for Status")
	alert.Hide()
	lastBackup := systray.AddMenuItem("", "When the nightly backup last ran; click for Backups")
	lastBackup.Hide()
	update := systray.AddMenuItem("", "Changes waiting on GitHub; click for Setup › Get the update")
	update.Hide()
	systray.AddSeparator()
	header := systray.AddMenuItem("Open", "")
	header.Disable()
	var mu sync.Mutex
	items, targets := make([]*systray.MenuItem, slots), make([]string, slots)
	for i := range items {
		items[i] = systray.AddMenuItem("", "")
		items[i].Hide()
		go func(i int) {
			for range items[i].ClickedCh {
				mu.Lock()
				target := targets[i]
				mu.Unlock()
				if target != "" {
					openURL(target)
				}
			}
		}(i)
	}
	systray.AddSeparator()
	add := systray.AddMenuItem("Add apps…", "")
	open := systray.AddMenuItem("Open Homelab Wizard", "")
	backupNow := systray.AddMenuItem("Back up now", "Dump databases and copy .env (homelab backup)")
	pause := systray.AddMenuItem("Pause nightly updates", "Watchtower pulls new images nightly")
	var paused atomic.Bool
	systray.AddSeparator()
	checked := systray.AddMenuItem("", "")
	checked.Disable()
	quit := systray.AddMenuItem("Quit", "")

	refresh := func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		st, err := core.Status(ctx, core.Root())
		checked.SetTitle("Last check " + time.Now().Format("15:04"))
		var links []Link
		if err != nil {
			summary.SetTitle(shorten(err.Error(), 70))
		} else {
			summary.SetTitle(Summary(st))
			links = Links(st, slots)
			if st.Savings > 0 {
				saving.SetTitle("Replacing " + savings.Dollars(st.Savings) + " a year in subscriptions")
				saving.Show()
			} else {
				saving.Hide()
			}
			paused.Store(st.Updates.Paused)
			pause.SetTitle(UpdatesTitle(st.Updates))
		}
		if o := backup.Read(core.Root(), nil, core.Env(core.Root()), time.Now()); !o.LastRun.IsZero() {
			lastBackup.SetTitle(BackupTitle(o.LastRun, time.Now()))
			lastBackup.Show()
		} else {
			lastBackup.Hide()
		}
		// What the last fetch (the nightly job's, or the app's) found; no
		// network here.
		if c, err := upgrade.Inspect(ctx, core.Root(), false); err == nil && c.Behind > 0 {
			update.SetTitle(UpdateTitle(c.Behind))
			update.Show()
		} else {
			update.Hide()
		}
		if t := WatchdogTitle(health.LoadState(health.StatePath(core.Root())).Summary()); t != "" {
			failing.SetTitle(t)
			failing.Show()
		} else {
			failing.Hide()
		}
		if events, err := core.RecentAlerts(ctx, core.Root()); err == nil && len(events) > 0 {
			alert.SetTitle(AlertTitle(events[0], time.Now()))
			alert.Show()
		} else {
			alert.Hide()
		}
		systray.SetTooltip("Homelab: " + summary.String())
		mu.Lock()
		defer mu.Unlock()
		for i, item := range items {
			if i < len(links) {
				targets[i] = links[i].URL
				item.SetTitle(links[i].Title)
				item.Show()
			} else {
				targets[i] = ""
				item.Hide()
			}
		}
		if len(links) > 0 {
			header.Show()
		} else {
			header.Hide()
		}
	}
	var backingUp atomic.Bool
	go func() {
		refresh()
		tick := time.NewTicker(time.Minute)
		for {
			select {
			case <-tick.C:
				refresh()
			case <-add.ClickedCh:
				openWizard("choose")
			case <-open.ClickedCh:
				openWizard("status")
			case <-alert.ClickedCh:
				openWizard("status")
			case <-failing.ClickedCh:
				openWizard("status")
			case <-lastBackup.ClickedCh:
				openWizard("backups")
			case <-update.ClickedCh:
				openWizard("setup")
			case <-backupNow.ClickedCh:
				if backingUp.CompareAndSwap(false, true) {
					go func() {
						defer backingUp.Store(false)
						runBackup(backupNow)
					}()
				}
			case <-pause.ClickedCh:
				ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
				s, err := core.SetUpdatesPaused(ctx, core.Root(), !paused.Load())
				cancel()
				if err != nil {
					pause.SetTitle(shorten("Updates: "+err.Error(), 70))
				} else {
					paused.Store(s.Paused)
					pause.SetTitle(UpdatesTitle(s))
				}
			case <-quit.ClickedCh:
				systray.Quit()
				return
			}
		}
	}()
}

// UpdateTitle is the menu item for changes waiting on GitHub.
func UpdateTitle(behind int) string {
	if behind == 1 {
		return "Update ready: 1 new change"
	}
	return fmt.Sprintf("Update ready: %d new changes", behind)
}

// Summary is the one-line state shown at the top of the menu.
func Summary(st api.Status) string {
	running, unhealthy := 0, 0
	for _, a := range st.Apps {
		if a.State == "running" {
			running++
		}
		if a.Health == "unhealthy" || a.Health == "restarting" {
			unhealthy++
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
		return "Resume nightly updates  —  paused"
	}
	return "Pause nightly updates  —  " + s.Schedule
}

// Link is a quick link in the menu.
type Link struct{ Title, URL string }

// Links are the running apps with an address, the domain name first.
func Links(st api.Status, n int) []Link {
	var out []Link
	for _, a := range st.Apps {
		if a.State != "running" || len(out) == n {
			continue
		}
		switch {
		case a.Address != "":
			out = append(out, Link{a.Name + "  —  " + strings.SplitN(a.Address, ".", 2)[0], "https://" + a.Address})
		case a.URL != "":
			host := a.URL
			if u, err := url.Parse(a.URL); err == nil {
				host = u.Host
			}
			out = append(out, Link{a.Name + "  —  " + host, a.URL})
		}
	}
	return out
}

// BackupTitle is the menu line for the last backup, with a warning when it
// is older than a nightly run should be.
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
	return "Last backup " + when
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

// runBackup runs `homelab backup --apply` for the homelab folder, with the
// CLI the app uses (the folder's, or its own on a machine without Go).
func runBackup(item *systray.MenuItem) {
	item.SetTitle("Back up now  —  backing up…")
	err := core.CLI(core.Root(), "backup", "--apply").Run()
	if err != nil {
		item.SetTitle("Back up now  —  failed; run homelab backup to see why")
		return
	}
	item.SetTitle("Back up now  —  done " + time.Now().Format("15:04"))
}

func openURL(u string) {
	switch runtime.GOOS {
	case "darwin":
		_ = exec.Command("open", u).Start()
	case "windows":
		_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", u).Start()
	default:
		_ = exec.Command("xdg-open", u).Start()
	}
}
