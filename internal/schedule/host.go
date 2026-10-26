package schedule

import (
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strconv"

	"github.com/Snooper42/homelab-wizard/internal/host"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
)

// Jobs are the scheduled jobs homelab installs: one agent that starts the
// apps at login, keeps the machine awake on power, serves the phone
// companion, and runs the watchdog and the nightly backup, so the system's
// login items list one entry, not five.
func Jobs() []Job {
	return []Job{
		{Label: "com.homelab.agent", Description: "start the apps at login, keep awake on power, the phone companion, the watchdog every 15 minutes, and the nightly backup at 03:30", Args: []string{"agent"}, RunAtLoad: true, KeepAlive: true},
	}
}

// Legacy are the jobs older versions installed one by one, which the agent
// replaces; installing removes them.
var Legacy = []string{"com.homelab.startup", "com.homelab.backup", "com.homelab.watchdog", "com.homelab.awake", "com.homelab.serve"}

// Scheduler installs and inspects jobs: launchd on macOS, systemd on Linux,
// Task Scheduler on Windows.
type Scheduler interface {
	InstallJob(j Job, bin, root, logDir, path string) error
	Remove(label string) error
	Status(label string) Status
}

// For returns the host's scheduler.
func For(p host.Profile) (Scheduler, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	switch p.Scheduler {
	case "launchd":
		return Launchd{
			Dir:    filepath.Join(home, "Library", "LaunchAgents"),
			Domain: "gui/" + strconv.Itoa(os.Getuid()),
			Run: func(args ...string) ([]byte, error) {
				return procattr.Hide(exec.Command("launchctl", args...)).CombinedOutput()
			},
		}, nil
	case "systemd":
		dir := filepath.Join(home, ".config", "systemd", "user")
		if x := os.Getenv("XDG_CONFIG_HOME"); x != "" {
			dir = filepath.Join(x, "systemd", "user")
		}
		return Systemd{
			Dir: dir,
			Run: func(args ...string) ([]byte, error) {
				return procattr.Hide(exec.Command("systemctl", append([]string{"--user"}, args...)...)).CombinedOutput()
			},
		}, nil
	case "taskscheduler":
		local, appData := os.Getenv("LOCALAPPDATA"), os.Getenv("APPDATA")
		if local == "" || appData == "" {
			return nil, fmt.Errorf("LOCALAPPDATA and APPDATA must be set")
		}
		return TaskScheduler{
			Dir:     filepath.Join(local, "Homelab", "jobs"),
			Startup: filepath.Join(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Startup"),
			Run: func(args ...string) ([]byte, error) {
				return procattr.Hide(exec.Command("schtasks", args...)).CombinedOutput()
			},
			Reg: func(args ...string) ([]byte, error) {
				return procattr.Hide(exec.Command("reg", args...)).CombinedOutput()
			},
			PS: func(args ...string) ([]byte, error) {
				return procattr.Hide(exec.Command("powershell.exe", append([]string{"-NoProfile", "-Command"}, args...)...)).CombinedOutput()
			},
		}, nil
	}
	return nil, fmt.Errorf("scheduled jobs need launchd (macOS), systemd (Linux), or Task Scheduler (Windows); %s has none", p.Name)
}

// Lingering reports whether systemd keeps this user's jobs running without
// a login session.
func Lingering() bool {
	u, err := user.Current()
	if err != nil {
		return false
	}
	_, err = os.Stat(filepath.Join("/var/lib/systemd/linger", u.Username))
	return err == nil
}
