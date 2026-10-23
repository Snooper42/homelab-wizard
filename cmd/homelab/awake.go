package main

import (
	"context"
	"errors"
	"os/exec"
	"runtime"
	"strconv"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/procattr"
)

// awake keeps the machine from sleeping while it is plugged in, until it is
// stopped: the awake job runs it all the time. With KEEP_AWAKE=false it
// returns at once, and the job stays stopped until the next login.
func (h *homelab) awake(ctx context.Context, _ []string) error {
	if strings.EqualFold(h.envMap()["KEEP_AWAKE"], "false") {
		h.ui.Info("KEEP_AWAKE=false: this machine sleeps as its settings say")
		return nil
	}
	return keepAwake(ctx)
}

// awakeCommand is what holds sleep off on macOS and Linux: caffeinate's
// -s applies only on power, so a laptop on battery still sleeps.
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
		// GNOME's setting; other desktops keep theirs elsewhere.
		const schema = "org.gnome.settings-daemon.plugins.power"
		kind, err := exec.CommandContext(ctx, "gsettings", "get", schema, "sleep-inactive-ac-type").Output()
		if err != nil {
			return 0, false
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
