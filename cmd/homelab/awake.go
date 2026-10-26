package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/awake"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
)

// awake keeps the machine from sleeping while it is plugged in, until it is
// stopped: the awake job runs it all the time. With KEEP_AWAKE=false it
// returns at once, and the job stays stopped until the next login.
// awake allow gives it, on Linux, the permission it needs (internal/awake).
func (h *homelab) awake(ctx context.Context, args []string) error {
	if len(args) > 0 && args[0] == "allow" {
		return h.awakeAllow(ctx, args[1:])
	}
	if strings.EqualFold(h.envMap()["KEEP_AWAKE"], "false") {
		h.ui.Info("KEEP_AWAKE=false: this machine sleeps as its settings say")
		return nil
	}
	return keepAwake(ctx)
}

// awakeCommand is what holds sleep off on macOS and Linux: caffeinate's
// -s applies only on power, so a laptop on battery still sleeps.
// systemd-inhibit holds on battery too, so on Linux onPower starts and
// stops it as the power comes and goes.
func awakeCommand() (string, []string, error) {
	switch runtime.GOOS {
	case "darwin":
		return "/usr/bin/caffeinate", []string{"-s"}, nil
	case "linux":
		if _, err := exec.LookPath("systemd-inhibit"); err != nil {
			return "", nil, errors.New("systemd-inhibit is not installed, so this machine cannot be kept awake")
		}
		return "systemd-inhibit", []string{"--what=sleep:idle", "--who=homelab", "--why=Keeps the homelab's apps reachable", "--mode=block", "sleep", "infinity"}, nil
	}
	return "", nil, errors.New("keeping awake is not supported here")
}

// powerEvery is how often onPower looks at the power; tests shorten it.
var powerEvery = time.Minute

// onPower holds sleep off while this machine is on power and lets it go on
// battery, looking again every powerEvery: Windows' power request and
// systemd-inhibit hold whatever the power, unlike caffeinate -s. A machine
// that cannot tell (a desktop) counts as on power. hold returns how to let
// go, and a channel that says the hold ended by itself (its program
// stopped), which ends onPower with that error so the agent starts it again.
func onPower(ctx context.Context, power func() (onBattery, known bool), hold func() (release func(), ended <-chan error, err error)) error {
	var release func()
	var ended <-chan error
	defer func() {
		if release != nil {
			release()
		}
	}()
	for {
		onBattery, _ := power()
		switch {
		case onBattery && release != nil:
			release()
			release, ended = nil, nil
		case !onBattery && release == nil:
			var err error
			if release, ended, err = hold(); err != nil {
				return err
			}
		}
		select {
		case <-ctx.Done():
			return nil
		case err := <-ended:
			release = nil
			if err == nil {
				err = errors.New("the hold on sleep ended by itself")
			}
			return err
		case <-time.After(powerEvery):
		}
	}
}

// systemSleep is the minutes of idle before the system sleeps on power
// (0 for never); ok is false where it cannot be read. Tests replace it.
var systemSleep = func(ctx context.Context) (int, bool) {
	switch runtime.GOOS {
	case "darwin":
		out, err := exec.CommandContext(ctx, "pmset", "-g", "custom").Output()
		if err != nil {
			return 0, false
		}
		return parseSleep(string(out))
	case "linux":
		// Plasma's (SteamOS's desktop) from its files, GNOME's through
		// gsettings. On Plasma, gsettings answers with GNOME's defaults,
		// so it is not asked there.
		if strings.Contains(strings.ToUpper(os.Getenv("XDG_CURRENT_DESKTOP")), "KDE") {
			return plasmaSleep(configHome())
		}
		const schema = "org.gnome.settings-daemon.plugins.power"
		kind, err := exec.CommandContext(ctx, "gsettings", "get", schema, "sleep-inactive-ac-type").Output()
		if err != nil {
			return plasmaSleep(configHome()) // the agent has no desktop in its environment
		}
		secs, err := exec.CommandContext(ctx, "gsettings", "get", schema, "sleep-inactive-ac-timeout").Output()
		if err != nil {
			return 0, false
		}
		return parseGnomeSleep(string(kind), string(secs))
	case "windows":
		out, err := procattr.Hide(exec.CommandContext(ctx, "powercfg", "/query", "SCHEME_CURRENT", "SUB_SLEEP", "STANDBYIDLE")).Output()
		if err != nil {
			return 0, false
		}
		return parsePowercfg(string(out))
	}
	return 0, false
}

