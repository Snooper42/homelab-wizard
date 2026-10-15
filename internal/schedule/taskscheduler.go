package schedule

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// TaskScheduler runs jobs on Windows without administrator rights: timed
// jobs as Task Scheduler tasks in a Homelab folder, the at-sign-in job from
// the user's Run key (or, without homelab-run.exe, as a script in the
// Startup folder). Each job runs a .cmd script that appends its output to
// the job's log; with homelab-run.exe beside the CLI (the installer puts it
// there), jobs start the script through it, so no console window opens.
type TaskScheduler struct {
	Dir     string // job scripts, e.g. %LOCALAPPDATA%\Homelab\jobs
	Startup string // the user's Startup folder
	Run     Runner // runs schtasks.exe
	Reg     Runner // runs reg.exe
}

// runKey holds the commands Windows starts when this user signs in.
const runKey = `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`

// TaskName is the job's task: com.homelab.backup -> Homelab\backup.
func TaskName(label string) string { return `Homelab\` + strings.TrimPrefix(label, "com.homelab.") }

// cmdQuote quotes one argument for a .cmd script; % is doubled so cmd does
// not expand it.
func cmdQuote(s string) string {
	s = strings.ReplaceAll(s, "%", "%%")
	if s == "" || strings.ContainsAny(s, " &()[]{}^=;!'+,`~|<>\"") {
		return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
	}
	return s
}

// Script renders the .cmd file the job runs.
func (j Job) Script(bin, root, logDir string) []byte {
	args := []string{cmdQuote(bin), "--root", cmdQuote(root), "--no-color"}
	for _, a := range j.Args {
		args = append(args, cmdQuote(a))
	}
	logFile := filepath.Join(logDir, strings.TrimPrefix(j.Label, "com.homelab.")+".log")
	return []byte("@echo off\r\ncd /d " + cmdQuote(root) + "\r\n" + strings.Join(args, " ") + " >> " + cmdQuote(logFile) + " 2>&1\r\n")
}

func (t TaskScheduler) startupScript(label string) string {
	return filepath.Join(t.Startup, unitOf(label)+".cmd")
}

func (t TaskScheduler) script(label string) string { return filepath.Join(t.Dir, unitOf(label)+".cmd") }

// InstallJob writes the job's script and registers it. The at-sign-in job
// first runs at the next sign-in.
func (t TaskScheduler) InstallJob(j Job, bin, root, logDir, _ string) error {
	runner := filepath.Join(filepath.Dir(bin), JobRunner)
	if !fileExists(runner) {
		runner = ""
	}
	path := t.script(j.Label)
	if j.RunAtLoad && (runner == "" || t.Reg == nil) {
		path = t.startupScript(j.Label)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	if err := os.WriteFile(path, j.Script(bin, root, logDir), 0o644); err != nil {
		return err
	}
	run := `"` + path + `"`
	if runner != "" {
		run = `"` + runner + `" ` + run
	}
	if j.RunAtLoad {
		if path == t.startupScript(j.Label) {
			return nil
		}
		// From the Run key, through the runner: no window at sign-in. An
		// older Startup-folder script would run the job twice.
		if err := os.Remove(t.startupScript(j.Label)); err != nil && !os.IsNotExist(err) {
			return err
		}
		if out, err := t.Reg("add", runKey, "/v", unitOf(j.Label), "/t", "REG_SZ", "/d", run, "/f"); err != nil {
			return fmt.Errorf("reg add %s: %v %s", unitOf(j.Label), err, strings.TrimSpace(string(out)))
		}
		return nil
	}
	args := []string{"/Create", "/F", "/TN", TaskName(j.Label), "/TR", run}
	switch {
	case j.Daily:
		args = append(args, "/SC", "DAILY", "/ST", fmt.Sprintf("%02d:%02d", j.Hour, j.Minute))
	case j.Interval > 0:
		args = append(args, "/SC", "MINUTE", "/MO", strconv.Itoa(max(1, j.Interval/60)))
	default:
		return fmt.Errorf("%s has no schedule", j.Label)
	}
	if out, err := t.Run(args...); err != nil {
		return fmt.Errorf("schtasks /Create %s: %v %s", TaskName(j.Label), err, strings.TrimSpace(string(out)))
	}
	return nil
}

// JobRunner is the windowless job starter (cmd/homelab-run) the tasks use when
// it sits beside the CLI.
const JobRunner = "homelab-run.exe"

// signInValue reports whether the Run key starts the job at sign-in.
func (t TaskScheduler) signInValue(label string) bool {
	if t.Reg == nil {
		return false
	}
	_, err := t.Reg("query", runKey, "/v", unitOf(label))
	return err == nil
}

func fileExists(p string) bool {
	fi, err := os.Stat(p)
	return err == nil && !fi.IsDir()
}

// Remove unregisters the job and deletes its script.
func (t TaskScheduler) Remove(label string) error {
	if t.signInValue(label) {
		if out, err := t.Reg("delete", runKey, "/v", unitOf(label), "/f"); err != nil {
			return fmt.Errorf("reg delete %s: %v %s", unitOf(label), err, strings.TrimSpace(string(out)))
		}
	} else if _, err := os.Stat(t.script(label)); err == nil {
		if out, err := t.Run("/Delete", "/F", "/TN", TaskName(label)); err != nil {
			return fmt.Errorf("schtasks /Delete %s: %v %s", TaskName(label), err, strings.TrimSpace(string(out)))
		}
	}
	for _, p := range []string{t.script(label), t.startupScript(label)} {
		if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	return nil
}

// Status reads `schtasks /Query` (English labels). A Startup-folder job
// counts as loaded while its script is there.
func (t TaskScheduler) Status(label string) Status {
	var st Status
	if _, err := os.Stat(t.startupScript(label)); err == nil || t.signInValue(label) {
		return Status{Installed: true, Loaded: true, State: "runs at sign-in"}
	}
	if _, err := os.Stat(t.script(label)); err == nil {
		st.Installed = true
	}
	out, err := t.Run("/Query", "/TN", TaskName(label), "/FO", "LIST", "/V")
	if err != nil {
		return st
	}
	st.Loaded = true
	for _, line := range strings.Split(string(out), "\n") {
		k, v, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		v = strings.TrimSpace(v)
		switch strings.TrimSpace(k) {
		case "Status":
			st.State = v
		case "Last Result":
			st.LastExit = v
			if v == "267011" { // SCHED_S_TASK_HAS_NOT_RUN
				st.LastExit = "(never exited)"
			}
		}
	}
	return st
}
