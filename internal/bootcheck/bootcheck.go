// Package bootcheck says, in plain English, whether a Mac brings the homelab
// back by itself after a restart or a power cut, and if not, what stops it
// (docs/Known Issues.md, ISSUE-0007).
//
// The apps run in OrbStack or Docker Desktop, which are the logged-in
// person's apps: macOS starts them only once someone has logged in, and a
// LaunchDaemon (which runs before anyone logs in) cannot start them. So what
// decides it is whether the Mac reaches a logged-in session on its own:
// FileVault stops every restart at its unlock screen; without FileVault,
// automatic login takes it through; and after a power cut the Mac turns on
// again only with "Start up automatically after a power failure".
package bootcheck

import (
	"context"
	"regexp"
	"strings"
)

// Runner runs a command and returns its output.
type Runner func(ctx context.Context, name string, args ...string) ([]byte, error)

// Readings are the three settings, as macOS reports them; "" for one that
// could not be read.
type Readings struct {
	FileVault   string // "on" or "off"
	AutoLogin   string // the account that logs in by itself, "-" for none
	AutoRestart string // "on" or "off"
}

// Read asks macOS for the readings: fdesetup, the login window's settings,
// and pmset. Each that fails stays "".
func Read(ctx context.Context, run Runner) Readings {
	var r Readings
	if out, err := run(ctx, "fdesetup", "status"); err == nil {
		switch s := string(out); {
		case strings.Contains(s, "FileVault is On"):
			r.FileVault = "on"
		case strings.Contains(s, "FileVault is Off"):
			r.FileVault = "off"
		}
	}
	// defaults exits 1 when the key is not there: no automatic login.
	if out, err := run(ctx, "defaults", "read", "/Library/Preferences/com.apple.loginwindow", "autoLoginUser"); err == nil {
		r.AutoLogin = strings.TrimSpace(string(out))
	} else if strings.Contains(string(out), "does not exist") {
		r.AutoLogin = "-"
	}
	if out, err := run(ctx, "pmset", "-g"); err == nil {
		if m := autoRestartRe.FindStringSubmatch(string(out)); m != nil {
			r.AutoRestart = map[string]string{"0": "off", "1": "on"}[m[1]]
		}
	}
	return r
}

var autoRestartRe = regexp.MustCompile(`(?m)^\s*autorestart\s+(\d)`)

// Line is one finding: OK says it helps the homelab come back.
type Line struct {
	OK   bool
	Text string
}

// Report is what Assess concludes.
type Report struct {
	// Unattended: after a restart the Mac logs in by itself, so the apps
	// come back with nobody there.
	Unattended bool
	Lines      []Line
}

// Assess turns the readings into plain English: what happens after a
// restart and after a power cut, and the one thing to do about each.
func Assess(r Readings) Report {
	var rep Report
	add := func(ok bool, text string) { rep.Lines = append(rep.Lines, Line{ok, text}) }
	switch {
	case r.FileVault == "on":
		add(false, "After a restart, this Mac waits at FileVault's unlock screen: no app starts until someone logs in. For a planned restart (a macOS update), run sudo fdesetup authrestart, which unlocks it once")
	case r.FileVault == "off" && r.AutoLogin != "" && r.AutoLogin != "-":
		rep.Unattended = true
		add(true, "After a restart, this Mac logs in as "+r.AutoLogin+" by itself, and the apps start")
	case r.FileVault == "off" && r.AutoLogin == "-":
		add(false, "After a restart, this Mac waits at the login window: no app starts until someone logs in (automatic login is off, in System Settings › Users & Groups)")
	default:
		add(false, "Could not read whether this Mac logs in by itself after a restart (fdesetup status, and the login window's autoLoginUser)")
	}
	switch r.AutoRestart {
	case "on":
		add(true, "After a power cut, it turns on again by itself")
	case "off":
		rep.Unattended = false
		add(false, "After a power cut, it stays off until someone presses the power button: System Settings › Energy › Start up automatically after a power failure (or sudo pmset autorestart 1)")
	default:
		add(false, "Could not read whether it turns on again after a power cut (pmset -g, autorestart)")
	}
	return rep
}
