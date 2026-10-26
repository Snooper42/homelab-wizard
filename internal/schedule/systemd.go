package schedule

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// Systemd installs and inspects systemd user units: a oneshot service per
// job, plus a timer for jobs that repeat. They run without a login session
// only when lingering is on (loginctl enable-linger).
type Systemd struct {
	Dir string // ~/.config/systemd/user
	Run Runner // runs systemctl --user with the given arguments
}

// Unit is the job's unit name without a suffix: com.homelab.backup -> homelab-backup.
func (j Job) Unit() string { return "homelab-" + strings.TrimPrefix(j.Label, "com.homelab.") }

func unitOf(label string) string { return Job{Label: label}.Unit() }

// quoteArg quotes one ExecStart argument for systemd.
func quoteArg(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `"`, `\"`)
	s = strings.ReplaceAll(s, "%", "%%")
	return `"` + s + `"`
}

// Units renders the service and, for repeating jobs, the timer (nil otherwise).
func (j Job) Units(bin, root, logDir, path string) (service, timer []byte) {
	var b strings.Builder
	kind := "Type=oneshot\n"
	if j.KeepAlive {
		kind = "Type=simple\nRestart=on-failure\nRestartSec=30\n"
	}
	fmt.Fprintf(&b, "[Unit]\nDescription=homelab: %s\n\n[Service]\n%s", j.Description, kind)
	args := make([]string, 0, len(j.Args)+4)
	for _, a := range append([]string{bin, "--root", root, "--no-color"}, j.Args...) {
		args = append(args, quoteArg(a))
	}
	logFile := strings.TrimSuffix(filepath.ToSlash(logDir), "/") + "/" + strings.TrimPrefix(j.Label, "com.homelab.") + ".log" // a Linux path
	// WorkingDirectory and the log paths are plain paths: no quotes, but
	// systemd still expands % specifiers in them.
	pct := strings.NewReplacer("%", "%%")
	fmt.Fprintf(&b, "ExecStart=%s\nWorkingDirectory=%s\nEnvironment=%s\n", strings.Join(args, " "), pct.Replace(root), quoteArg("PATH="+path))
	fmt.Fprintf(&b, "StandardOutput=append:%s\nStandardError=append:%s\n", pct.Replace(logFile), pct.Replace(logFile))
	if j.RunAtLoad {
		b.WriteString("\n[Install]\nWantedBy=default.target\n")
	}
	service = []byte(b.String())
	if !j.Daily && j.Interval == 0 {
		return service, nil
	}
	b.Reset()
	fmt.Fprintf(&b, "[Unit]\nDescription=homelab: %s (%s)\n\n[Timer]\n", j.Description, j.When())
	if j.Daily {
		fmt.Fprintf(&b, "OnCalendar=*-*-* %02d:%02d:00\nPersistent=true\n", j.Hour, j.Minute)
	}
	if j.Interval > 0 {
		fmt.Fprintf(&b, "OnBootSec=%ds\nOnUnitActiveSec=%ds\n", j.Interval, j.Interval)
	}
	b.WriteString("\n[Install]\nWantedBy=timers.target\n")
	return service, []byte(b.String())
}

// trigger is the unit to enable: the timer when there is one.
func (s Systemd) trigger(label string) string {
	if _, err := os.Stat(filepath.Join(s.Dir, unitOf(label)+".timer")); err == nil {
		return unitOf(label) + ".timer"
	}
	return unitOf(label) + ".service"
}

func (s Systemd) systemctl(args ...string) error {
	if out, err := s.Run(args...); err != nil {
		return fmt.Errorf("systemctl --user %s: %v %s", strings.Join(args, " "), err, strings.TrimSpace(string(out)))
	}
	return nil
}

// InstallJob writes the job's units, then enables and starts them.
func (s Systemd) InstallJob(j Job, bin, root, logDir, path string) error {
	if err := os.MkdirAll(s.Dir, 0o755); err != nil {
		return err
	}
	service, timer := j.Units(bin, root, logDir, path)
	if err := os.WriteFile(filepath.Join(s.Dir, j.Unit()+".service"), service, 0o644); err != nil {
		return err
	}
	if timer != nil {
		if err := os.WriteFile(filepath.Join(s.Dir, j.Unit()+".timer"), timer, 0o644); err != nil {
			return err
		}
	}
	if err := s.systemctl("daemon-reload"); err != nil {
		return err
	}
	return s.systemctl("enable", "--now", s.trigger(j.Label))
}

// Remove disables the job and deletes its units.
func (s Systemd) Remove(label string) error {
	_, _ = s.Run("disable", "--now", s.trigger(label))
	for _, ext := range []string{".timer", ".service"} {
		if err := os.Remove(filepath.Join(s.Dir, unitOf(label)+ext)); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	return s.systemctl("daemon-reload")
}

// Status reads `systemctl --user show`. Loaded means the job is enabled.
func (s Systemd) Status(label string) Status {
	var st Status
	if _, err := os.Stat(filepath.Join(s.Dir, unitOf(label)+".service")); err == nil {
		st.Installed = true
	}
	if out, err := s.Run("is-enabled", s.trigger(label)); err != nil || strings.TrimSpace(string(out)) != "enabled" {
		return st
	}
	st.Loaded = true
	out, err := s.Run("show", unitOf(label)+".service", "--property=ActiveState,ExecMainStatus,ExecMainStartTimestampMonotonic")
	if err != nil {
		return st
	}
	props := map[string]string{}
	for _, line := range strings.Split(string(out), "\n") {
		if k, v, ok := strings.Cut(strings.TrimSpace(line), "="); ok {
			props[k] = v
		}
	}
	st.State = props["ActiveState"]
	if started, _ := strconv.ParseInt(props["ExecMainStartTimestampMonotonic"], 10, 64); started > 0 {
		st.LastExit = props["ExecMainStatus"]
	} else {
		st.LastExit = "(never exited)"
	}
	return st
}