// parseSleep reads `pmset -g custom`: the AC Power section's sleep line
// (a Mac mini has only that section).
func parseSleep(out string) (int, bool) {
	section := ""
	for _, line := range strings.Split(out, "\n") {
		t := strings.TrimSpace(line)
		if strings.HasSuffix(t, ":") {
			section = t
			continue
		}
		f := strings.Fields(t)
		if len(f) >= 2 && f[0] == "sleep" && (section == "" || strings.HasPrefix(section, "AC Power")) {
			n := 0
			for _, c := range f[1] {
				if c < '0' || c > '9' {
					return 0, false
				}
				n = n*10 + int(c-'0')
			}
			return n, true
		}
	}
	return 0, false
}

// parseGnomeSleep reads GNOME's idle action on power ('suspend', or
// 'nothing' for never) and its timeout in seconds.
func parseGnomeSleep(kind, secs string) (int, bool) {
	switch strings.Trim(strings.TrimSpace(kind), "'") {
	case "suspend", "hibernate":
	case "":
		return 0, false
	default:
		return 0, true
	}
	n, err := strconv.Atoi(strings.TrimPrefix(strings.TrimSpace(secs), "uint32 "))
	if err != nil || n < 0 {
		return 0, false
	}
	return minutes(n), true
}

// configHome is $XDG_CONFIG_HOME, or ~/.config.
func configHome() string {
	if d := os.Getenv("XDG_CONFIG_HOME"); d != "" {
		return d
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config")
}

// plasmaSleep reads KDE Plasma's sleep on power from its files in dir:
// Plasma 6's powerdevilrc, else Plasma 5's powermanagementprofilesrc.
func plasmaSleep(dir string) (int, bool) {
	if data, err := os.ReadFile(filepath.Join(dir, "powerdevilrc")); err == nil {
		if n, ok := parsePlasma6Sleep(string(data)); ok {
			return n, true
		}
	}
	data, err := os.ReadFile(filepath.Join(dir, "powermanagementprofilesrc"))
	if err != nil {
		return 0, false
	}
	return parsePlasma5Sleep(string(data))
}

// iniGroups reads a KDE config file: each [group][subgroup] header, joined,
// with its keys.
func iniGroups(data string) map[string]map[string]string {
	groups := map[string]map[string]string{}
	group := ""
	for _, line := range strings.Split(data, "\n") {
		t := strings.TrimSpace(line)
		if strings.HasPrefix(t, "[") && strings.HasSuffix(t, "]") {
			group = t
			if groups[group] == nil {
				groups[group] = map[string]string{}
			}
			continue
		}
		if k, v, ok := strings.Cut(t, "="); ok && group != "" {
			groups[group][strings.TrimSpace(k)] = strings.TrimSpace(v)
		}
	}
	return groups
}

// parsePlasma6Sleep reads powerdevilrc's [AC][SuspendAndShutdown]:
// AutoSuspendAction 0 is "do nothing", 1 sleep, 2 hibernate, and
// AutoSuspendIdleTimeoutSec the idle before it. Plasma writes only what
// was changed, so without both the default is not known here.
func parsePlasma6Sleep(data string) (int, bool) {
	g := iniGroups(data)["[AC][SuspendAndShutdown]"]
	action, ok := g["AutoSuspendAction"]
	switch {
	case !ok:
		return 0, false
	case action == "0":
		return 0, true
	}
	secs, err := strconv.Atoi(g["AutoSuspendIdleTimeoutSec"])
	if err != nil || secs < 0 {
		return 0, false
	}
	return minutes(secs), true
}

// parsePlasma5Sleep reads powermanagementprofilesrc: Plasma 5 writes each
// profile whole, so an AC profile without [AC][SuspendSession] never
// sleeps; idleTime is in milliseconds.
func parsePlasma5Sleep(data string) (int, bool) {
	groups := iniGroups(data)
	if _, ok := groups["[AC]"]; !ok {
		found := false
		for k := range groups {
			found = found || strings.HasPrefix(k, "[AC]")
		}
		if !found {
			return 0, false
		}
	}
	g, ok := groups["[AC][SuspendSession]"]
	if !ok {
		return 0, true
	}
	ms, err := strconv.Atoi(g["idleTime"])
	if err != nil || ms < 0 {
		return 0, false
	}
	return minutes(ms / 1000), true
}

// parsePowercfg reads `powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE`:
// the AC setting in seconds. Its labels are in the system's language, so it
// is found by place: the values come as minimum, maximum, increment, AC,
// then DC.
func parsePowercfg(out string) (int, bool) {
	var vals []uint64
	for _, line := range strings.Split(out, "\n") {
		f := strings.Fields(line)
		if len(f) == 0 || !strings.HasPrefix(f[len(f)-1], "0x") {
			continue
		}
		v, err := strconv.ParseUint(strings.TrimPrefix(f[len(f)-1], "0x"), 16, 32)
		if err != nil {
			return 0, false
		}
		vals = append(vals, v)
	}
	if len(vals) < 4 {
		return 0, false
	}
	return minutes(int(vals[3])), true // #nosec G115 -- minutes of a timer, far below int's range
}

// minutes rounds seconds up to whole minutes.
func minutes(secs int) int { return (secs + 59) / 60 }

// awakeAllow writes, with the administrator's password, the polkit rule
// that lets this account's awake job hold sleep off on Linux, where polkit
// refuses it to a job outside a login session; --undo removes it.
func (h *homelab) awakeAllow(ctx context.Context, args []string) error {
	fs := newFlags("awake allow")
	apply := applyFlag(fs)
	undo := fs.Bool("undo", false, "")
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	u := h.ui
	if runtime.GOOS != "linux" {
		u.OK("nothing to allow here: only Linux asks for this permission")
		return nil
	}
	who := loginName()
	if *undo {
		if !awake.Allowed() {
			u.OK("no rule of homelab's lets this machine be kept awake")
			return nil
		}
		u.Title("The awake job's permission is taken back")
		u.Info("remove %s: logind refuses the awake job again, so this machine sleeps as its settings say", awake.RulePath)
		u.Info("%s", u.Dim("it asks for the administrator's password"))
		if err := h.goAhead(*apply, "\nRemove it?"); err != nil {
			return err
		}
		if err := asAdmin(ctx, awake.UndoScript()); err != nil {
			return fmt.Errorf("removing the rule: %w", err)
		}
		if err := awake.Mark(false); err != nil {
			return err
		}
		u.OK("removed")
		return nil
	}
	if awake.Allowed() {
		u.OK("%s may keep this machine awake already (%s)", who, awake.RulePath)
		return nil
	}
	script, err := awake.Script(who)
	if err != nil {
		return err
	}
	u.Title("This machine kept awake while plugged in")
	u.Info("write %s: it lets %s's background job hold sleep off (blocking sleep and idle, nothing else)", awake.RulePath, who)
	u.Info("%s", u.Dim("Linux allows that only to a program in a login session, and the homelab's job runs without one; it asks for the administrator's password"))
	if err := h.goAhead(*apply, "\nAllow it?"); err != nil {
		return err
	}
	if err := asAdmin(ctx, script); err != nil {
		return fmt.Errorf("writing the rule: %w", err)
	}
	if err := awake.Mark(true); err != nil {
		return err
	}
	u.OK("allowed: the awake job holds sleep off within a minute, while plugged in")
	return nil
}
