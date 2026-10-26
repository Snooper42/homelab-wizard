// Package awake is what lets the awake job hold sleep off on Linux.
// systemd-inhibit asks logind, and logind asks polkit, which refuses a
// sleep block to a program outside a login session: the agent, a user
// service, is one. A polkit rule written once with the administrator's
// password allows this account to block sleep and idle, and nothing else.
package awake

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/battery"
)

// RulePath is the rule for polkit 0.106 and later (JavaScript rules);
// LegacyPath is the same for older polkit (Ubuntu 22.04), which reads
// .pkla files only.
const (
	RulePath   = "/etc/polkit-1/rules.d/49-homelab-awake.rules"
	LegacyPath = "/etc/polkit-1/localauthority/50-local.d/49-homelab-awake.pkla"
)

// legacyDir is older polkit's folder; tests replace it.
var legacyDir = "/etc/polkit-1/localauthority"

// actions are what the rule allows: blocking sleep and idle, as the awake
// job's systemd-inhibit --what=sleep:idle asks.
var actions = []string{"org.freedesktop.login1.inhibit-block-sleep", "org.freedesktop.login1.inhibit-block-idle"}

var validUser = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9._-]*$`)

// Rule is the JavaScript rule allowing user.
func Rule(user string) string {
	var ids []string
	for _, a := range actions {
		ids = append(ids, "action.id == "+strconv.Quote(a))
	}
	return fmt.Sprintf(`// Written by Homelab Wizard (homelab awake allow): lets %s keep this
// machine awake while it is plugged in, from the homelab's background job.
// homelab awake allow --undo removes it.
polkit.addRule(function(action, subject) {
    if ((%s) && subject.user == %s) {
        return polkit.Result.YES;
    }
});
`, user, strings.Join(ids, " ||\n         "), strconv.Quote(user))
}

// LegacyRule is the same for polkit's older .pkla files.
func LegacyRule(user string) string {
	return fmt.Sprintf("# Written by Homelab Wizard (homelab awake allow); homelab awake allow --undo removes it.\n[Homelab Wizard keeps this machine awake]\nIdentity=unix-user:%s\nAction=%s\nResultAny=yes\n", user, strings.Join(actions, ";"))
}

// Script writes the rule (and the legacy one where older polkit's folder
// is), as root.
func Script(user string) (string, error) {
	if !validUser.MatchString(user) {
		return "", fmt.Errorf("%q is not an account name polkit can take", user)
	}
	s := "set -e\nmkdir -p /etc/polkit-1/rules.d\n" + write(RulePath, Rule(user))
	if dirExists(legacyDir) {
		s += "mkdir -p " + shQuote(legacyDir+"/50-local.d") + "\n" + write(LegacyPath, LegacyRule(user))
	}
	return s, nil
}

// UndoScript removes what Script wrote.
func UndoScript() string {
	return "rm -f " + shQuote(RulePath) + " " + shQuote(LegacyPath) + "\n"
}

// Allowed reports whether homelab awake allow gave this account the
// permission, from a marker in its own settings folder: polkit's rules
// folder is readable only by root and polkit (Ubuntu), so the rule itself
// cannot be read back.
func Allowed() bool {
	_, err := os.Stat(marker())
	return err == nil
}

// Mark records that the rule was written (on is true) or removed.
func Mark(on bool) error {
	p := marker()
	if !on {
		if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
			return err
		}
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return err
	}
	return os.WriteFile(p, []byte(RulePath+"\n"), 0o644)
}

// marker is where Mark records it; tests replace it.
var marker = func() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = os.TempDir()
	}
	return filepath.Join(dir, "Homelab Wizard", "awake-allowed")
}

// Held reports whether the awake job holds sleep off now, from logind's
// own list; known is false where systemd-inhibit cannot say.
func Held(ctx context.Context) (held, known bool) {
	out, err := inhibitors(ctx)
	if err != nil {
		return false, false
	}
	return Listed(out), true
}

// inhibitors is logind's list of what holds sleep off; tests replace it.
var inhibitors = func(ctx context.Context) (string, error) {
	out, err := exec.CommandContext(ctx, "systemd-inhibit", "--list", "--no-pager").Output()
	return string(out), err
}

// Listed reports whether systemd-inhibit --list shows homelab's block.
func Listed(list string) bool {
	for _, line := range strings.Split(list, "\n") {
		f := strings.Fields(line)
		if len(f) > 0 && f[0] == "homelab" && strings.Contains(line, "sleep") && strings.Contains(line, "block") {
			return true
		}
	}
	return false
}

func write(path, content string) string {
	return "cat > " + shQuote(path) + " <<'HOMELAB_EOF'\n" + content + "HOMELAB_EOF\nchmod 644 " + shQuote(path) + "\n"
}

func shQuote(s string) string { return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'" }

func dirExists(p string) bool {
	fi, err := os.Stat(p)
	return err == nil && fi.IsDir()
}

// power is battery.Power; tests replace it.
var power = battery.Power

// User is the account the rule is for: this one.
func User() string {
	if name := os.Getenv("USER"); name != "" {
		return name
	}
	if me, err := user.Current(); err == nil {
		return me.Username
	}
	return ""
}

// Refused reports, on Linux, a machine on power whose awake job holds
// nothing in logind's own list (it was refused, or is not running): Setup's
// step and doctor's warning.
func Refused(ctx context.Context) bool {
	if runtime.GOOS != "linux" {
		return false
	}
	if onBattery, _ := power(); onBattery {
		return false
	}
	held, known := Held(ctx)
	return known && !held
}
