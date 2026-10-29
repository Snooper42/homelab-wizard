// Package schedule runs homelab jobs as you: launchd LaunchAgents on macOS
// (your login session, where OrbStack's engine lives) and systemd user
// units on Linux.
package schedule

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"
)

// Job is one scheduled command.
type Job struct {
	Label       string // e.g. com.homelab.backup
	Description string
	Args        []string // arguments to the homelab binary
	RunAtLoad   bool     // run when you log in
	Interval    int      // seconds between runs (0 = none)
	Hour        int      // daily at Hour:Minute when Daily is set
	Minute      int
	Daily       bool
	// KeepAlive jobs run all the time: restarted when they fail, left
	// stopped when they exit cleanly (switched off in .env).
	KeepAlive bool
}

// When describes the schedule for people.
func (j Job) When() string {
	var parts []string
	if j.KeepAlive {
		return "always"
	}
	if j.RunAtLoad {
		parts = append(parts, "at login")
	}
	if j.Daily {
		parts = append(parts, fmt.Sprintf("daily at %02d:%02d", j.Hour, j.Minute))
	}
	if j.Interval > 0 {
		parts = append(parts, fmt.Sprintf("every %d min", j.Interval/60))
	}
	return strings.Join(parts, ", ")
}

func esc(s string) string {
	var b bytes.Buffer
	_ = xml.EscapeText(&b, []byte(s))
	return b.String()
}

