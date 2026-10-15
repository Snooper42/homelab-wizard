package main

import (
	"context"
	"errors"
	"os/exec"
	"runtime"
	"strings"
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
	if runtime.GOOS != "darwin" {
		return 0, false
	}
	out, err := exec.CommandContext(ctx, "pmset", "-g", "custom").Output()
	if err != nil {
		return 0, false
	}
	return parseSleep(string(out))
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