// Plist renders the LaunchAgent. bin is the homelab binary, root the repo,
// logDir where stdout/stderr go, and path the PATH the job runs with
// (launchd starts jobs with a minimal one).
func (j Job) Plist(bin, root, logDir, path string) []byte {
	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
`)
	fmt.Fprintf(&b, "\t<key>Label</key>\n\t<string>%s</string>\n", esc(j.Label))
	b.WriteString("\t<key>ProgramArguments</key>\n\t<array>\n")
	for _, a := range append([]string{bin, "--root", root, "--no-color"}, j.Args...) {
		fmt.Fprintf(&b, "\t\t<string>%s</string>\n", esc(a))
	}
	b.WriteString("\t</array>\n")
	fmt.Fprintf(&b, "\t<key>WorkingDirectory</key>\n\t<string>%s</string>\n", esc(root))
	fmt.Fprintf(&b, "\t<key>EnvironmentVariables</key>\n\t<dict>\n\t\t<key>PATH</key>\n\t\t<string>%s</string>\n\t</dict>\n", esc(path))
	if j.RunAtLoad {
		b.WriteString("\t<key>RunAtLoad</key>\n\t<true/>\n")
	}
	if j.KeepAlive {
		b.WriteString("\t<key>KeepAlive</key>\n\t<dict>\n\t\t<key>SuccessfulExit</key>\n\t\t<false/>\n\t</dict>\n")
	}
	if j.Interval > 0 {
		fmt.Fprintf(&b, "\t<key>StartInterval</key>\n\t<integer>%d</integer>\n", j.Interval)
	}
	if j.Daily {
		fmt.Fprintf(&b, "\t<key>StartCalendarInterval</key>\n\t<dict>\n\t\t<key>Hour</key>\n\t\t<integer>%d</integer>\n\t\t<key>Minute</key>\n\t\t<integer>%d</integer>\n\t</dict>\n", j.Hour, j.Minute)
	}
	if id := BundleID(bin); id != "" {
		// Login Items shows the jobs under Homelab Wizard, with its icon,
		// instead of one anonymous "homelab" entry each.
		fmt.Fprintf(&b, "\t<key>AssociatedBundleIdentifiers</key>\n\t<array>\n\t\t<string>%s</string>\n\t</array>\n", esc(id))
	}
	// A Mac's path, written with its own separator.
	logFile := strings.TrimSuffix(filepath.ToSlash(logDir), "/") + "/" + strings.TrimPrefix(j.Label, "com.homelab.") + ".log"
	fmt.Fprintf(&b, "\t<key>StandardOutPath</key>\n\t<string>%s</string>\n\t<key>StandardErrorPath</key>\n\t<string>%s</string>\n", esc(logFile), esc(logFile))
	b.WriteString("</dict>\n</plist>\n")
	return []byte(b.String())
}

// AppBundle is where Homelab Wizard is installed on a Mac, for jobs whose
// binary is not inside it (a git checkout's ./homelab).
var AppBundle = "/Applications/Homelab Wizard.app"

// AgentBinary is the CLI inside the installed app's agent bundle, which
// Login Items names Homelab Wizard with the app's icon; "" when there is
// none (not a Mac, or an app from before the bundle).
func AgentBinary() string {
	if runtime.GOOS != "darwin" {
		return ""
	}
	p := filepath.Join(AppBundle, "Contents", "Library", "LoginItems", "Homelab Wizard Agent.app", "Contents", "MacOS", "homelab")
	if fi, err := os.Stat(p); err != nil || fi.IsDir() {
		return ""
	}
	return p
}

var bundleIDRe = regexp.MustCompile(`<key>CFBundleIdentifier</key>\s*<string>([^<]+)</string>`)

// BundleID is the bundle identifier of the app bin lives in, or of the
// installed Homelab Wizard; "" when neither is found.
func BundleID(bin string) string {
	app := AppBundle
	if i := strings.Index(filepath.ToSlash(bin), ".app/Contents/"); i >= 0 {
		app = bin[:i+len(".app")]
	}
	data, err := os.ReadFile(filepath.Join(app, "Contents", "Info.plist"))
	if err != nil {
		return ""
	}
	if m := bundleIDRe.FindSubmatch(data); m != nil {
		return strings.TrimSpace(string(m[1]))
	}
	return ""
}

// Runner runs launchctl.
type Runner func(args ...string) ([]byte, error)

// Launchd installs and inspects LaunchAgents.
type Launchd struct {
	Dir    string // ~/Library/LaunchAgents
	Domain string // gui/<uid>
	Run    Runner
}

// PlistPath is where a job's plist lives.
func (l Launchd) PlistPath(label string) string { return filepath.Join(l.Dir, label+".plist") }

// Install writes the plist and (re)loads it.
func (l Launchd) Install(label string, plist []byte) error {
	if err := os.MkdirAll(l.Dir, 0o755); err != nil {
		return err
	}
	path := l.PlistPath(label)
	printed, notLoaded := l.Run("print", l.Domain+"/"+label)
	// The app's login item runs it (SMAppService): no second job beside
	// it, and none left over from before.
	if notLoaded == nil && inApp(string(printed)) {
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return err
		}
		return nil
	}
	// Unchanged and loaded: leave it. Each reload makes macOS announce the
	// job again ("homelab can run in the background").
	if old, err := os.ReadFile(path); err == nil && bytes.Equal(old, plist) && notLoaded == nil {
		return nil
	}
	if err := os.WriteFile(path, plist, 0o644); err != nil {
		return err
	}
	_, _ = l.Run("bootout", l.Domain+"/"+label) // not loaded yet is fine
	// A label the app's login item left disabled (Remove) would refuse it.
	_, _ = l.Run("enable", l.Domain+"/"+label)
	return l.bootstrap(label)
}

// LoginItemPlist is the agent's plist inside the app
// (Contents/Library/LaunchAgents), which the app registers through
// SMAppService on macOS 13 and later, so Login Items credits the agent to
// Homelab Wizard. A job launchd loaded from there is the app's.
const LoginItemPlist = "com.homelab.agent.plist"

var pathRe = regexp.MustCompile(`(?m)^\s*path = (.+)$`)

// FromApp reports whether launchd runs label from a plist inside an app
// bundle: the login item the app registered, which only the app adds or
// takes away, so schedule leaves it be.
func (l Launchd) FromApp(label string) bool {
	out, err := l.Run("print", l.Domain+"/"+label)
	return err == nil && inApp(string(out))
}

// Enable lets launchd load label again, after Remove turned the app's
// login item off.
func (l Launchd) Enable(label string) { _, _ = l.Run("enable", l.Domain+"/"+label) }

// inApp reports whether `launchctl print` names a plist inside an app.
func inApp(print string) bool {
	m := pathRe.FindStringSubmatch(print)
	return m != nil && strings.Contains(m[1], ".app/Contents/Library/LaunchAgents/")
}

// bootstrap loads the job's plist. Right after a bootout (more so while
// the job runs), launchd can refuse it with "Input/output error" for a
// moment, so it tries a few times.
func (l Launchd) bootstrap(label string) error {
	var out []byte
	var err error
	for try := 0; try < 5; try++ {
		if out, err = l.Run("bootstrap", l.Domain, l.PlistPath(label)); err == nil {
			return nil
		}
		time.Sleep(retryDelay)
	}
	return fmt.Errorf("launchctl bootstrap %s: %v %s", label, err, strings.TrimSpace(string(out)))
}

// Pause unloads the job, which stops it, and keeps its plist, so launchd
// loads it again at the next login.
func (l Launchd) Pause(label string) error {
	out, err := l.Run("print", l.Domain+"/"+label)
	if err != nil {
		return nil // not loaded
	}
	if inApp(string(out)) {
		// The app's login item stays loaded, so the next login starts it:
		// asked to stop, the agent exits cleanly, which KeepAlive leaves be.
		if out, err := l.Run("kill", "SIGTERM", l.Domain+"/"+label); err != nil {
			return fmt.Errorf("launchctl kill %s: %v %s", label, err, strings.TrimSpace(string(out)))
		}
		return nil
	}
	if out, err := l.Run("bootout", l.Domain+"/"+label); err != nil {
		return fmt.Errorf("launchctl bootout %s: %v %s", label, err, strings.TrimSpace(string(out)))
	}
	return nil
}

// Resume loads a paused job again, which starts one that runs at load,
// and starts a loaded one that is not running: the app's login item, which
// Pause stopped, or a job that stopped while loaded, which launchd would
// leave stopped until the next login (the owner's Mac, 29 Oct), as
// systemd and Task Scheduler's Resume already start it.
func (l Launchd) Resume(label string) error {
	out, err := l.Run("print", l.Domain+"/"+label)
	switch {
	case err == nil:
		if m := stateRe.FindStringSubmatch(string(out)); m != nil && strings.TrimSpace(m[1]) == "running" {
			return nil
		}
		if out, err := l.Run("kickstart", l.Domain+"/"+label); err != nil {
			return fmt.Errorf("launchctl kickstart %s: %v %s", label, err, strings.TrimSpace(string(out)))
		}
		return nil
	case !fileExists(l.PlistPath(label)):
		return nil // not installed
	}
	return l.bootstrap(label)
}

// retryDelay is the pause between bootstrap attempts.
var retryDelay = time.Second

// Stale lists the homelab's LaunchAgents (com.homelab.*) that are not
// among jobs: ones an older version installed.
func (l Launchd) Stale(jobs []Job) []string {
	paths, _ := filepath.Glob(filepath.Join(l.Dir, "com.homelab.*.plist"))
	var out []string
	for _, p := range paths {
		label := strings.TrimSuffix(filepath.Base(p), ".plist")
		current := false
		for _, j := range jobs {
			current = current || j.Label == label
		}
		if !current {
			out = append(out, label)
		}
	}
	return out
}

// Remove unloads the job and deletes its plist. The app's login item is
// turned off too (only the app can unregister it), so the next login does
// not start it; installing again turns it back on.
func (l Launchd) Remove(label string) error {
	if l.FromApp(label) {
		_, _ = l.Run("disable", l.Domain+"/"+label)
	}
	_, _ = l.Run("bootout", l.Domain+"/"+label)
	if err := os.Remove(l.PlistPath(label)); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

// InstallJob renders the job's plist and loads it.
func (l Launchd) InstallJob(j Job, bin, root, logDir, path string) error {
	return l.Install(j.Label, j.Plist(bin, root, logDir, path))
}

// Status is what launchd or systemd reports about a job.
type Status struct {
	Installed bool   // plist or unit file present
	Loaded    bool   // known to launchd, or enabled in systemd
	State     string // e.g. "running", "not running"
	Runs      string
	LastExit  string // "(never exited)" or a code
}

var (
	stateRe = regexp.MustCompile(`(?m)^\s*state = (.+)$`)
	runsRe  = regexp.MustCompile(`(?m)^\s*runs = (\d+)$`)
	exitRe  = regexp.MustCompile(`(?m)^\s*last exit code = (.+)$`)
)

// Status reads `launchctl print`.
func (l Launchd) Status(label string) Status {
	var s Status
	if _, err := os.Stat(l.PlistPath(label)); err == nil {
		s.Installed = true
	}
	out, err := l.Run("print", l.Domain+"/"+label)
	if err != nil {
		return s
	}
	s.Loaded = true
	text := string(out)
	s.Installed = s.Installed || inApp(text) // the app's login item
	if m := stateRe.FindStringSubmatch(text); m != nil {
		s.State = strings.TrimSpace(m[1])
	}
	if m := runsRe.FindStringSubmatch(text); m != nil {
		s.Runs = m[1]
	}
	if m := exitRe.FindStringSubmatch(text); m != nil {
		s.LastExit = strings.TrimSpace(m[1])
	}
	return s
}
